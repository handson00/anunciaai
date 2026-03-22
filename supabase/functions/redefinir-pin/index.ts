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
    const { phone, code, newPin } = await req.json();

    if (!phone || !code || !newPin || newPin.length !== 4) {
      return new Response(JSON.stringify({ success: false, error: 'Dados inválidos' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid recovery code
    const { data: recovery } = await supabase
      .from("recovery_codes")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!recovery) {
      return new Response(JSON.stringify({ success: false, error: 'Código inválido ou expirado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark code as used
    await supabase
      .from("recovery_codes")
      .update({ used: true })
      .eq("id", recovery.id);

    // Find the user by phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: 'Usuário não encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update password using admin API
    const newPassword = `${phone}_${newPin}`;
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(JSON.stringify({ success: false, error: 'Erro ao redefinir PIN' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean up old codes
    await supabase
      .from("recovery_codes")
      .delete()
      .eq("phone", phone);

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
