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

    // Verify user via JWT claims (works with signing-keys system)
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }
    const user = { id: claimsData.claims.sub as string };

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
      .select('name, store_name')
      .eq('user_id', user.id)
      .single();
    const advertiserName = profile?.store_name?.trim() || profile?.name || 'Anunciante';

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

    // Read settings from app_settings (priority) or env vars (fallback)
    const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['uazapi_server_url', 'uazapi_instance_token', 'webhook_url', 'site_url', 'post_to_status']);
    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;

    const siteUrl = settingsMap['site_url'] || Deno.env.get('SITE_URL') || 'https://anunciaai.pro';
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
    const caption = lines.join('\n');

    const uazapiUrl = settingsMap['uazapi_server_url'] || Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = settingsMap['uazapi_instance_token'] || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!uazapiUrl || !uazapiToken) {
      // Mark as published even without UazAPI config (for testing)
      await supabase.from('ads').update({ status: 'published' }).eq('id', anuncio_id);
      return new Response(JSON.stringify({ success: true, message: 'Publicado (UazAPI não configurada)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let photoUrl = ad.main_photo;

    // If main_photo is base64, upload to storage first to get a public URL
    if (photoUrl.startsWith('data:')) {
      console.log('Photo is base64, uploading to storage...');
      try {
        const matches = photoUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const path = `${ad.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('ad-photos')
            .upload(path, binaryData, { contentType: `image/${matches[1]}` });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('ad-photos').getPublicUrl(path);
            photoUrl = urlData.publicUrl;
            // Update the ad with the storage URL so future publishes work directly
            await supabase.from('ads').update({ main_photo: photoUrl }).eq('id', anuncio_id);
            console.log('Photo uploaded to storage:', photoUrl);
          } else {
            console.error('Storage upload error:', uploadError.message);
          }
        }
      } catch (uploadErr: any) {
        console.error('Error uploading base64 to storage:', uploadErr.message);
      }
    }

    console.log(`Queueing ${groups.length} group sends for ad ${anuncio_id}`);

    const { data: insertedLogs, error: logsError } = await supabase
      .from('publication_logs')
      .insert(groups.map((group) => ({
        ad_id: anuncio_id,
        group_id: group.id,
        status: 'queued',
        api_response: { queued: true },
        message: caption,
      })))
      .select('id, group_id');

    if (logsError) {
      console.error('Error creating queued logs:', logsError.message);
      return new Response(JSON.stringify({ error: 'Erro ao criar logs da fila' }), { status: 500, headers: corsHeaders });
    }

    const logByGroup = new Map((insertedLogs || []).map((log: any) => [log.group_id, log.id]));
    const { error: queueError } = await supabase.from('publication_queue').insert(groups.map((group) => ({
      ad_id: anuncio_id,
      group_id: group.id,
      log_id: logByGroup.get(group.id),
      message: caption,
      photo_url: photoUrl,
      status: 'queued',
      created_by: user.id,
    })));

    if (queueError) {
      console.error('Error queueing sends:', queueError.message);
      return new Response(JSON.stringify({ error: 'Erro ao enfileirar envios' }), { status: 500, headers: corsHeaders });
    }

    await supabase.from('ads').update({ status: 'published' }).eq('id', anuncio_id);

    EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/processar-fila-publicacao`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'publish' }),
    }).catch((err) => console.error('Queue processor trigger failed:', err.message)));


    // Post to WhatsApp Status (Stories) if enabled
    const postToStatus = settingsMap['post_to_status'];
    if (postToStatus === 'true' && uazapiUrl && uazapiToken) {
      try {
        console.log('Posting to WhatsApp Status...');
        const statusCaption = [
          `${emoji} *${catLabels[ad.category] || 'ANÚNCIO'}*`,
          '',
          `📦 ${ad.title}`,
          `💰 R$ ${Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          ad.region ? `📍 ${ad.region}` : '',
          '',
          `📝 ${ad.description.substring(0, 200)}${ad.description.length > 200 ? '...' : ''}`,
          '',
          `🔗 ${siteUrl}/ad/${ad.slug}`,
        ].filter(Boolean).join('\n');

        let statusResponse;
        if (!photoUrl.startsWith('data:') && !photoUrl.startsWith('blob:')) {
          // Send image status
          statusResponse = await fetch(`${uazapiUrl}/send/image-status?token=${uazapiToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: photoUrl,
              text: statusCaption,
              type: 'image',
            }),
          });
        } else {
          // Fallback: text-only status
          statusResponse = await fetch(`${uazapiUrl}/send/text-status?token=${uazapiToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: statusCaption,
            }),
          });
        }

        const statusResult = await statusResponse.json();
        console.log('Status post result:', JSON.stringify(statusResult).substring(0, 200));
      } catch (statusErr: any) {
        console.error('Error posting to Status:', statusErr.message);
        // Don't fail the whole publish if status posting fails
      }
    }

    // Update ad status
    const finalStatus = allSuccess ? 'published' : 'error';
    await supabase.from('ads').update({ status: finalStatus }).eq('id', anuncio_id);

    // Send webhook if configured
    const webhookUrl = settingsMap['webhook_url'];
    if (webhookUrl) {
      try {
        console.log('Sending webhook to:', webhookUrl);
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'ad_published',
            timestamp: new Date().toISOString(),
            ad: {
              id: ad.id,
              title: ad.title,
              description: ad.description,
              price: ad.price,
              category: ad.category,
              condition: ad.condition,
              brand: ad.brand,
              region: ad.region,
              contact_phone: ad.contact_phone,
              main_photo: ad.main_photo,
              photos: ad.photos,
              slug: ad.slug,
              status: finalStatus,
              link: `${siteUrl}/ad/${ad.slug}`,
            },
            advertiser: {
              name: advertiserName,
              user_id: user.id,
            },
            groups_sent: groups.map(g => ({ id: g.id, name: g.name, whatsapp_id: g.whatsapp_group_id })),
            all_success: allSuccess,
          }),
        });
        console.log('Webhook sent successfully');
      } catch (webhookErr: any) {
        console.error('Webhook error:', webhookErr.message);
      }
    }

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
