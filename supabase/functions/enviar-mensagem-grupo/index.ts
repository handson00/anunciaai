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

    // Verify user via JWT claims (compatible with signing-keys system)
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), { status: 403, headers: corsHeaders });
    }

    const { group_id, message } = await req.json();
    if (!group_id || !message) {
      return new Response(JSON.stringify({ error: 'group_id e message são obrigatórios' }), { status: 400, headers: corsHeaders });
    }

    // Fetch group details
    const { data: group, error: groupError } = await supabase
      .from('community_groups')
      .select('*')
      .eq('id', group_id)
      .single();

    if (groupError || !group) {
      return new Response(JSON.stringify({ error: 'Grupo não encontrado' }), { status: 404, headers: corsHeaders });
    }

    // Read settings from app_settings
    const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['uazapi_server_url', 'uazapi_instance_token']);
    const settingsMap: Record<string, string> = {};
    if (settings) for (const s of settings) settingsMap[s.key] = s.value;

    const uazapiUrl = settingsMap['uazapi_server_url'] || Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = settingsMap['uazapi_instance_token'] || Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!uazapiUrl || !uazapiToken) {
      return new Response(JSON.stringify({ error: 'UazAPI não configurada' }), { status: 500, headers: corsHeaders });
    }

    console.log(`Sending manual message to group: ${group.name} (${group.whatsapp_group_id})`);

    const response = await fetch(`${uazapiUrl}/send/text?token=${uazapiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: group.whatsapp_group_id,
        text: message,
      }),
    });

    const result = await response.json();
    console.log(`Response for ${group.name}:`, JSON.stringify(result));

    // Log the action
    await supabase.from('publication_logs').insert({
      group_id: group.id,
      status: response.ok ? 'success' : 'error',
      api_response: result,
      message: message,
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Erro ao enviar mensagem via WhatsApp', details: result }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, message: 'Mensagem enviada com sucesso' }), {
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