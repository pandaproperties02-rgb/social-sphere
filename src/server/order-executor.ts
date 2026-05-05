import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractVideoId, getVideoMetrics } from "./tiktok.server";

// Try to capture a real "start_count" baseline from TikTok before delivery.
// Returns null when the link isn't TikTok or the API isn't configured.
async function tiktokBaseline(link: string, serviceName: string): Promise<number | null> {
  if (!/tiktok\.com/i.test(link)) return null;
  const id = extractVideoId(link);
  if (!id) return null;
  try {
    const m = await getVideoMetrics(id);
    if (!m) return null;
    const n = serviceName.toLowerCase();
    if (n.includes("like")) return m.likes;
    if (n.includes("view")) return m.views;
    if (n.includes("comment")) return m.comments;
    if (n.includes("share")) return m.shares;
    return m.views;
  } catch (e) {
    console.warn("[tiktok baseline]", (e as Error).message);
    return null;
  }
}

// TODO: Initialize API clients with credentials
// const ig = new IgApiClient();
// const fbApi = FacebookAdsApi.init(accessToken);

const executionHandlers: Record<string, (order: any) => Promise<void>> = {
  // Followers execution
  async followers(order) {
    console.log(`Executing followers order #${order.id}: ${order.quantity} followers for ${order.link}`);
    // TODO: Implement Instagram/TikTok follower delivery
    // Example for Instagram:
    // await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
    // const targetUser = await ig.user.searchExact(order.link);
    // // Use automation to follow targetUser multiple times or use business API
    // For now, simulate
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`Followers delivered for order #${order.id}`);
  },

  // Likes execution
  async likes(order) {
    console.log(`Executing likes order #${order.id}: ${order.quantity} likes for ${order.link}`);
    // TODO: Implement social media like delivery
    // For Instagram: Use private API to like posts
    // For TikTok: Use API to like videos
    // For now, simulate
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(`Likes delivered for order #${order.id}`);
  },

  // Views execution
  async views(order) {
    console.log(`Executing views order #${order.id}: ${order.quantity} views for ${order.link}`);
    // TODO: Implement YouTube/TikTok view delivery
    // May require proxies or automation
    // For now, simulate
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Views delivered for order #${order.id}`);
  },

  // Default handler for other services
  async default(order) {
    console.log(`Executing generic order #${order.id} for service ${order.service_id}`);
    // TODO: Implement generic execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Generic execution completed for order #${order.id}`);
  }
};

// Main execution function
export async function executeOrder(orderId: number): Promise<boolean> {
  try {
    // Fetch order with service details
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        link,
        quantity,
        services (
          name
        )
      `)
      .eq("id", orderId)
      .single();

    if (error || !order) {
      console.error(`Failed to fetch order ${orderId}:`, error);
      return false;
    }

    // Determine service type from name
    const serviceName = order.services?.name?.toLowerCase() || "";
    let handler = executionHandlers.default;

    if (serviceName.includes("follower")) {
      handler = executionHandlers.followers;
    } else if (serviceName.includes("like")) {
      handler = executionHandlers.likes;
    } else if (serviceName.includes("view")) {
      handler = executionHandlers.views;
    }

    // Execute the order
    await handler(order);

    // For TikTok orders, capture a verified start_count via the public TikTok API.
    const baseline = await tiktokBaseline(order.link, serviceName);

    // Mark order as completed
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "completed",
        remains: 0,
        ...(baseline !== null ? { start_count: baseline } : {}),
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(`Failed to update order ${orderId}:`, updateError);
      return false;
    }

    console.log(`Order ${orderId} execution completed successfully`);
    return true;

  } catch (error) {
    console.error(`Execution failed for order ${orderId}:`, error);
    return false;
  }
}

// Batch execution for multiple orders
export async function executeOrders(orderIds: number[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const orderId of orderIds) {
    const result = await executeOrder(orderId);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}