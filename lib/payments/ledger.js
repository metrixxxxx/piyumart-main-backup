import "server-only";
import { cents,pesos } from "@/lib/payments/money";
import { paymentError } from "@/lib/payments/paymongo";
import { createNotificationRecord } from "@/lib/notify";

// One lock order for payment, refund, release and cashout transactions.
// A small campus marketplace favors simple, serializable money movement.
export async function financeLock(client) { await client.query("SELECT pg_advisory_xact_lock($1,$2)",[817206,71]); }
export async function currentActor(client,id,roles) {
  const {rows}=await client.query("SELECT id,role,status FROM users WHERE id=$1 FOR SHARE",[id]);
  if(rows[0]?.status!=="active"||!roles.includes(rows[0]?.role)) throw paymentError("Forbidden.",403);
  return rows[0];
}
export async function walletFor(client,sellerId=null) {
  const kind=sellerId===null?"bao":"seller";
  await client.query("INSERT INTO wallets(owner_id,kind) VALUES($1,$2) ON CONFLICT DO NOTHING",[sellerId,kind]);
  const {rows}=await client.query("SELECT * FROM wallets WHERE owner_id IS NOT DISTINCT FROM $1 AND kind=$2 FOR UPDATE",[sellerId,kind]);
  return rows[0];
}
export async function balances(client,walletId) {
  const {rows}=await client.query("SELECT bucket,SUM(amount) AS amount FROM wallet_transactions WHERE wallet_id=$1 GROUP BY bucket",[walletId]);
  const result={pending:0,available:0,reserved:0,debt:0};
  for(const row of rows) result[row.bucket]=cents(row.amount);
  return result;
}
export async function post(client,{walletId,bucket,amount,kind,key,paymentId=null,orderId=null,cashoutId=null}) {
  if(!amount) return;
  await client.query(
    `INSERT INTO wallet_transactions(wallet_id,bucket,amount,kind,idempotency_key,payment_id,order_id,cashout_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[walletId,bucket,pesos(amount),kind,key,paymentId,orderId,cashoutId]
  );
}
export async function availableCredit(client,walletId,amount,details) {
  const balance=await balances(client,walletId),repayment=Math.min(balance.debt,amount);
  if(repayment) await post(client,{...details,walletId,bucket:"debt",amount:-repayment,key:`${details.key}:debt`,kind:"debt_repayment"});
  if(amount>repayment) await post(client,{...details,walletId,bucket:"available",amount:amount-repayment,key:`${details.key}:available`});
}
export async function releaseOrderFunds(client,orderId) {
  const {rows}=await client.query(
    `SELECT a.*,o.status AS order_status,p.status AS payment_status,s.release_policy
     FROM payment_allocations a JOIN orders o ON o.id=a.order_id JOIN payments p ON p.id=a.payment_id
     CROSS JOIN finance_settings s WHERE a.order_id=$1 FOR UPDATE OF a`,[orderId]);
  const allocation=rows[0];
  if(!allocation||allocation.released||!["paid","partially_refunded"].includes(allocation.payment_status)) return;
  if(allocation.order_status!=="completed"&&allocation.release_policy!=="payment_confirmed") return;
  for(const [owner,amount] of [[allocation.seller_id,cents(allocation.seller_amount)-cents(allocation.seller_refunded)],[null,cents(allocation.commission_amount)-cents(allocation.commission_refunded)]]) {
    const wallet=await walletFor(client,owner),key=`release:${orderId}:${wallet.id}`;
    const details={paymentId:allocation.payment_id,orderId,key,kind:"release"};
    await post(client,{...details,walletId:wallet.id,bucket:"pending",amount:-amount,key:`${key}:pending`});
    await availableCredit(client,wallet.id,amount,details);
  }
  await client.query("UPDATE payment_allocations SET released=true WHERE order_id=$1",[orderId]);
}
export async function reverseFunds(client,walletId,amount,released,key,details) {
  if(!released) return post(client,{...details,walletId,bucket:"pending",amount:-amount,kind:"refund",key});
  const balance=await balances(client,walletId),debit=Math.min(balance.available,amount);
  await post(client,{...details,walletId,bucket:"available",amount:-debit,kind:"refund",key:`${key}:available`});
  // Never make a wallet negative when an external refund follows a cashout.
  // Outstanding refund recovery blocks further cashouts and offsets new earnings.
  await post(client,{...details,walletId,bucket:"debt",amount:amount-debit,kind:"refund_recovery",key:`${key}:debt`});
}
export async function auditFinance(client,actorId,action,entityType,entityId,reason=null) {
  await client.query("INSERT INTO bao_audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) VALUES($1,$2,$3,$4,$5,'{}'::jsonb)",[actorId,action,entityType,String(entityId),reason]);
}
export async function financialNotice(client,userId,message) { return createNotificationRecord({userId,type:"payment",message},client); }
export async function staffNotice(client,message) {
  const {rows}=await client.query("SELECT id FROM users WHERE role IN ('bao','admin') AND status='active'");
  for(const user of rows) await financialNotice(client,user.id,message);
}
export async function restoreOrderStock(client,order) {
  if(!order.stock_reserved) return;
  const {rows}=await client.query("SELECT product_id,quantity FROM order_items WHERE order_id=$1 ORDER BY product_id",[order.id]);
  for(const item of rows) await client.query("UPDATE products SET stock=stock+$1 WHERE id=$2",[item.quantity,item.product_id]);
  await client.query("UPDATE orders SET stock_reserved=false WHERE id=$1",[order.id]);
}
