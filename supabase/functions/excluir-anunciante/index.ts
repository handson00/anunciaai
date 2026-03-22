import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { user_id } = await req.json();

  if (!user_id) {
    return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("user_id", caller.id)
    .single();

  if (!callerProfile?.is_admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  // Delete user's ads
  await supabaseAdmin.from("ads").delete().eq("user_id", user_id);

  // Delete user's profile
  await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

  // Delete auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
