import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const catLabels: Record<string, string> = {
  automobile: 'AUTOMÓVEL', product: 'PRODUTO', property: 'IMÓVEL', service: 'SERVIÇO',
};
const catEmoji: Record<string, string> = {
  automobile: '🚗', product: '🛒', property: '🏠', service: '🔧',
};

// Compute HH:MM and YYYY-MM-DD in America/Sao_Paulo (UTC-3, no DST since 2019).
function brtNow() {
  const now = new Date();
  const brtMs = now.getTime() - 3 * 60 * 60 * 1000;
  const d = new Date(brtMs);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { hh, mm, hour: d.getUTCHours(), minute: d.getUTCMinutes(), date, minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function slotToMinutes(slot: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(slot.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

async function enqueueAd(supabase: any, scheduleUserId: string, adId: string, settingsMap: Record<string, string>) {
  const { data: ad } = await supabase.from('ads').select('*').eq('id', adId).single();
  if (!ad) throw new Error('Anúncio não encontrado');

  const { data: profile } = await supabase.from('profiles').select('name, store_name').eq('user_id', ad.user_id).single();
  const advertiserName = profile?.store_name?.trim() || profile?.name || 'Anunciante';

  const { data: groups } = await supabase.from('community_groups').select('*').eq('active', true);
  if (!groups || groups.length === 0) return { queued: 0 };

  const siteUrl = settingsMap['site_url'] || 'https://anunciaai.pro';
  const emoji = catEmoji[ad.category] || '📦';
  const lines = [
    `${emoji} *${catLabels[ad.category] || 'ANÚNCIO'}*`, '',
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

  const { data: insertedLogs, error: logsError } = await supabase
    .from('publication_logs')
    .insert(groups.map((g: any) => ({
      ad_id: adId, group_id: g.id, status: 'queued',
      api_response: { queued: true, source: 'schedule' }, message: caption,
    })))
    .select('id, group_id');

  if (logsError) throw new Error('logs: ' + logsError.message);
  const logByGroup = new Map((insertedLogs || []).map((l: any) => [l.group_id, l.id]));

  const { error: qErr } = await supabase.from('publication_queue').insert(groups.map((g: any) => ({
    ad_id: adId, group_id: g.id, log_id: logByGroup.get(g.id),
    message: caption, photo_url: ad.main_photo, status: 'queued',
    created_by: scheduleUserId,
  })));
  if (qErr) throw new Error('queue: ' + qErr.message);

  return { queued: groups.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: settings } = await supabase.from('app_settings').select('key, value')
      .in('key', ['site_url']);
    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) settingsMap[s.key] = s.value;

    const now = brtNow();

    const { data: schedules } = await supabase
      .from('ad_schedules')
      .select('id, ad_id, user_id, times, active')
      .eq('active', true);

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, now: `${now.hh}:${now.mm}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;
    const results: any[] = [];

    for (const sch of schedules) {
      // Confirm the owner still has the feature enabled (or is admin)
      const { data: allowed } = await supabase.rpc('has_feature', { _user_id: sch.user_id, _key: 'ad_scheduling' });
      if (!allowed) continue;

      for (const slot of (sch.times || [])) {
        const slotMin = slotToMinutes(slot);
        if (slotMin === null) continue;
        // Trigger only when we've reached the slot and are within a 15-min window
        // (cron runs every 5 min; window absorbs skips).
        const delta = now.minutesOfDay - slotMin;
        if (delta < 0 || delta > 15) continue;

        // Reserve the slot atomically via unique constraint
        const { error: insErr } = await supabase.from('ad_schedule_runs').insert({
          schedule_id: sch.id, run_date: now.date, slot,
        });
        if (insErr) {
          // duplicate → already ran today
          continue;
        }

        try {
          const r = await enqueueAd(supabase, sch.user_id, sch.ad_id, settingsMap);
          await supabase.from('ad_schedule_runs')
            .update({ status: 'ok', detail: `${r.queued} grupo(s)` })
            .eq('schedule_id', sch.id).eq('run_date', now.date).eq('slot', slot);
          await supabase.from('ad_schedules').update({ last_run_at: new Date().toISOString() }).eq('id', sch.id);
          processed++;
          results.push({ schedule: sch.id, slot, queued: r.queued });
        } catch (err: any) {
          await supabase.from('ad_schedule_runs')
            .update({ status: 'error', detail: err.message?.slice(0, 300) })
            .eq('schedule_id', sch.id).eq('run_date', now.date).eq('slot', slot);
          results.push({ schedule: sch.id, slot, error: err.message });
        }
      }
    }

    if (processed > 0) {
      // Kick queue processor once
      EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/processar-fila-publicacao`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'schedule' }),
      }).catch(() => {}));
    }

    return new Response(JSON.stringify({ processed, now: `${now.hh}:${now.mm}`, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('sched error', err);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
