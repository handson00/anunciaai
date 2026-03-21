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
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    // Check admin
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await serviceClient.from('profiles').select('is_admin').eq('user_id', user.id).single();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers: corsHeaders });
    }

    const uazapiUrl = Deno.env.get('UAZAPI_SERVER_URL');
    const uazapiToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!uazapiUrl || !uazapiToken) {
      return new Response(JSON.stringify({ error: 'UazAPI não configurada' }), { status: 500, headers: corsHeaders });
    }

    // Fetch groups from UazAPI - uses query string auth
    const response = await fetch(`${uazapiUrl}/group/list?token=${uazapiToken}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('UazAPI error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Erro ao buscar grupos: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawData = await response.json();
    
    // UazAPI may return array directly or wrapped in an object
    const groups = Array.isArray(rawData) ? rawData : (rawData.groups || rawData.data || []);
    
    // Log first group structure to understand fields
    if (groups.length > 0) {
      console.log('First group keys:', JSON.stringify(Object.keys(groups[0])));
      console.log('First group sample:', JSON.stringify(groups[0]).substring(0, 500));
    }
    
    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
