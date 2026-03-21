import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    const { anuncio_id } = await req.json();
    if (!anuncio_id) {
      return new Response(JSON.stringify({ error: 'anuncio_id é obrigatório' }), { status: 400, headers: corsHeaders });
    }

    // Fetch ad
    const { data: ad, error: adError } = await supabase
      .from('ads')
      .select('*')
      .eq('id', anuncio_id)
      .single();

    if (adError || !ad) {
      return new Response(JSON.stringify({ error: 'Anúncio não encontrado' }), { status: 404, headers: corsHeaders });
    }

    // Verify ownership
    if (ad.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers: corsHeaders });
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .single();

    // Fetch active groups
    const { data: groups } = await supabase
      .from('community_groups')
      .select('*')
      .eq('active', true);

    if (!groups || groups.length === 0) {
      // No groups, just mark as published
      await supabase.from('ads').update({ status: 'published' }).eq('id', anuncio_id);
      return new Response(JSON.stringify({ success: true, message: 'Publicado (sem grupos ativos)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build caption
    const catLabels: Record<string, string> = {
      automobile: 'AUTOMÓVEL', product: 'PRODUTO', property: 'IMÓVEL', service: 'SERVIÇO',
    };
    const catEmoji: Record<string, string> = {
      automobile: '🚗', product: '🛒', property: '🏠', service: '🔧',
    };

    const siteUrl = Deno.env.get('SITE_URL') || 'https://anunciai.com';
    const emoji = catEmoji[ad.category] || '📦';
    const lines = [
      `${emoji} *${catLabels[ad.category] || 'ANÚNCIO'}*`,
      '',
      `🏪 ${profile?.name || 'Anunciante'}`,
      `📦 ${ad.title}`,
      `💰 R$ ${Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ];
    if (ad.region) lines.push(`📍 ${ad.region}`);
    if (ad.brand) lines.push(`🏷️ Marca: ${ad.brand}`);
    if (ad.condition) lines.push(`📋 ${ad.condition === 'new' ? 'Novo' : 'Usado'}`);
    lines.push('', `📝 ${ad.description}`, '', `📞 Contato: ${ad.contact_phone}`);
    lines.push('', `🔗 Ver mais fotos e detalhes:`, `${siteUrl}/ad/${ad.slug}`);
    const caption = lines.join('\n');

    // UazAPI integration
    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!uazapiUrl || !uazapiToken) {
      // Mark as published even without UazAPI config (for testing)
      await supabase.from('ads').update({ status: 'published' }).eq('id', anuncio_id);
      return new Response(JSON.stringify({ success: true, message: 'Publicado (UazAPI não configurada)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let allSuccess = true;

    for (const group of groups) {
      try {
        const response = await fetch(`${uazapiUrl}/sendImage?token=${uazapiToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: group.whatsapp_group_id,
            image: ad.main_photo,
            caption: caption,
          }),
        });

        const result = await response.json();

        // Log
        await supabase.from('publication_logs').insert({
          ad_id: anuncio_id,
          group_id: group.id,
          status: response.ok ? 'success' : 'error',
          api_response: result,
        });

        if (!response.ok) allSuccess = false;
      } catch (err: any) {
        await supabase.from('publication_logs').insert({
          ad_id: anuncio_id,
          group_id: group.id,
          status: 'error',
          api_response: { error: err.message },
        });
        allSuccess = false;
      }
    }

    // Update ad status
    await supabase.from('ads').update({
      status: allSuccess ? 'published' : 'error',
    }).eq('id', anuncio_id);

    return new Response(JSON.stringify({
      success: allSuccess,
      message: allSuccess ? 'Publicado em todos os grupos' : 'Publicado com erros em alguns grupos',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
