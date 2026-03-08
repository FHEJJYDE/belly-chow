import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIMEOUT_MINUTES = 15;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString();

    // Find pending orders older than the timeout
    const { data: staleOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    if (fetchError) {
      console.error("Error fetching stale orders:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!staleOrders || staleOrders.length === 0) {
      return new Response(JSON.stringify({ cancelled: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const ids = staleOrders.map((o) => o.id);

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled", notes: "Auto-cancelled: vendor did not respond within 15 minutes" })
      .in("id", ids);

    if (updateError) {
      console.error("Error cancelling orders:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    console.log(`Auto-cancelled ${ids.length} order(s):`, ids);

    return new Response(JSON.stringify({ cancelled: ids.length, order_ids: ids }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
