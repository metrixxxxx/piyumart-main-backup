import "server-only";
import { db } from "@/lib/db";
import { recordOrderCommission } from "@/lib/bao-commission";
import { createNotificationRecord, broadcastNotification } from "@/lib/notify";
import { currentActor, financeLock, releaseOrderFunds, restoreOrderStock } from "@/lib/payments/ledger";
import { paymentError } from "@/lib/payments/paymongo";
import { uploadPickupProof, removePickupProof } from "@/lib/pickup-proof";
import { normalizeOrderStatus, orderStatusLabel } from "@/lib/orders/status";

const actionStatuses = {
  approve: "preparing", ready_for_pickup: "ready_for_pickup", confirm_receipt: "completed", cancel: "cancelled",
  quick_confirm: "ready_for_pickup",
  confirm: "preparing", process: "preparing", ship: "ready_for_pickup", confirm_delivery: "completed",
};
const requiredPreviousStatus = { preparing: "pending", ready_for_pickup: "preparing", completed: "ready_for_pickup" };

function checkTransition(order, status, buyer, seller, quickConfirm) {
  if (!buyer && !seller) throw paymentError("Forbidden.", 403);
  const current = normalizeOrderStatus(order.status);
  if (quickConfirm && !seller) throw paymentError("Only the seller can quick confirm this order.", 403);
  if (status === "cancelled") {
    if (order.payment_method === "paymongo") throw paymentError("Cancel the unpaid checkout from its payment page. Paid orders require a confirmed PayMongo refund.", 409);
    if (current !== "pending" && !(seller && current === "preparing")) throw paymentError("This order can no longer be cancelled.", 409);
    return;
  }
  if (status === "completed" ? !buyer : !seller) throw paymentError("Forbidden.", 403);
  if (order.payment_method === "paymongo" && !["paid", "partially_refunded"].includes(order.payment_status)) {
    throw paymentError("Payment must be confirmed before fulfillment.", 409);
  }
  const expectedPreviousStatus = quickConfirm ? "pending" : requiredPreviousStatus[status];
  if (current !== expectedPreviousStatus) {
    throw paymentError(`The order must be "${orderStatusLabel(expectedPreviousStatus)}" first.`, 409);
  }
}

export async function transitionOrder(actorId, orderId, body, proofFile = null, { sellerOnly = false } = {}) {
  const quickConfirm = body?.action === "quick_confirm";
  if (quickConfirm && !sellerOnly) throw paymentError("Only the seller can quick confirm this order.", 403);
  const requested = quickConfirm ? "ready_for_pickup" : body?.status ?? actionStatuses[body?.action];
  if (typeof requested !== "string") throw paymentError("Invalid order update.", 400);
  const status = normalizeOrderStatus(requested);
  if (status !== "cancelled" && !Object.hasOwn(requiredPreviousStatus, status)) throw paymentError("Invalid order update.", 400);

  let proofUpload, result;
  try {
    result = await db.transaction(async client => {
      // Online fulfillment takes the same lock order as payment and refund events.
      const { rows: methods } = await client.query("SELECT payment_method FROM orders WHERE id=$1", [orderId]);
      if (!methods.length) throw paymentError("Order not found.", 404);
      const online = methods[0].payment_method === "paymongo";
      if (online) await financeLock(client);
      const actor = await currentActor(client, actorId, sellerOnly ? ["seller"] : ["user", "seller"]);
      const { rows } = await client.query(
        `SELECT o.*, (o.seller_id=$2 OR (o.seller_id IS NULL AND EXISTS (
           SELECT 1 FROM order_items i JOIN products p ON p.id=i.product_id
           WHERE i.order_id=o.id AND p.seller_id=$2
         ))) AS owns_sale FROM orders o WHERE o.id=$1 FOR UPDATE OF o`, [orderId, actorId]
      );
      const order = rows[0];
      if (!order) throw paymentError("Order not found.", 404);
      const seller = actor.role === "seller" && order.owns_sale;
      const buyer = !sellerOnly && String(actorId) === String(order.user_id);
      checkTransition(order, status, buyer, seller, quickConfirm);

      if (status === "completed") proofUpload = await uploadPickupProof(orderId, proofFile);
      if (status === "cancelled") await restoreOrderStock(client, order);
      const sellerCancelled = seller && status === "cancelled";
      const { rows: updated } = await client.query(
        `UPDATE orders SET status=$2::text,
           confirmed_at=CASE WHEN $2='preparing' OR $6 THEN now() ELSE confirmed_at END,
           seller_confirm_deadline=CASE WHEN $2 IN ('preparing','cancelled') OR $6 THEN NULL ELSE seller_confirm_deadline END,
           shipped_at=CASE WHEN $2='ready_for_pickup' THEN now() ELSE shipped_at END,
           completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END,
           cancelled_at=CASE WHEN $2='cancelled' THEN now() ELSE cancelled_at END,
           cancel_reason=COALESCE($4,cancel_reason), cancel_note=COALESCE($5,cancel_note),
           pickup_proof_path=COALESCE($3,pickup_proof_path),
           pickup_proof_uploaded_at=CASE WHEN $2='completed' THEN now() ELSE pickup_proof_uploaded_at END
         WHERE id=$1 RETURNING *`,
        [orderId, status, proofUpload?.path || null, sellerCancelled ? body.cancel_reason || "seller_unavailable" : null,
          sellerCancelled ? body.cancel_note || null : null, quickConfirm]
      );
      if (status === "completed") {
        await client.query(
          `UPDATE products p SET sold_count=COALESCE(p.sold_count,0)+items.quantity,
             stock=CASE WHEN $2 AND p.stock>=items.quantity THEN p.stock-items.quantity ELSE p.stock END
           FROM (SELECT product_id,SUM(quantity)::integer AS quantity FROM order_items WHERE order_id=$1 GROUP BY product_id) items
           WHERE p.id=items.product_id`, [orderId, !online && !order.stock_reserved]
        );
        if (online) await releaseOrderFunds(client, orderId);
        else await recordOrderCommission(client, orderId);
      }
      const messages = {
        preparing: `The seller approved order #${orderId} and is preparing your order.`,
        ready_for_pickup: quickConfirm
          ? `The seller confirmed an immediate campus meetup for order #${orderId}. After meeting, confirm receipt in My orders.`
          : `Order #${orderId} is ready for pickup. After collecting it, confirm receipt in My orders.`,
        completed: `Receipt confirmed for order #${orderId}. The proof of transaction has been saved.`,
        cancelled: `Order #${orderId} was cancelled.${sellerCancelled && body.cancel_note ? " " + body.cancel_note : ""}`,
      };
      const notification = await createNotificationRecord({
        userId: online && status === "completed" ? order.seller_id : order.user_id,
        type: online ? "payment" : (status === "preparing" || status === "ready_for_pickup") ? "order_status" : `order_${status}`,
        message: messages[status],
      }, client);
      const { pickup_proof_path, ...publicOrder } = updated[0];
      const hasProof = Boolean(pickup_proof_path);
      const response = { success: true, status, has_pickup_proof: hasProof };
      if (!online && !sellerOnly) response.order = { ...publicOrder, has_pickup_proof: hasProof };
      return { response, notification };
    });
  } catch (error) {
    await removePickupProof(proofUpload);
    throw error;
  }
  await broadcastNotification(result.notification);
  return result.response;
}
