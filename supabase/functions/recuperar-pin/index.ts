import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    if (!phone) {
      return new Response(JSON.stringify({ success: false, error: 'Telefone obrigatório' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if phone exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: 'Telefone não cadastrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expire old codes for this phone
    await supabase
      .from("recovery_codes")
      .delete()
      .eq("phone", phone);

    // Insert new code (expires in 10 minutes)
    await supabase
      .from("recovery_codes")
      .insert({
        phone,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    // Send code via WhatsApp using UazAPI
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["uazapi_server_url", "uazapi_instance_token"]);

    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;

    const uazapiUrl = settingsMap["uazapi_server_url"] || Deno.env.get("UAZAPI_SERVER_URL");
    const uazapiToken = settingsMap["uazapi_instance_token"] || Deno.env.get("UAZAPI_INSTANCE_TOKEN");

    if (!uazapiUrl || !uazapiToken) {
      console.log("UazAPI not configured, code:", code);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone for WhatsApp (add 55 country code if needed)
    const whatsappPhone = phone.startsWith("55") ? phone : `55${phone}`;

    const message = `🔐 *anunciaAI - Recuperação de PIN*\n\nSeu código de recuperação é: *${code}*\n\nEste código expira em 10 minutos.\n\n⚠️ Se você não solicitou, ignore esta mensagem.`;

    await fetch(`${uazapiUrl}/send/text?token=${uazapiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: whatsappPhone,
        message,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
