import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory IP rate limiter
const ipMap = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 10 * 60_000;
const IP_MAX = 10;

function ipLimited(ip: string): boolean {
  const now = Date.now();
  const e = ipMap.get(ip);
  if (!e || now > e.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > IP_MAX;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  // Generic success response — used to avoid leaking whether phone exists or rate state
  const genericSuccess = () => new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );

  if (ipLimited(ip)) {
    return genericSuccess();
  }

  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== 'string' || phone.length < 10 || phone.length > 15) {
      return genericSuccess();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Per-phone cooldown: at most 3 codes per 10 minutes, and 60s between requests
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("recovery_codes")
      .select("id, created_at")
      .eq("phone", phone)
      .gte("created_at", tenMinAgo);

    if (recent && recent.length >= 3) {
      // Silently swallow — generic success, no enumeration / no spam
      return genericSuccess();
    }
    if (recent && recent.length > 0) {
      const last = recent
        .map((r) => new Date(r.created_at).getTime())
        .sort((a, b) => b - a)[0];
      if (Date.now() - last < 60_000) {
        return genericSuccess();
      }
    }

    // Check if phone exists — but never leak the result to the caller
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (!profile) {
      // Pretend success — do not reveal that the phone is unregistered
      return genericSuccess();
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expire old codes for this phone
    await supabase
      .from("recovery_codes")
      .delete()
      .eq("phone", phone);

    await supabase
      .from("recovery_codes")
      .insert({
        phone,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["uazapi_server_url", "uazapi_instance_token"]);

    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;

    const uazapiUrl = settingsMap["uazapi_server_url"] || Deno.env.get("UAZAPI_SERVER_URL");
    const uazapiToken = settingsMap["uazapi_instance_token"] || Deno.env.get("UAZAPI_INSTANCE_TOKEN");

    if (!uazapiUrl || !uazapiToken) {
      console.log("UazAPI not configured");
      return genericSuccess();
    }

    const whatsappPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const message = `🔐 *anunciaAI - Recuperação de PIN*\n\nSeu código de recuperação é: *${code}*\n\nEste código expira em 10 minutos.\n\n⚠️ Se você não solicitou, ignore esta mensagem.`;

    const whatsappResponse = await fetch(`${uazapiUrl}/send/text?token=${uazapiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: whatsappPhone, text: message }),
    });

    if (!whatsappResponse.ok) {
      const responseText = await whatsappResponse.text();
      console.error("UazAPI error:", whatsappResponse.status, responseText);
      // Still return generic success to avoid leaking
      return genericSuccess();
    }

    return genericSuccess();
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
