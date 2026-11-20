import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { cents,pesos,splitOrderItems } from "@/lib/payments/money";
import { paymongo,paymentError,testKey,paymentMethods,applicationUrl } from "@/lib/payments/paymongo";
import { uuid,fingerprint } from "@/lib/payments/security";
import { financeLock,currentActor,financialNotice } from "@/lib/payments/ledger";
import { closeUnpaidPayment } from "@/lib/payments/events";

export async function createMarketplaceOrders(userId,input,key) {
  uuid(key);
  if(!input||typeof input!=="object") throw paymentError("Invalid checkout request.");
  if(!["cod","paymongo"].includes(input.payment_method)) throw paymentError("Choose a supported payment method.");
  if(input.payment_method==="paymongo") { testKey(); applicationUrl(); paymentMethods(); }
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 150) throw paymentError("Enter your name.");
  if (input.address != null && (typeof input.address !== "string" || input.address.length > 1000)) throw paymentError("Invalid pickup details.");
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>100) throw paymentError("Select between 1 and 100 items.");
  if(input.items.some(item=>!item||typeof item!=="object")) throw paymentError("Invalid checkout item.");
  const items=input.items.map(item=>({product_id:Number(item.product_id),quantity:Number(item.quantity),variant:typeof item.variant==="string"?item.variant.trim():null}));
  if(items.some(item=>!Number.isSafeInteger(item.product_id)||item.product_id<1||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>1000||item.variant?.length>200)) throw paymentError("Invalid product or quantity.");
  items.sort((a,b)=>a.product_id-b.product_id||String(a.variant).localeCompare(String(b.variant)));
  const hash=fingerprint(JSON.stringify({items,method:input.payment_method}));
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,userId,["user","seller"]);
    const {rows:existing}=await client.query("SELECT id FROM orders WHERE user_id=$1 AND checkout_key=$2 ORDER BY id",[userId,key]);
    if(existing.length) {
      const {rows:payments}=await client.query("SELECT id,request_hash FROM payments WHERE user_id=$1 AND idempotency_key=$2",[userId,key]);
      if(payments[0]&&payments[0].request_hash!==hash) throw paymentError("This checkout reference was already used for different items.",409);
      return {orderIds:existing.map(order=>order.id),paymentId:payments[0]?.id||null};
    }
    const {rows:buyerRows}=await client.query("SELECT email FROM users WHERE id=$1",[userId]);
    const enriched=[];
    for(const item of items) {
      const {rows}=await client.query(
        `SELECT p.*,concat_ws(' ',u.name,u.last_name) AS resolved_seller_name FROM products p JOIN users u ON u.id=p.seller_id
         WHERE p.id=$1 AND p.status='approved' AND p.is_visible=true AND u.role='seller' AND u.status='active' FOR UPDATE OF p`,[item.product_id]);
      const product=rows[0];
      if(!product||String(product.seller_id)===String(userId)) throw paymentError("A selected product is unavailable.",409);
      let price=cents(product.price),image=product.image_url;
      if(item.variant) {
        const {rows:variants}=await client.query("SELECT * FROM product_variants WHERE product_id=$1 AND label=$2 ORDER BY id LIMIT 1",[product.id,item.variant]);
        if(!variants[0]) throw paymentError("A selected variation is unavailable.",409);
        if(variants[0].price_override!==null) price=cents(variants[0].price_override);
        image=variants[0].image_url||image;
      }
      if(price<=0) throw paymentError("A selected product has an invalid price.",409);
      const reserved=await client.query("UPDATE products SET stock=stock-$1 WHERE id=$2 AND stock >= $1 RETURNING id",[item.quantity,product.id]);
      if(!reserved.rows.length) throw paymentError(`Not enough stock for ${product.name}.`,409);
      enriched.push({...item,product,price,image});
    }
    const groups=enriched.reduce((all,item)=>{(all[item.product.seller_id]||=[]).push(item);return all;},{}),orderIds=[],allocations=[];
    let total=0;
    for(const [sellerId,sellerItems] of Object.entries(groups)) {
      const split=splitOrderItems(sellerItems),amount=split.gross;cents(pesos(amount));total+=amount;
      const pickupPoints = sellerItems.map(({ product }) => product.meetup_point?.trim() || "Confirm with seller");
      const pickupDetails = input.address?.trim() || [...new Set(pickupPoints)].join(" · ");
      const {rows}=await client.query(
        `INSERT INTO orders(user_id,seller_id,name,email,address,payment_method,total,status,payment_status,checkout_key,stock_reserved,bao_commission_amount)
         VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,true,$10) RETURNING id`,
        [userId,sellerId,input.name.trim(),buyerRows[0].email,pickupDetails,input.payment_method,pesos(amount),input.payment_method==="cod"?"unpaid":"pending",key,pesos(split.commission)]);
      const orderId=rows[0].id;orderIds.push(orderId);allocations.push({orderId,sellerId,...split});
      for(const item of sellerItems) await client.query(
        "INSERT INTO order_items(order_id,product_id,quantity,price,variant,name,image_url,seller_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [orderId,item.product_id,item.quantity,pesos(item.price),item.variant,item.product.name,item.image,item.product.resolved_seller_name]);
      if(input.payment_method==="cod") await financialNotice(client,sellerId,`New cash-on-pickup order #${orderId} is awaiting your approval.`);
    }
    cents(pesos(total));
    let paymentId=null;
    if(input.payment_method==="paymongo") {
      if(total<2000) throw paymentError("Online checkout requires at least PHP 20.00.");
      paymentId=randomUUID();
      await client.query("INSERT INTO payments(id,user_id,reference,amount,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6)",[paymentId,userId,`PM-${paymentId}`,pesos(total),key,hash]);
      for(const allocation of allocations) await client.query(
        "INSERT INTO payment_allocations(payment_id,order_id,seller_id,gross_amount,commission_amount,seller_amount) VALUES($1,$2,$3,$4,$5,$6)",
        [paymentId,allocation.orderId,allocation.sellerId,pesos(allocation.gross),pesos(allocation.commission),pesos(allocation.seller)]);
    }
    await financialNotice(client,userId,input.payment_method==="cod"?`Your orders ${orderIds.map(id=>`#${id}`).join(", ")} were placed. Total PHP ${pesos(total)}.`:`Your orders are reserved while awaiting online payment. Reference PM-${paymentId}.`);
    return {orderIds,paymentId};
  });
}

export async function startCheckout(paymentId,userId) {
  const prepared=await db.transaction(async client=>{
    await financeLock(client);
    const {rows}=await client.query("SELECT * FROM payments WHERE id=$1 AND user_id=$2 FOR UPDATE",[paymentId,userId]);
    const payment=rows[0];if(!payment) throw paymentError("Payment not found.",404);
    if(payment.checkout_url) return {payment};
    if(payment.status!=="initializing") return {payment};
    // Claim creation before the network call; never repeat an ambiguous POST.
    await client.query("UPDATE payments SET status='pending',updated_at=now() WHERE id=$1",[payment.id]);
    return {payment,create:true};
  });
  if(!prepared.create) return prepared.payment;
  const payment=prepared.payment,origin=applicationUrl();
  try {
    const session=await paymongo("/v2/checkout_sessions",{method:"POST",attributes:{
      line_items:[{name:`PiyuMart ${payment.reference}`,amount:cents(payment.amount),currency:"PHP",quantity:1}],
      payment_method_types:paymentMethods(),reference_number:payment.reference,
      metadata:{payment_id:payment.id},
      success_url:`${origin}/payments/${payment.id}?result=success`,cancel_url:`${origin}/payments/${payment.id}?result=cancelled`,
    }});
    const url=new URL(session.attributes.checkout_url);
    if(url.protocol!=="https:"||url.hostname!=="checkout.paymongo.com") throw paymentError("Unexpected provider checkout URL.",502);
    const [rows]=await db.query("UPDATE payments SET checkout_session_id=$1,checkout_url=$2,payment_intent_id=$3,updated_at=now() WHERE id=$4 RETURNING *",[session.id,url.toString(),session.attributes.payment_intent?.id||null,payment.id]);
    return rows[0];
  } catch(error) {
    if(error.providerCode && error.status===422) {
      await db.transaction(async client=>{await financeLock(client);const {rows}=await client.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE",[payment.id]);await closeUnpaidPayment(client,rows[0],"failed");await client.query("UPDATE payments SET error_code=$1 WHERE id=$2",[error.providerCode,payment.id]);});
      return {...payment,status:"failed",error_code:error.providerCode};
    }
    await db.query("UPDATE payments SET error_code=$1,updated_at=now() WHERE id=$2",[error.providerCode||"reconciliation_required",payment.id]);
    // The reference still exists for recovery through a verified provider GET.
    return {...payment,status:"pending",error_code:error.providerCode||"reconciliation_required"};
  }
}
