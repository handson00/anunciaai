import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIFY_ACTOR = 'apify~instagram-scraper'

async function fetchApifyPosts(username: string, token: string, limit = 5): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=120`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: 'posts',
      resultsLimit: limit,
      addParentData: false,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const apifyToken = Deno.env.get('APIFY_API_TOKEN')
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const isInternal = token && token === serviceKey
    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const isCron = body?.cron === true

    if (!isInternal && !isCron) {
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

    if (!apifyToken) {
      return new Response(JSON.stringify({ error: 'APIFY_API_TOKEN não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Teste rápido de um username (preview de posts sem enfileirar)
    if (body?.action === 'test_username') {
      const username = String(body.username || '').replace('@', '').trim()
      if (!username) {
        return new Response(JSON.stringify({ error: 'username obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const posts = await fetchApifyPosts(username, apifyToken, 3)
      return new Response(JSON.stringify({
        success: true,
        username,
        count: posts.length,
        preview: posts.slice(0, 3).map((p: any) => ({
          id: p.id || p.shortCode,
          caption: (p.caption || '').slice(0, 120),
          url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
          image: p.displayUrl,
        })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        const username = String(monitor.username || '').replace('@', '').trim()
        if (!username) continue

        const posts = await fetchApifyPosts(username, apifyToken, 5)
        if (posts.length === 0) {
          await supabase.from('instagram_monitors').update({ last_checked_at: new Date().toISOString() }).eq('id', monitor.id)
          results.push({ username, info: 'sem posts' })
          continue
        }

        const normalized = posts.map((p: any) => ({
          id: p.id || p.shortCode,
          caption: p.caption || '',
          image: p.displayUrl || null,
          permalink: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
        }))

        // Primeira execução: só marca o último
        if (!monitor.last_post_id) {
          await supabase.from('instagram_monitors').update({
            last_post_id: normalized[0].id,
            last_checked_at: new Date().toISOString(),
          }).eq('id', monitor.id)
          results.push({ username, initialized: true, last_post: normalized[0].id })
          continue
        }

        const newPosts: any[] = []
        for (const p of normalized) {
          if (p.id === monitor.last_post_id) break
          newPosts.push(p)
        }

        if (newPosts.length === 0) {
          await supabase.from('instagram_monitors').update({ last_checked_at: new Date().toISOString() }).eq('id', monitor.id)
          continue
        }

        for (const post of newPosts.reverse()) {
          const message = `📸 *Nova publicação de @${username}*\n\n${post.caption}\n\n🔗 Ver no Instagram: ${post.permalink || ''}`
          for (const group of activeGroups) {
            await supabase.from('publication_queue').insert({
              group_id: group.id,
              message,
              photo_url: post.image,
              status: 'queued',
            })
          }
          totalNewPosts += 1
        }

        await supabase.from('instagram_monitors').update({
          last_post_id: normalized[0].id,
          last_checked_at: new Date().toISOString(),
        }).eq('id', monitor.id)

        results.push({ username, new_posts: newPosts.length, groups: activeGroups.length })
      } catch (err: any) {
        results.push({ username: monitor.username, error: err.message })
      }
    }

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
