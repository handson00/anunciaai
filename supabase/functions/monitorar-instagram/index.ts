import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IG_API = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Auth: admin OR internal (cron usa service role)
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const isInternal = token && token === serviceKey

    if (!isInternal) {
      const { data: claims } = await supabase.auth.getClaims(token)
      if (!claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders })
      }
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('user_id', claims.claims.sub as string).single()
      if (!profile?.is_admin) {
        return new Response(JSON.stringify({ error: 'Acesso restrito' }), { status: 403, headers: corsHeaders })
      }
    }

    const igToken = Deno.env.get('INSTAGRAM_GRAPH_TOKEN')
    if (!igToken) {
      return new Response(JSON.stringify({ error: 'INSTAGRAM_GRAPH_TOKEN não configurado' }), { status: 500, headers: corsHeaders })
    }

    const { data: monitors } = await supabase
      .from('instagram_monitors').select('*').eq('active', true)

    if (!monitors || monitors.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum perfil monitorado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: groups } = await supabase
      .from('community_groups').select('id').eq('active', true)

    const activeGroups = groups || []
    let totalNewPosts = 0
    const results: any[] = []

    for (const monitor of monitors as any[]) {
      try {
        const url = `${IG_API}/${monitor.ig_user_id}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username&limit=5&access_token=${igToken}`
        const response = await fetch(url)
        const data = await response.json()

        if (!response.ok) {
          results.push({ username: monitor.username, error: data?.error?.message || 'Erro IG API' })
          continue
        }

        const posts = (data.data || []) as any[]
        if (posts.length === 0) {
          await supabase.from('instagram_monitors').update({ last_checked_at: new Date().toISOString() }).eq('id', monitor.id)
          continue
        }

        // Primeira execução: apenas marca o último post sem disparar histórico
        if (!monitor.last_post_id) {
          await supabase.from('instagram_monitors').update({
            last_post_id: posts[0].id,
            last_checked_at: new Date().toISOString(),
          }).eq('id', monitor.id)
          results.push({ username: monitor.username, initialized: true, last_post: posts[0].id })
          continue
        }

        // Pega posts novos (até encontrar o último processado)
        const newPosts: any[] = []
        for (const p of posts) {
          if (p.id === monitor.last_post_id) break
          newPosts.push(p)
        }

        if (newPosts.length === 0) {
          await supabase.from('instagram_monitors').update({ last_checked_at: new Date().toISOString() }).eq('id', monitor.id)
          continue
        }

        // Enfileira do mais antigo pro mais novo
        for (const post of newPosts.reverse()) {
          const caption = post.caption || ''
          const mediaUrl = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url
          const username = post.username || monitor.username

          const message = `📸 *Nova publicação de @${username}*\n\n${caption}\n\n🔗 Ver no Instagram: ${post.permalink}`

          for (const group of activeGroups) {
            await supabase.from('publication_queue').insert({
              group_id: group.id,
              message,
              photo_url: mediaUrl || null,
              status: 'queued',
            })
          }
          totalNewPosts += 1
        }

        await supabase.from('instagram_monitors').update({
          last_post_id: posts[0].id,
          last_checked_at: new Date().toISOString(),
        }).eq('id', monitor.id)

        results.push({ username: monitor.username, new_posts: newPosts.length, groups: activeGroups.length })
      } catch (err: any) {
        results.push({ username: monitor.username, error: err.message })
      }
    }

    // Dispara processador da fila
    if (totalNewPosts > 0) {
      EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/processar-fila-publicacao`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chained: true }),
      }).catch(() => null))
    }

    return new Response(JSON.stringify({ success: true, total_new_posts: totalNewPosts, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Erro monitorar-instagram:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
