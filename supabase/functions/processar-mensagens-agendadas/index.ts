import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sanitize(result: any) {
  const s = { ...(result || {}) };
  if (s.content?.JPEGThumbnail) s.content.JPEGThumbnail = '[thumb]';
  if (s.content?.imageMessage?.jpegThumbnail) s.content.imageMessage.jpegThumbnail = '[thumb]';
  return s;
}

function computeNext(current: Date, recurrence: string): Date | null {
  const d = new Date(current);
  switch (recurrence) {
    case 'daily': d.setUTCDate(d.getUTCDate() + 1); return d;
    case 'weekly': d.setUTCDate(d.getUTCDate() + 7); return d;
    case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); return d;
    default: return null;
  }
}

async function sendViaUazapi(uazapiUrl: string, uazapiToken: string, groupId: string, msg: any, resolvedMediaUrl?: string) {
  const base = `${uazapiUrl}`;
  const tokenParam = `?token=${uazapiToken}`;
  const headers = { 'Content-Type': 'application/json' };
  let endpoint = '';
  let body: any = {};

  switch (msg.message_type) {
    case 'text':
      endpoint = '/send/text';
      body = { number: groupId, text: msg.text || '' };
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      endpoint = '/send/media';
      body = {
        number: groupId,
        type: msg.message_type,
        file: resolvedMediaUrl || msg.media_url,
        text: msg.text || '',
        docName: msg.file_name || undefined,
      };
      break;
    case 'poll':
      endpoint = '/send/menu';
      body = {
        number: groupId,
        type: 'poll',
        text: msg.text || '',
        choices: Array.isArray(msg.poll_options) ? msg.poll_options : [],
      };
      break;
    case 'buttons':
      endpoint = '/send/menu';
      body = {
        number: groupId,
        type: 'button',
        text: msg.text || '',
        choices: Array.isArray(msg.buttons) ? msg.buttons : [],
      };
      break;
    default:
      throw new Error(`Tipo não suportado: ${msg.message_type}`);
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`${base}${endpoint}${tokenParam}`, {
      method: 'POST', headers, signal: ctrl.signal, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(sanitize(j)?.error || sanitize(j)?.message || `HTTP ${r.status}`);
    return sanitize(j);
  } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['uazapi_server_url', 'uazapi_instance_token']);
    const map: Record<string, string> = {};
    for (const s of settings || []) map[s.key] = s.value;
    const uazapiUrl = map['uazapi_server_url'] || Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = map['uazapi_instance_token'] || Deno.env.get('UAZAPI_INSTANCE_TOKEN');
    if (!uazapiUrl || !uazapiToken) {
      return new Response(JSON.stringify({ error: 'UazAPI não configurada' }), { status: 500, headers: corsHeaders });
    }

    // Claim due jobs atomically
    const nowIso = new Date().toISOString();
    const { data: due } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('next_run_at', nowIso)
      .order('next_run_at', { ascending: true })
      .limit(10);

    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;

    for (const msg of due) {
      // Lock
      const { data: locked } = await supabase
        .from('scheduled_messages')
        .update({ status: 'running' })
        .eq('id', msg.id)
        .eq('status', 'pending')
        .select('id')
        .single();
      if (!locked) continue;

      processed++;
      const errors: string[] = [];

      // Resolve storage:// media URL to a signed URL (valid 7 days)
      let resolvedMediaUrl: string | undefined;
      if (msg.media_url && typeof msg.media_url === 'string' && msg.media_url.startsWith('storage://')) {
        const rest = msg.media_url.replace('storage://', '');
        const [bucket, ...pathParts] = rest.split('/');
        const path = pathParts.join('/');
        const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signErr || !signed) {
          console.error('Sign error:', signErr);
        } else {
          resolvedMediaUrl = signed.signedUrl;
        }
      }

      const { data: groups } = await supabase
        .from('community_groups')
        .select('id, name, whatsapp_group_id')
        .in('id', msg.group_ids || []);

      for (const g of groups || []) {
        try {
          const res = await sendViaUazapi(uazapiUrl, uazapiToken, g.whatsapp_group_id, msg, resolvedMediaUrl);
          await supabase.from('publication_logs').insert({
            group_id: g.id,
            status: 'success',
            message: msg.text || `[${msg.message_type}]`,
            api_response: { scheduled_id: msg.id, ...res },
          });
        } catch (err: any) {
          const m = err?.message || 'Erro';
          errors.push(`${g.name}: ${m}`);
          await supabase.from('publication_logs').insert({
            group_id: g.id,
            status: 'error',
            message: msg.text || `[${msg.message_type}]`,
            api_response: { scheduled_id: msg.id, error: m },
          });
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      const next = computeNext(new Date(msg.next_run_at), msg.recurrence);
      const update: any = {
        last_run_at: new Date().toISOString(),
        last_error: errors.length ? errors.join(' | ') : null,
      };
      if (next) {
        update.status = 'pending';
        update.next_run_at = next.toISOString();
      } else {
        update.status = errors.length === (groups?.length || 0) && (groups?.length || 0) > 0 ? 'error' : 'sent';
      }
      await supabase.from('scheduled_messages').update(update).eq('id', msg.id);
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Erro:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
