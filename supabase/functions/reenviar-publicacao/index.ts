import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).single();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), { status: 403, headers: corsHeaders });
    }

    const { log_id } = await req.json();
    if (!log_id) {
      return new Response(JSON.stringify({ error: 'log_id é obrigatório' }), { status: 400, headers: corsHeaders });
    }

    // Fetch log
    const { data: log, error: logError } = await supabase
      .from('publication_logs')
      .select('*')
      .eq('id', log_id)
      .single();

    if (logError || !log) {
      return new Response(JSON.stringify({ error: 'Log não encontrado' }), { status: 404, headers: corsHeaders });
    }

    // Fetch group
    const { data: group } = await supabase
      .from('community_groups')
      .select('*')
      .eq('id', log.group_id)
      .single();

    if (!group) {
      return new Response(JSON.stringify({ error: 'Grupo não encontrado' }), { status: 404, headers: corsHeaders });
    }

    // Settings
    const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['site_url']);
    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;
    const siteUrl = settingsMap['site_url'] || 'https://anunciaai.pro';

    let caption = log.message || '';
    let photoUrl: string | null = null;

    // If linked to an ad, rebuild caption with current ad data + photo
    if (log.ad_id) {
      const { data: ad } = await supabase.from('ads').select('*').eq('id', log.ad_id).single();
      if (ad) {
        const { data: prof } = await supabase.from('profiles').select('name, store_name').eq('user_id', ad.user_id).single();
        const advertiserName = prof?.store_name?.trim() || prof?.name || 'Anunciante';
        const catLabels: Record<string, string> = { automobile: 'AUTOMÓVEL', product: 'PRODUTO', property: 'IMÓVEL', service: 'SERVIÇO' };
        const catEmoji: Record<string, string> = { automobile: '🚗', product: '🛒', property: '🏠', service: '🔧' };
        const emoji = catEmoji[ad.category] || '📦';
        const lines = [
          `${emoji} *${catLabels[ad.category] || 'ANÚNCIO'}*`,
          '',
          `🏪 ${advertiserName}`,
          `📦 ${ad.title}`,
          `💰 R$ ${Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ];
        if (ad.region) lines.push(`📍 ${ad.region}`);
        if (ad.brand) lines.push(`🏷️ Marca: ${ad.brand}`);
        if (ad.condition) lines.push(`📋 ${ad.condition === 'new' ? 'Novo' : 'Usado'}`);
        lines.push('', `📝 ${ad.description}`, '', `📞 Contato: ${ad.contact_phone}`);
        lines.push('', `🔗 Ver mais fotos e detalhes:`, `${siteUrl}/ad/${ad.slug}`);
        caption = lines.join('\n');
        photoUrl = ad.main_photo;
      }
    }

    if (!caption) {
      return new Response(JSON.stringify({ error: 'Sem conteúdo para reenviar' }), { status: 400, headers: corsHeaders });
    }

    const { data: queuedLog, error: logInsertError } = await supabase.from('publication_logs').insert({
      ad_id: log.ad_id,
      group_id: log.group_id,
      status: 'queued',
      api_response: { queued: true, resent_from: log_id },
      message: caption,
    }).select('id').single();

    if (logInsertError || !queuedLog) {
      return new Response(JSON.stringify({ error: 'Erro ao criar log de reenvio' }), { status: 500, headers: corsHeaders });
    }

    const { error: queueError } = await supabase.from('publication_queue').insert({
      ad_id: log.ad_id,
      group_id: log.group_id,
      log_id: queuedLog.id,
      message: caption,
      photo_url: photoUrl,
      status: 'queued',
      created_by: userId,
    });

    if (queueError) {
      return new Response(JSON.stringify({ error: 'Erro ao enfileirar reenvio' }), { status: 500, headers: corsHeaders });
    }

    EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/processar-fila-publicacao`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'resend' }),
    }).catch((err) => console.error('Queue processor trigger failed:', err.message)));

    return new Response(JSON.stringify({ success: true, queued: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Erro reenvio:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
