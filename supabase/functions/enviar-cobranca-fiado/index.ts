// Envia mensagens de cobrança automática de vendas fiado com due_date vencida
// Executada diariamente via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function onlyDigits(v: string) {
  return (v || "").replace(/\D+/g, "");
}

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k.toLowerCase()] ?? `{${k}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Config
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["billing_reminder_template", "uazapi_server_url", "uazapi_instance_token"]);

    const cfg: Record<string, string> = {};
    (settings || []).forEach((r: any) => (cfg[r.key] = r.value));

    const template =
      cfg.billing_reminder_template ||
      Deno.env.get("BILLING_REMINDER_TEMPLATE") ||
      "Olá {nome}! Passando para lembrar do pagamento de *{produto}* no valor de *R$ {valor}*. Qualquer dúvida estou à disposição.";

    const serverUrl = cfg.uazapi_server_url || Deno.env.get("UAZAPI_SERVER_URL");
    const token = cfg.uazapi_instance_token || Deno.env.get("UAZAPI_INSTANCE_TOKEN");

    if (!serverUrl || !token) {
      return new Response(JSON.stringify({ error: "UazAPI não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar vendas fiado com cobrança pendente hoje/atraso
    const today = new Date().toISOString().slice(0, 10);
    const { data: sales, error } = await supabase
      .from("stock_sales")
      .select("id,customer_name,customer_phone,due_date,total,amount_paid,product_id,stock_products(name)")
      .eq("payment_type", "installment")
      .lte("due_date", today)
      .is("reminder_sent_at", null)
      .not("customer_phone", "is", null);

    if (error) throw error;

    const results: any[] = [];
    for (const s of sales || []) {
      const remaining = Number((s as any).total) - Number((s as any).amount_paid || 0);
      if (remaining <= 0.001) {
        await supabase.from("stock_sales").update({ reminder_sent_at: new Date().toISOString() }).eq("id", s.id);
        continue;
      }
      const phone = onlyDigits((s as any).customer_phone || "");
      if (!phone) continue;

      const message = renderTemplate(template, {
        nome: (s as any).customer_name || "cliente",
        produto: (s as any).stock_products?.name || "produto",
        valor: remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      });

      try {
        const resp = await fetch(`${serverUrl.replace(/\/$/, "")}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token },
          body: JSON.stringify({ number: phone, text: message }),
        });
        const ok = resp.ok;
        const body = await resp.text();
        if (ok) {
          await supabase.from("stock_sales").update({ reminder_sent_at: new Date().toISOString() }).eq("id", s.id);
        }
        results.push({ sale_id: s.id, ok, status: resp.status, body: body.slice(0, 300) });
      } catch (e) {
        results.push({ sale_id: s.id, ok: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
