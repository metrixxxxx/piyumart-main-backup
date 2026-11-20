import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { createNotificationRecord } from "@/lib/notify";
import { cents,pesos } from "@/lib/payments/money";
import { closeUnpaidPayment,processRefundEvent,reconcilePayment } from "@/lib/payments/events";
import { currentActor,financeLock,restoreOrderStock,staffNotice } from "@/lib/payments/ledger";
import { paymongo,paymentError } from "@/lib/payments/paymongo";

async function notifyOrder(client,order,type,message,notifications) {
  notifications.push(await createNotificationRecord({userId:order.user_id,type,message},client));
  if(order.notification_seller_id) {
    notifications.push(await createNotificationRecord({
      userId:order.notification_seller_id,type,message,
    },client));
  }
}

async function loadOrder(client,orderId,lock=false) {
  const {rows}=await client.query(
    `SELECT o.*,COALESCE(o.seller_id,(SELECT p.seller_id FROM order_items i
      JOIN products p ON p.id=i.product_id WHERE i.order_id=o.id ORDER BY p.seller_id LIMIT 1))
      AS notification_seller_id
     FROM orders o WHERE o.id=$1${lock?" FOR UPDATE OF o":""}`,[orderId]
  );
  return rows[0]||null;
}

async function orderPayment(client,orderId) {
  const {rows}=await client.query(
    `SELECT p.*,a.order_id,a.seller_id AS allocation_seller_id,a.gross_amount,a.refunded_amount
     FROM payment_allocations a JOIN payments p ON p.id=a.payment_id
     WHERE a.order_id=$1 FOR UPDATE OF p,a`,[orderId]
  );
  if(!rows[0]) throw paymentError("The online order has no recorded payment allocation.",409);
  return rows[0];
}

async function cancelCashOrder(client,order,product,notifications) {
  await restoreOrderStock(client,order);
  await client.query(
    `UPDATE orders SET status='cancelled',cancelled_at=COALESCE(cancelled_at,now()),
     cancel_reason='product_suspended',cancel_note=$2 WHERE id=$1`,
    [order.id,`Product "${product.name}" was suspended by BAO.`]
  );
  await notifyOrder(
    client,order,"order_cancelled",
    `Order #${order.id} was cancelled because BAO suspended ${product.name}.`,notifications
  );
}

async function cancelAlreadyRefundedOrder(client,order,product,notifications) {
  await restoreOrderStock(client,order);
  await client.query(
    `UPDATE orders SET status='cancelled',payment_status='refunded',cancelled_at=COALESCE(cancelled_at,now()),
     cancel_reason='product_suspended',cancel_note=$2 WHERE id=$1`,
    [order.id,`Product "${product.name}" was suspended by BAO.`]
  );
  await notifyOrder(
    client,order,"order_cancelled",
    `Order #${order.id} was cancelled because BAO suspended ${product.name}. Its payment was already refunded.`,notifications
  );
}

async function closeUnpaidCheckout(client,payment,product,notifications,status="cancelled") {
  const {rows:orders}=await client.query(
    "SELECT order_id FROM payment_allocations WHERE payment_id=$1 ORDER BY order_id",[payment.id]
  );
  notifications.push(...await closeUnpaidPayment(client,payment,status,{
    reason:"product_suspended",
    note:`Online checkout cancelled because ${product.name} was suspended.`,
  }));
  return orders.map(order=>order.order_id);
}

async function recordOrderIssue(orderId,reason,message,staffMessage) {
  return db.transaction(async client=>{
    await financeLock(client);
    const order=await loadOrder(client,orderId,true);
    if(!order||order.status!=="pending") return {notifications:[],outcome:"cancelled"};
    await client.query("UPDATE orders SET cancel_reason=$2 WHERE id=$1",[orderId,reason]);
    const notifications=[];
    await notifyOrder(client,order,"payment",message,notifications);
    await staffNotice(client,staffMessage);
    return {notifications,outcome:reason.endsWith("_failed")?"failed":"pending"};
  });
}

async function completeRefundRequest(request) {
  let refund;
  try {
    refund=await paymongo("/v1/refunds",{method:"POST",attributes:{
      payment_id:request.providerPaymentId,
      amount:request.amount,
      reason:"others",
      notes:`PiyuMart product suspension refund. Order ${request.orderId}; request ${request.requestId}.`,
    }});
  } catch(error) {
    const definitive=Number.isInteger(error.status)&&error.status!==502;
    const reason=definitive?"product_suspended_refund_failed":"product_suspended_refund_pending";
    const outcome=await db.transaction(async client=>{
      await financeLock(client);
      const {rows:tracked}=await client.query(
        "SELECT status FROM payment_refunds WHERE provider_refund_id=$1 FOR UPDATE",[request.requestId]
      );
      if(!tracked[0]||tracked[0].status==="succeeded") {
        const order=await loadOrder(client,request.orderId);
        const cancelled=order?.status==="cancelled";
        return {notifications:[],outcome:cancelled?"cancelled":"pending",cancelledOrders:cancelled?[request.orderId]:[]};
      }
      await client.query("UPDATE payment_refunds SET status=$1,updated_at=now() WHERE provider_refund_id=$2",
        [definitive?"failed":"requesting",request.requestId]);
      const order=await loadOrder(client,request.orderId,true);
      if(!order||order.status!=="pending") return {notifications:[],outcome:"cancelled"};
      await client.query("UPDATE orders SET cancel_reason=$2 WHERE id=$1",[order.id,reason]);
      const message=definitive
        ? `PayMongo could not start the refund for order #${order.id}. The order is blocked until BAO reviews it.`
        : `The refund request for order #${order.id} is being reconciled. The order remains blocked until PayMongo confirms it.`;
      const notifications=[];
      await notifyOrder(client,order,"payment",message,notifications);
      if(definitive) {
        await staffNotice(client,`PayMongo could not start the product-suspension refund for order #${order.id}. BAO review is required.`);
      }
      return {notifications,outcome:definitive?"failed":"pending",cancelledOrders:[]};
    });
    return outcome;
  }

  const attributes=refund.attributes||{};
  if(!refund.id||attributes.payment_id!==request.providerPaymentId||
    attributes.livemode!==false||attributes.currency!=="PHP"||
    attributes.amount!==request.amount) {
    const outcome=await recordOrderIssue(
      request.orderId,"product_suspended_refund_pending",
      `The refund for order #${request.orderId} is being reconciled with PayMongo. The order remains blocked.`,
      `PayMongo returned an unverifiable refund for order #${request.orderId}; reconciliation is required.`
    );
    return outcome;
  }

  return db.transaction(async client=>{
    await financeLock(client);
    const notifications=[];
    const {rows:existing}=await client.query(
      "SELECT provider_refund_id FROM payment_refunds WHERE provider_refund_id=$1 FOR UPDATE",[refund.id]
    );
    if(!existing[0]) {
      await client.query(
        "UPDATE payment_refunds SET provider_refund_id=$1,updated_at=now() WHERE provider_refund_id=$2",
        [refund.id,request.requestId]
      );
    }
    if(!await processRefundEvent(client,refund,notifications)) {
      throw paymentError("The PayMongo refund could not be matched to its payment.",409);
    }
    if(attributes.status!=="succeeded"&&attributes.status!=="failed") {
      const order=await loadOrder(client,request.orderId,true);
      if(order?.status==="pending") {
        await notifyOrder(
          client,order,"payment",
          `A PayMongo refund was requested for order #${order.id}. The order remains blocked until the refund is confirmed.`,
          notifications
        );
      }
    }
    const {rows:orders}=await client.query("SELECT status,cancel_reason FROM orders WHERE id=$1",[request.orderId]);
    const outcome=orders[0]?.status==="cancelled"
      ? "cancelled"
      : orders[0]?.cancel_reason==="product_suspended_refund_failed"?"failed":"pending";
    return {notifications,outcome,cancelledOrders:outcome==="cancelled"?[request.orderId]:[]};
  });
}

async function resolveSuspendedOrder(orderId,productId,actorId=null) {
  const staged=await db.transaction(async client=>{
    await financeLock(client);
    if(actorId!==null) await currentActor(client,actorId,["bao","admin"]);
    const {rows:products}=await client.query(
      "SELECT id,name,status FROM products WHERE id=$1 FOR SHARE",[productId]
    );
    if(!products[0]||products[0].status!=="suspended") return {kind:"done",notifications:[],cancelledOrders:[]};
    const order=await loadOrder(client,orderId,true);
    if(!order||order.status!=="pending") return {kind:"done",notifications:[],cancelledOrders:[]};
    if(order.payment_method!=="paymongo") return {kind:"done",notifications:[],cancelledOrders:[]};

    const payment=await orderPayment(client,order.id);
    if(payment.status==="initializing"&&!payment.checkout_session_id) {
      const notifications=[];
      const cancelledOrders=await closeUnpaidCheckout(client,payment,products[0],notifications);
      return {kind:"done",notifications,cancelledOrders};
    }
    if(payment.status==="pending") {
      if(!payment.checkout_session_id) return {kind:"no_session",notifications:[],cancelledOrders:[]};
      return {kind:"reconcile",notifications:[],cancelledOrders:[],paymentId:payment.id};
    }
    if(["cancelled","expired","failed"].includes(payment.status)) {
      const notifications=[],cancelledOrders=await closeUnpaidCheckout(client,payment,products[0],notifications,payment.status);
      return {kind:"done",notifications,cancelledOrders};
    }
    if(!["paid","partially_refunded","refunded"].includes(payment.status)) {
      return {kind:"invalid_payment",notifications:[],cancelledOrders:[]};
    }

    const refundable=cents(payment.gross_amount)-cents(payment.refunded_amount);
    if(refundable<=0) {
      const notifications=[];
      await cancelAlreadyRefundedOrder(client,order,products[0],notifications);
      return {kind:"done",notifications,cancelledOrders:[order.id]};
    }
    if(!payment.provider_payment_id) return {kind:"invalid_payment",notifications:[],cancelledOrders:[]};

    const {rows:active}=await client.query(
      `SELECT provider_refund_id,status FROM payment_refunds
       WHERE order_id=$1 AND status IN ('requesting','pending','succeeded')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[order.id]
    );
    if(active[0]) return {kind:"pending",notifications:[],cancelledOrders:[]};
    const {rows:otherRequests}=await client.query(
      "SELECT provider_refund_id FROM payment_refunds WHERE payment_id=$1 AND status='requesting' FOR UPDATE",
      [payment.id]
    );
    if(otherRequests.length) return {kind:"pending",notifications:[],cancelledOrders:[]};

    const requestId=`requesting:${randomUUID()}`;
    await client.query(
      `INSERT INTO payment_refunds(provider_refund_id,payment_id,order_id,amount,status)
       VALUES($1,$2,$3,$4,'requesting')`,
      [requestId,payment.id,order.id,pesos(refundable)]
    );
    await client.query(
      "UPDATE orders SET cancel_reason='product_suspended_refund_pending' WHERE id=$1",[order.id]
    );
    return {
      kind:"refund",
      notifications:[],
      cancelledOrders:[],
      request:{requestId,orderId:order.id,paymentId:payment.id,providerPaymentId:payment.provider_payment_id,amount:refundable},
    };
  });

  if(staged.kind==="reconcile") {
    try {
      const payment=await reconcilePayment(staged.paymentId,{
        cancel:true,
        reason:"product_suspended",
        note:`Online checkout cancelled because product ${productId} was suspended.`,
      });
      if(["paid","partially_refunded","refunded"].includes(payment.status)) {
        return resolveSuspendedOrder(orderId,productId,actorId);
      }
      const [rows]=await db.query(
        `SELECT o.id FROM orders o JOIN payment_allocations a ON a.order_id=o.id
         WHERE a.payment_id=$1 AND o.status='cancelled' ORDER BY o.id`,[payment.id]
      );
      return {notifications:[],outcome:"cancelled",cancelledOrders:rows.map(order=>order.id)};
    } catch(error) {
      const definitive=Number.isInteger(error.status)&&error.status!==502;
      return recordOrderIssue(
        orderId,
        definitive?"product_suspended_refund_failed":"product_suspended_refund_pending",
        definitive
          ? `PayMongo could not safely close the checkout for order #${orderId}. The order is blocked until BAO reviews it.`
          : `The checkout for order #${orderId} is being reconciled with PayMongo. The order remains blocked.`,
        `PayMongo checkout reconciliation failed for product-suspended order #${orderId}. BAO review is required.`
      );
    }
  }

  if(staged.kind==="no_session"||staged.kind==="invalid_payment") {
    const message=staged.kind==="no_session"
      ? `The PayMongo checkout for order #${orderId} is still being created or needs reconciliation. The order remains blocked.`
      : `The PayMongo payment for order #${orderId} needs BAO review before it can be cancelled.`;
    return recordOrderIssue(
      orderId,
      staged.kind==="no_session"?"product_suspended_refund_pending":"product_suspended_refund_failed",
      message,
      `PayMongo reconciliation is required for product-suspended order #${orderId}.`
    );
  }
  if(staged.kind==="pending") return {...staged,outcome:"pending"};
  if(staged.kind==="refund") return completeRefundRequest(staged.request);
  return {...staged,outcome:"cancelled"};
}

export async function resolveSuspendedOnlineOrder(orderId,productId) {
  return resolveSuspendedOrder(orderId,productId);
}

export async function suspendProduct(productId,actorId,reason="") {
  const prepared=await db.transaction(async client=>{
    await financeLock(client);
    await currentActor(client,actorId,["bao","admin"]);
    const {rows:products}=await client.query(
      "SELECT id,name,status,seller_id FROM products WHERE id=$1 FOR UPDATE",[productId]
    );
    if(!products.length) throw paymentError("Product not found.",404);
    const previousStatus=products[0].status;
    const {rows:updated}=await client.query(
      "UPDATE products SET status='suspended' WHERE id=$1 RETURNING id,name,status,is_visible,stock,image_url,seller_id",
      [productId]
    );
    const product=updated[0];
    await client.query(
      `INSERT INTO bao_audit_logs(actor_id,action,entity_type,entity_id,reason,metadata)
       VALUES($1,'product_suspended','product',$2,NULLIF($3,''),$4::jsonb)`,
      [actorId,String(productId),reason,JSON.stringify({
        product_name:product.name,previous_status:previousStatus,new_status:"suspended",
      })]
    );

    const notifications=[];
    if(previousStatus!=="suspended"&&product.seller_id) {
      notifications.push(await createNotificationRecord({
        userId:product.seller_id,type:"product_status",
        message:`BAO suspended your listing "${product.name}". It is no longer available to buyers.`,
      },client));
    }
    const {rows:orders}=await client.query(
      `SELECT o.*,COALESCE(o.seller_id,(SELECT seller.seller_id FROM order_items i
        JOIN products seller ON seller.id=i.product_id WHERE i.order_id=o.id ORDER BY seller.seller_id LIMIT 1))
        AS notification_seller_id
       FROM orders o WHERE o.status='pending'
       AND EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.product_id=$1)
       ORDER BY o.id FOR UPDATE`,[productId]
    );
    const cancelledOrders=[],onlineOrderIds=[];
    for(const order of orders) {
      if(order.payment_method==="paymongo") {
        await client.query(
          "UPDATE orders SET cancel_reason='product_suspended_refund_pending' WHERE id=$1",[order.id]
        );
        onlineOrderIds.push(order.id);
      } else {
        await cancelCashOrder(client,order,product,notifications);
        cancelledOrders.push(order.id);
      }
    }
    return {product,notifications,cancelledOrders,onlineOrderIds};
  });

  const result={
    product:prepared.product,
    notifications:prepared.notifications,
    cancelledOrders:prepared.cancelledOrders,
    pendingRefunds:[],
    failedRefunds:[],
  };
  for(const orderId of prepared.onlineOrderIds) {
    const resolved=await resolveSuspendedOrder(orderId,productId,actorId);
    result.notifications.push(...(resolved.notifications||[]));
    result.cancelledOrders.push(...(resolved.cancelledOrders||[]));
    if(resolved.outcome==="failed") {
      result.failedRefunds.push({orderId,message:"PayMongo refund or checkout reconciliation needs BAO review."});
    } else if(resolved.outcome==="pending") {
      result.pendingRefunds.push(orderId);
    }
  }
  return result;
}
