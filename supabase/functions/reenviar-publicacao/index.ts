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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
    const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['uazapi_server_url', 'uazapi_instance_token', 'site_url']);
    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;
    const uazapiUrl = settingsMap['uazapi_server_url'] || Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = settingsMap['uazapi_instance_token'] || Deno.env.get('UAZAPI_INSTANCE_TOKEN');
    const siteUrl = settingsMap['site_url'] || 'https://anunciaai.pro';

    if (!uazapiUrl || !uazapiToken) {
      return new Response(JSON.stringify({ error: 'UazAPI não configurada' }), { status: 500, headers: corsHeaders });
    }

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

    const isMedia = photoUrl && !photoUrl.startsWith('data:') && !photoUrl.startsWith('blob:');
    const endpoint = isMedia ? 'media' : 'text';
    const body = isMedia
      ? { number: group.whatsapp_group_id, type: 'image', file: photoUrl, text: caption }
      : { number: group.whatsapp_group_id, text: caption };

    console.log(`Reenviando para ${group.name} (${group.whatsapp_group_id})`);
    const response = await fetch(`${uazapiUrl}/send/${endpoint}?token=${uazapiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json().catch(() => ({}));
    const sanitized = { ...result };
    if (sanitized.content?.JPEGThumbnail) sanitized.content.JPEGThumbnail = '[thumbnail]';
    if (sanitized.content?.imageMessage?.jpegThumbnail) sanitized.content.imageMessage.jpegThumbnail = '[thumbnail]';

    // Insert new log entry (use service role, bypasses RLS check)
    await supabase.from('publication_logs').insert({
      ad_id: log.ad_id,
      group_id: log.group_id,
      status: response.ok ? 'success' : 'error',
      api_response: response.ok ? sanitized : { error: sanitized?.error || 'Falha no reenvio', details: sanitized },
      message: log.ad_id ? null : caption,
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao reenviar', details: sanitized }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Erro reenvio:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
