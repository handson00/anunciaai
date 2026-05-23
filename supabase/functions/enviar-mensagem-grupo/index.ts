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

    console.log(`Queueing manual message to group: ${group.name} (${group.whatsapp_group_id})`);

    const { data: queuedLog, error: logError } = await supabase.from('publication_logs').insert({
      group_id: group.id,
      status: 'queued',
      api_response: { queued: true, manual: true },
      message: message,
    }).select('id').single();

    if (logError || !queuedLog) {
      return new Response(JSON.stringify({ error: 'Erro ao criar log da fila' }), { status: 500, headers: corsHeaders });
    }

    const { error: queueError } = await supabase.from('publication_queue').insert({
      group_id: group.id,
      log_id: queuedLog.id,
      message,
      status: 'queued',
      created_by: userId,
    });

    if (queueError) {
      return new Response(JSON.stringify({ error: 'Erro ao enfileirar mensagem' }), { status: 500, headers: corsHeaders });
    }

    EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/processar-fila-publicacao`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'manual' }),
    }).catch((err) => console.error('Queue processor trigger failed:', err.message)));

    return new Response(JSON.stringify({ success: true, queued: true, message: 'Mensagem enfileirada para envio' }), {
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