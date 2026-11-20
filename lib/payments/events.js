import "server-only";
import { db } from "@/lib/db";
import { fingerprint } from "@/lib/payments/security";
import { cents,pesos,proportional,roundedRatio } from "@/lib/payments/money";
import { paymongo,paymentError } from "@/lib/payments/paymongo";
import { financeLock,walletFor,post,releaseOrderFunds,reverseFunds,restoreOrderStock,financialNotice,staffNotice } from "@/lib/payments/ledger";

export async function closeUnpaidPayment(client,payment,status) {
  if(["paid","partially_refunded","refunded"].includes(payment.status)) return;
  const {rows}=await client.query("SELECT o.* FROM orders o JOIN payment_allocations a ON a.order_id=o.id WHERE a.payment_id=$1 ORDER BY o.id FOR UPDATE OF o",[payment.id]);
  for(const order of rows) {
    await restoreOrderStock(client,order);
    await client.query("UPDATE orders SET status='cancelled',payment_status=$1,cancelled_at=COALESCE(cancelled_at,now()) WHERE id=$2",[status,order.id]);
  }
  await client.query("UPDATE payments SET status=$1,updated_at=now() WHERE id=$2",[status,payment.id]);
}

export async function confirmPaidSession(client,payment,session) {
  const attributes=session.attributes||{};
  if(session.id!==payment.checkout_session_id||attributes.reference_number!==payment.reference||attributes.livemode!==false) throw paymentError("Payment identity or mode does not match.",409);
  const paid=(attributes.payments||[]).find(entry=>(entry.attributes||entry).status==="paid");
  if(!paid) return false;
  const details=paid.attributes||paid;
  if(details.currency!=="PHP"||details.amount!==cents(payment.amount)||!/^pay_[A-Za-z0-9]+$/.test(paid.id||"")) throw paymentError("Payment amount or currency does not match.",409);
  if(["paid","partially_refunded","refunded"].includes(payment.status)) {
    if(payment.provider_payment_id!==paid.id) throw paymentError("A different payment was already recorded.",409);
    return true;
  }
  if(["expired","cancelled","failed"].includes(payment.status)) throw paymentError("A settled payment conflicts with a closed checkout. Staff reconciliation is required.",409);
  await client.query("UPDATE payments SET status='paid',provider_payment_id=$1,payment_intent_id=$2,fee_amount=$3,paid_at=now(),error_code=NULL,updated_at=now() WHERE id=$4",[paid.id,attributes.payment_intent?.id||details.payment_intent_id||null,Number.isSafeInteger(details.fee)?pesos(details.fee):null,payment.id]);
  const {rows:allocations}=await client.query("SELECT * FROM payment_allocations WHERE payment_id=$1 ORDER BY order_id FOR UPDATE",[payment.id]);
  for(const allocation of allocations) {
    for(const [owner,amount] of [[allocation.seller_id,cents(allocation.seller_amount)],[null,cents(allocation.commission_amount)]]) {
      const wallet=await walletFor(client,owner);
      await post(client,{walletId:wallet.id,bucket:"pending",amount,kind:"sale",key:`paid:${allocation.order_id}:${wallet.id}`,paymentId:payment.id,orderId:allocation.order_id});
    }
    await client.query("UPDATE orders SET payment_status='paid' WHERE id=$1",[allocation.order_id]);
    await releaseOrderFunds(client,allocation.order_id);
    await financialNotice(client,allocation.seller_id,`Payment confirmed for order #${allocation.order_id}. Seller allocation PHP ${allocation.seller_amount}.`);
  }
  await financialNotice(client,payment.user_id,`Payment ${payment.reference} is confirmed. Your orders are awaiting seller fulfillment.`);
  await staffNotice(client,`Payment ${payment.reference} confirmed. The BAO commission allocation is recorded.`);
  return true;
}

async function refundPayment(client,resource) {
  const refund=resource.attributes||{};
  if(refund.livemode!==false||refund.currency!=="PHP"||!Number.isSafeInteger(refund.amount)||refund.amount<=0) throw paymentError("Invalid refund.",400);
  const {rows}=await client.query("SELECT * FROM payments WHERE provider_payment_id=$1 FOR UPDATE",[refund.payment_id]);
  const payment=rows[0];
  if(!payment) return false;
  if(!["paid","partially_refunded","refunded"].includes(payment.status)) throw paymentError("The original payment must be confirmed before its refund.",409);
  const {rows:existing}=await client.query("SELECT * FROM payment_refunds WHERE provider_refund_id=$1",[resource.id]);
  if(existing[0]&&(existing[0].payment_id!==payment.id||cents(existing[0].amount)!==refund.amount)) throw paymentError("Refund identity mismatch.",409);
  if(existing[0]?.status==="succeeded") return true;
  await client.query(
    `INSERT INTO payment_refunds(provider_refund_id,payment_id,amount,status) VALUES($1,$2,$3,$4)
     ON CONFLICT(provider_refund_id) DO UPDATE SET status=EXCLUDED.status,updated_at=now()`,[resource.id,payment.id,pesos(refund.amount),refund.status]);
  if(refund.status!=="succeeded") return true;
  const totalRefunded=cents(payment.refunded_amount)+refund.amount;
  if(totalRefunded>cents(payment.amount)) throw paymentError("Refund exceeds the original payment.",409);
  const {rows:allocations}=await client.query("SELECT * FROM payment_allocations WHERE payment_id=$1 ORDER BY order_id FOR UPDATE",[payment.id]);
  const shares=proportional(refund.amount,allocations.map(row=>cents(row.gross_amount)-cents(row.refunded_amount)));
  for(let i=0;i<allocations.length;i++) {
    const allocation=allocations[i],gross=cents(allocation.refunded_amount)+shares[i],commission=roundedRatio(cents(allocation.commission_amount),gross,cents(allocation.gross_amount)),seller=gross-commission;
    for(const [owner,delta] of [[allocation.seller_id,seller-cents(allocation.seller_refunded)],[null,commission-cents(allocation.commission_refunded)]]) {
      const wallet=await walletFor(client,owner);
      await reverseFunds(client,wallet.id,delta,allocation.released,`refund:${resource.id}:${allocation.order_id}:${wallet.id}`,{paymentId:payment.id,orderId:allocation.order_id});
    }
    await client.query("UPDATE payment_allocations SET refunded_amount=$1,commission_refunded=$2,seller_refunded=$3 WHERE order_id=$4",[pesos(gross),pesos(commission),pesos(seller),allocation.order_id]);
    if(shares[i]) await financialNotice(client,allocation.seller_id,`A refund allocation of PHP ${pesos(shares[i])} was recorded for order #${allocation.order_id}. Your wallet has been adjusted.`);
    const full=gross===cents(allocation.gross_amount);
    await client.query("UPDATE orders SET payment_status=$1 WHERE id=$2",[full?"refunded":"partially_refunded",allocation.order_id]);
    if(full) {
      const {rows:orders}=await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE",[allocation.order_id]);
      if(!["completed","cancelled"].includes(orders[0].status)) {
        await restoreOrderStock(client,orders[0]);
        await client.query("UPDATE orders SET status='cancelled',cancelled_at=now() WHERE id=$1",[allocation.order_id]);
      }
    }
  }
  await client.query("UPDATE payments SET status=$1,refunded_amount=$2,updated_at=now() WHERE id=$3",[totalRefunded===cents(payment.amount)?"refunded":"partially_refunded",pesos(totalRefunded),payment.id]);
  await financialNotice(client,payment.user_id,`A refund of PHP ${pesos(refund.amount)} was confirmed for ${payment.reference}.`);
  await staffNotice(client,`Refund ${resource.id} confirmed. Seller and BAO allocations have been reversed.`);
  return true;
}

export async function processPaymentEvent(event,raw) {
  if(!event?.id?.startsWith("evt_")||event.attributes?.livemode!==false) throw paymentError("Only test-mode events are accepted.",400);
  const type=event.attributes.type,resource=event.attributes.data;
  if(!resource?.id) throw paymentError("Missing webhook resource.");
  return db.transaction(async client=>{
    await financeLock(client);
    const {rows:claimed}=await client.query("INSERT INTO payment_webhook_events(event_id,event_type,payload_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id",[event.id,type,fingerprint(raw)]);
    if(!claimed.length) return {duplicate:true};
    if(type==="checkout_session.payment.paid") {
      const {rows}=await client.query("SELECT * FROM payments WHERE checkout_session_id=$1 FOR UPDATE",[resource.id]);
      if(!rows[0]) throw paymentError("Checkout has not been attached yet; retry this event.",503);
      if(!await confirmPaidSession(client,rows[0],resource)) throw paymentError("Paid checkout event has no successful payment.",409);
    } else if(type==="payment.refund.updated") {
      if(!await refundPayment(client,resource)) throw paymentError("Original payment is not recorded yet; retry this event.",503);
    } else if(type==="payment.failed") {
      // A failed attempt is not the end of an active hosted checkout.
      await client.query("UPDATE payments SET error_code='payment_attempt_failed',updated_at=now() WHERE payment_intent_id=$1 AND status='pending'",[resource.attributes?.payment_intent_id]);
    }
    return {received:true};
  });
}

export async function reconcilePayment(paymentId,{cancel=false,expire=false,sessionId=null}={}) {
  const [rows]=await db.query("SELECT * FROM payments WHERE id=$1",[paymentId]);
  const payment=rows[0];if(!payment) throw paymentError("Payment not found.",404);
  const checkoutId=payment.checkout_session_id||sessionId;
  if(!checkoutId) return payment;
  if(!/^cs_[A-Za-z0-9]+$/.test(checkoutId)) throw paymentError("Invalid checkout session ID.");
  let session=await paymongo(`/v1/checkout_sessions/${checkoutId}`);
  if(session.attributes.reference_number!==payment.reference||session.attributes.livemode!==false) throw paymentError("Checkout does not match this payment.",409);
  const paid=(session.attributes.payments||[]).some(entry=>(entry.attributes||entry).status==="paid");
  if((cancel||expire)&&!paid&&session.attributes.status!=="expired") session=await paymongo(`/v1/checkout_sessions/${checkoutId}/expire`,{method:"POST"});
  return db.transaction(async client=>{
    await financeLock(client);
    const {rows:locked}=await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE",[paymentId]);
    const current=locked[0];
    if(!current.checkout_session_id) {
      await client.query("UPDATE payments SET checkout_session_id=$1,checkout_url=$2 WHERE id=$3",[checkoutId,session.attributes.checkout_url||null,paymentId]);
      current.checkout_session_id=checkoutId;
    }
    const confirmed=await confirmPaidSession(client,current,session);
    if(!confirmed&&session.attributes.status!=="expired") {
      const failed=(session.attributes.payments||[]).some(entry=>(entry.attributes||entry).status==="failed");
      await client.query("UPDATE payments SET payment_intent_id=COALESCE($1,payment_intent_id),error_code=CASE WHEN $2 THEN 'payment_attempt_failed' ELSE error_code END WHERE id=$3",[session.attributes.payment_intent?.id||null,failed,paymentId]);
    }
    if(!confirmed&&session.attributes.status==="expired") await closeUnpaidPayment(client,current,cancel?"cancelled":"expired");
    const {rows:updated}=await client.query("SELECT * FROM payments WHERE id=$1",[paymentId]);return updated[0];
  });
}
