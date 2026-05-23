import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function sanitizeApiResponse(result: any) {
  const sanitized = { ...(result || {}) };
  if (sanitized.content?.JPEGThumbnail) sanitized.content.JPEGThumbnail = '[thumbnail]';
  if (sanitized.content?.imageMessage?.jpegThumbnail) sanitized.content.imageMessage.jpegThumbnail = '[thumbnail]';
  return sanitized;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const workerId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const isInternal = token && token === serviceKey;

    if (!isInternal) {
      const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
      if (authError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', claimsData.claims.sub as string)
        .single();

      if (!profile?.is_admin) {
        return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), { status: 403, headers: corsHeaders });
      }
    }

    const { data: lockAcquired, error: lockError } = await supabase.rpc('try_acquire_publication_worker', {
      _worker_id: workerId,
      _ttl_seconds: 240,
    });

    if (lockError) throw lockError;
    if (!lockAcquired) {
      return new Response(JSON.stringify({ success: true, message: 'Fila já está em processamento' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['uazapi_server_url', 'uazapi_instance_token']);

    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;

    const uazapiUrl = settingsMap['uazapi_server_url'] || Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = settingsMap['uazapi_instance_token'] || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!uazapiUrl || !uazapiToken) {
      await supabase.rpc('release_publication_worker', { _worker_id: workerId });
      return new Response(JSON.stringify({ error: 'UazAPI não configurada' }), { status: 500, headers: corsHeaders });
    }

    let processed = 0;
    const maxPerRun = 30;
    const batchSize = 3;

    while (processed < maxPerRun) {
      const { data: jobs, error: claimError } = await supabase.rpc('claim_publication_queue', {
        _worker_id: workerId,
        _limit: Math.min(batchSize, maxPerRun - processed),
      });

      if (claimError) throw claimError;
      if (!jobs || jobs.length === 0) break;

      for (const job of jobs as any[]) {
        processed += 1;

        if (job.log_id) {
          await supabase.from('publication_logs').update({ status: 'processing' }).eq('id', job.log_id);
        }

        try {
          const { data: group } = await supabase
            .from('community_groups')
            .select('*')
            .eq('id', job.group_id)
            .single();

          if (!group) throw new Error('Grupo não encontrado');
          if (!job.message?.trim()) throw new Error('Mensagem vazia');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);
          let response: Response;

          try {
            const hasMedia = job.photo_url && !job.photo_url.startsWith('data:') && !job.photo_url.startsWith('blob:');
            const endpoint = hasMedia ? 'media' : 'text';
            const body = hasMedia
              ? { number: group.whatsapp_group_id, type: 'image', file: job.photo_url, text: job.message }
              : { number: group.whatsapp_group_id, text: job.message };

            response = await fetch(`${uazapiUrl}/send/${endpoint}?token=${uazapiToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify(body),
            });
          } finally {
            clearTimeout(timeoutId);
          }

          const result = await response.json().catch(() => ({}));
          const sanitized = sanitizeApiResponse(result);

          if (!response.ok) {
            throw new Error(sanitized?.error || sanitized?.message || 'Erro na API');
          }

          await supabase.from('publication_queue').update({
            status: 'sent',
            locked_at: null,
            locked_by: null,
            last_error: null,
            api_response: sanitized,
          }).eq('id', job.id);

          if (job.log_id) {
            await supabase.from('publication_logs').update({
              status: 'success',
              api_response: sanitized,
              message: job.message,
            }).eq('id', job.log_id);
          } else {
            await supabase.from('publication_logs').insert({
              ad_id: job.ad_id,
              group_id: job.group_id,
              status: 'success',
              api_response: sanitized,
              message: job.message,
            });
          }

          if (job.ad_id) {
            await supabase.from('ads').update({ status: 'published' }).eq('id', job.ad_id);
          }
        } catch (err: any) {
          const message = err?.name === 'AbortError' ? 'Timeout' : (err?.message || 'Erro inesperado');
          const shouldRetry = job.attempts < job.max_attempts;
          const nextRun = new Date(Date.now() + Math.min(job.attempts + 1, 5) * 60000).toISOString();

          await supabase.from('publication_queue').update({
            status: shouldRetry ? 'retry' : 'failed',
            locked_at: null,
            locked_by: null,
            next_run_at: shouldRetry ? nextRun : new Date().toISOString(),
            last_error: message,
            api_response: { error: message },
          }).eq('id', job.id);

          if (job.log_id) {
            await supabase.from('publication_logs').update({
              status: shouldRetry ? 'retry' : 'error',
              api_response: { error: message },
              message: job.message,
            }).eq('id', job.log_id);
          } else {
            await supabase.from('publication_logs').insert({
              ad_id: job.ad_id,
              group_id: job.group_id,
              status: shouldRetry ? 'retry' : 'error',
              api_response: { error: message },
              message: job.message,
            });
          }

          if (job.ad_id && !shouldRetry) {
            const { count: openCount } = await supabase
              .from('publication_queue')
              .select('id', { count: 'exact', head: true })
              .eq('ad_id', job.ad_id)
              .in('status', ['queued', 'processing', 'retry']);

            const { count: successCount } = await supabase
              .from('publication_logs')
              .select('id', { count: 'exact', head: true })
              .eq('ad_id', job.ad_id)
              .eq('status', 'success');

            if ((openCount || 0) === 0 && (successCount || 0) === 0) {
              await supabase.from('ads').update({ status: 'error' }).eq('id', job.ad_id);
            }
          }
        }

        await delay(700);
      }
    }

    await supabase.rpc('release_publication_worker', { _worker_id: workerId });

    const { count: pendingCount } = await supabase
      .from('publication_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued', 'retry'])
      .lte('next_run_at', new Date().toISOString());

    if ((pendingCount || 0) > 0) {
      EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/processar-fila-publicacao`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chained: true }),
      }).catch(() => null));
    }

    return new Response(JSON.stringify({ success: true, processed, pending: pendingCount || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    await supabase.rpc('release_publication_worker', { _worker_id: workerId }).catch(() => null);
    console.error('Erro ao processar fila:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});