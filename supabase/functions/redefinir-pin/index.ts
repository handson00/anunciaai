import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory rate limiter for invalid attempts (per IP and per phone)
const ipMap = new Map<string, { count: number; resetAt: number }>();
const phoneMap = new Map<string, { fails: number; resetAt: number }>();
const WINDOW_MS = 10 * 60_000;
const IP_MAX = 30;
const PHONE_MAX_FAILS = 5;

function ipLimited(ip: string): boolean {
  const now = Date.now();
  const e = ipMap.get(ip);
  if (!e || now > e.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > IP_MAX;
}

function phoneLocked(phone: string): boolean {
  const now = Date.now();
  const e = phoneMap.get(phone);
  if (!e || now > e.resetAt) return false;
  return e.fails >= PHONE_MAX_FAILS;
}

function recordFail(phone: string) {
  const now = Date.now();
  const e = phoneMap.get(phone);
  if (!e || now > e.resetAt) {
    phoneMap.set(phone, { fails: 1, resetAt: now + WINDOW_MS });
  } else {
    e.fails += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  const fail = (msg: string) => new Response(
    JSON.stringify({ success: false, error: msg }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );

  if (ipLimited(ip)) {
    return fail('Muitas tentativas. Tente novamente mais tarde.');
  }

  try {
    const { phone, code, newPin } = await req.json();

    if (!phone || !code || !newPin || typeof phone !== 'string' || typeof code !== 'string' || typeof newPin !== 'string') {
      return fail('Dados inválidos');
    }
    if (phone.length < 10 || phone.length > 15 || code.length !== 6 || newPin.length !== 4) {
      return fail('Dados inválidos');
    }
    if (!/^\d+$/.test(code) || !/^\d+$/.test(newPin)) {
      return fail('Dados inválidos');
    }

    if (phoneLocked(phone)) {
      return fail('Muitas tentativas. Solicite um novo código.');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: recovery } = await supabase
      .from("recovery_codes")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!recovery) {
      recordFail(phone);
      return fail('Código inválido ou expirado');
    }

    await supabase
      .from("recovery_codes")
      .update({ used: true })
      .eq("id", recovery.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .single();

    if (!profile) {
      return fail('Usuário não encontrado');
    }

    const newPassword = `${phone}_${newPin}`;
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return fail('Erro ao redefinir PIN');
    }

    await supabase
      .from("recovery_codes")
      .delete()
      .eq("phone", phone);

    // Reset phone fail counter on success
    phoneMap.delete(phone);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error("Error:", err);
    return fail('Erro interno');
  }
});
