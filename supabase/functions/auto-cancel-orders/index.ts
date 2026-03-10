import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIMEOUT_MINUTES = 60;
const WARNING_MINUTES = 50; // Warn 10 minutes before auto-cancel

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cancelCutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString();
    const warningCutoff = new Date(Date.now() - WARNING_MINUTES * 60 * 1000).toISOString();

    // --- 1. Warn students whose orders are pending for 50+ minutes but less than 60 ---
    const { data: warningOrders, error: warningFetchError } = await supabase
      .from("orders")
      .select("id, student_id, notes")
      .eq("status", "pending")
      .lt("created_at", warningCutoff)
      .gte("created_at", cancelCutoff);

    if (warningFetchError) {
      console.error("Error fetching warning orders:", warningFetchError);
    }

    let warned = 0;
    if (warningOrders && warningOrders.length > 0) {
      for (const order of warningOrders) {
        // Check if we already sent a warning for this order (avoid duplicates)
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("order_id", order.id)
          .eq("type", "auto_cancel_warning")
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("notifications").insert({
          user_id: order.student_id,
          title: "⏰ Order expiring soon!",
          message: `Order #${order.id.slice(0, 8)} will be auto-cancelled in ~10 minutes if the vendor doesn't respond.`,
          type: "auto_cancel_warning",
          order_id: order.id,
        });
        warned++;
      }
    }

    // --- 2. Cancel orders older than 60 minutes ---
    const { data: staleOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id, student_id")
      .eq("status", "pending")
      .lt("created_at", cancelCutoff);

    if (fetchError) {
      console.error("Error fetching stale orders:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!staleOrders || staleOrders.length === 0) {
      return new Response(JSON.stringify({ cancelled: 0, warned }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const ids = staleOrders.map((o) => o.id);

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled", notes: "Auto-cancelled: vendor did not respond within 1 hour" })
      .in("id", ids);

    if (updateError) {
      console.error("Error cancelling orders:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    // Notify students about cancellation
    for (const order of staleOrders) {
      await supabase.from("notifications").insert({
        user_id: order.student_id,
        title: "Order Auto-Cancelled ❌",
        message: `Order #${order.id.slice(0, 8)} was cancelled because the vendor didn't respond within 1 hour.`,
        type: "order_update",
        order_id: order.id,
      });
    }

    console.log(`Auto-cancelled ${ids.length} order(s), warned ${warned} order(s)`);

    return new Response(JSON.stringify({ cancelled: ids.length, warned, order_ids: ids }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
