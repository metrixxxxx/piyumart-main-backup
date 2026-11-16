import "server-only";
import { db } from "@/lib/db";
import { cents,pesos } from "@/lib/payments/money";
import { paymentError,paymongo } from "@/lib/payments/paymongo";
import { encryptAccount,decryptAccount,fingerprint,uuid } from "@/lib/payments/security";
import { financeLock,currentActor,walletFor,balances,post,availableCredit,auditFinance,financialNotice,staffNotice } from "@/lib/payments/ledger";

export async function sellerWallet(sellerId) {
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,sellerId,["seller"]);
    const wallet=await walletFor(client,sellerId),balance=await balances(client,wallet.id);
    const {rows:totals}=await client.query(
      `SELECT COALESCE((SELECT SUM(a.seller_amount-a.seller_refunded) FROM payment_allocations a JOIN payments p ON p.id=a.payment_id
        WHERE a.seller_id=$1 AND p.status IN ('paid','partially_refunded','refunded')),0) AS earnings,
       COALESCE((SELECT SUM(amount) FROM cashout_requests WHERE seller_id=$1 AND status='completed'),0) AS withdrawals`,[sellerId]);
    const {rows:history}=await client.query("SELECT id,bucket,amount,kind,order_id,cashout_id,created_at FROM wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100",[wallet.id]);
    const {rows:destinations}=await client.query("SELECT id,institution,account_name,account_last_four,status,remarks FROM wallet_destinations WHERE seller_id=$1 ORDER BY created_at DESC",[sellerId]);
    const {rows:cashouts}=await client.query("SELECT c.id,c.amount,c.status,c.reason,c.created_at,d.institution,d.account_last_four,p.reference AS payout_reference FROM cashout_requests c JOIN wallet_destinations d ON d.id=c.destination_id LEFT JOIN payouts p ON p.cashout_id=c.id WHERE c.seller_id=$1 ORDER BY c.created_at DESC LIMIT 100",[sellerId]);
    const {rows:settings}=await client.query("SELECT minimum_cashout,release_policy FROM finance_settings WHERE id=true");
    return {balances:Object.fromEntries(Object.entries(balance).map(([key,value])=>[key,pesos(value)])),totals:totals[0],history,destinations,cashouts,settings:settings[0],mode:"test"};
  });
}
export async function addDestination(sellerId,input) {
  const institution=String(input.institution||"").trim().toUpperCase(),name=String(input.account_name||"").trim(),number=String(input.account_number||"").replace(/[\s-]/g,"");
  if(!/^[A-Z0-9]{4,15}$/.test(institution)||name.length<2||name.length>150||!/^\d{6,30}$/.test(number)) throw paymentError("Enter the institution BIC, account name, and a valid account number.");
  const encrypted=encryptAccount(number);
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,sellerId,["seller"]);
    const {rows}=await client.query(
      `INSERT INTO wallet_destinations(seller_id,institution,account_name,account_number_encrypted,account_last_four,fingerprint)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(seller_id,fingerprint) DO NOTHING RETURNING id,status`,
      [sellerId,institution,name,encrypted,number.slice(-4),fingerprint(`${sellerId}:${institution}:${number}`)]);
    if(!rows[0]) throw paymentError("This payout destination is already registered.",409);
    await staffNotice(client,`A seller payout destination is awaiting review.`);return rows[0];
  });
}
export async function requestCashout(sellerId,input,key) {
  uuid(key);uuid(input.destination_id);
  let amount;try{amount=cents(input.amount);}catch(error){throw paymentError(error.message);}
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,sellerId,["seller"]);
    const {rows:existing}=await client.query("SELECT id,amount,destination_id,status FROM cashout_requests WHERE seller_id=$1 AND idempotency_key=$2",[sellerId,key]);
    if(existing[0]) {
      if(cents(existing[0].amount)!==amount||existing[0].destination_id!==input.destination_id) throw paymentError("This request ID was used for a different cashout.",409);
      return existing[0];
    }
    const {rows:settings}=await client.query("SELECT minimum_cashout FROM finance_settings WHERE id=true");
    if(amount<cents(settings[0].minimum_cashout)) throw paymentError(`The minimum cashout is PHP ${settings[0].minimum_cashout}.`);
    const {rows:destinations}=await client.query("SELECT id FROM wallet_destinations WHERE id=$1 AND seller_id=$2 AND status='approved'",[input.destination_id,sellerId]);
    if(!destinations[0]) throw paymentError("Choose an approved payout destination.");
    const wallet=await walletFor(client,sellerId),balance=await balances(client,wallet.id);
    if(balance.debt>0) throw paymentError("Refund recovery must be settled before requesting a cashout.",409);
    if(amount>balance.available) throw paymentError("The requested amount exceeds your available balance.",409);
    const {rows}=await client.query("INSERT INTO cashout_requests(wallet_id,seller_id,destination_id,amount,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING id,status",[wallet.id,sellerId,input.destination_id,pesos(amount),key]);
    const details={walletId:wallet.id,amount,kind:"cashout_reserved",cashoutId:rows[0].id};
    await post(client,{...details,bucket:"available",amount:-amount,key:`reserve:${rows[0].id}:available`});
    await post(client,{...details,bucket:"reserved",key:`reserve:${rows[0].id}:reserved`});
    await staffNotice(client,`Cashout ${rows[0].id} for PHP ${pesos(amount)} is awaiting review.`);return rows[0];
  });
}
export async function reviewDestination(actorId,id,action,reason="") {
  uuid(id);if(!["approve","reject"].includes(action)) throw paymentError("Invalid destination action.");
  if(action==="reject"&&!reason.trim()) throw paymentError("A rejection reason is required.");
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,["bao","admin"]);
    const {rows}=await client.query("UPDATE wallet_destinations SET status=$1,reviewed_by=$2,reviewed_at=now(),remarks=$3 WHERE id=$4 AND status='pending' RETURNING seller_id,status",[action==="approve"?"approved":"rejected",actorId,reason.trim().slice(0,1000)||null,id]);
    if(!rows[0]) throw paymentError("Destination was already reviewed or does not exist.",409);
    await auditFinance(client,actorId,`payout_destination_${rows[0].status}`,"wallet_destination",id,reason||null);
    await financialNotice(client,rows[0].seller_id,`Your payout destination was ${rows[0].status}. ${reason}`);return {success:true};
  });
}
export async function reviewCashout(actorId,id,action,reason="") {
  uuid(id);if(!["approve","reject"].includes(action)) throw paymentError("Invalid cashout action.");
  if(action==="reject"&&!reason.trim()) throw paymentError("A rejection reason is required.");
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,["bao","admin"]);
    const {rows}=await client.query("SELECT * FROM cashout_requests WHERE id=$1 FOR UPDATE",[id]);
    const request=rows[0];if(!request||request.status!=="pending") throw paymentError("This cashout is no longer awaiting review.",409);
    const balance=await balances(client,request.wallet_id);
    if(action==="approve"&&balance.debt) throw paymentError("This seller has outstanding refund recovery.",409);
    if(action==="reject") {
      await post(client,{walletId:request.wallet_id,bucket:"reserved",amount:-cents(request.amount),kind:"cashout_released",key:`reject:${id}:reserved`,cashoutId:id});
      await availableCredit(client,request.wallet_id,cents(request.amount),{kind:"cashout_released",key:`reject:${id}`,cashoutId:id});
    }
    const status=action==="approve"?"approved":"rejected";
    await client.query("UPDATE cashout_requests SET status=$1,reason=$2,reviewed_by=$3,reviewed_at=now(),updated_at=now() WHERE id=$4",[status,reason.trim().slice(0,1000)||null,actorId,id]);
    await auditFinance(client,actorId,`cashout_${status}`,"cashout_request",id,reason||null);
    await financialNotice(client,request.seller_id,`Your cashout request for PHP ${request.amount} was ${status}. ${reason}`);
    return {success:true,status};
  });
}

// Demo fallback: staff initiates transfers in an authorized PayMongo dashboard.
// The app never creates an unapproved disbursement or trusts a typed "completed".
export async function verifyPayout(actorId,cashoutId,transferId) {
  uuid(cashoutId);
  if(process.env.PAYMONGO_PAYOUTS_ENABLED!=="true") throw paymentError("Payout verification requires an activated PayMongo test wallet. Cashout approval does not transfer funds.",503);
  if(!/^tr_[A-Za-z0-9]+$/.test(transferId||"")) throw paymentError("Enter a PayMongo transfer ID.");
  const resource=await paymongo(`/v2/transfers/${transferId}`),transfer=resource.attributes||resource;
  if(transfer.livemode!==false) throw paymentError("The transfer must explicitly be in test mode.",409);
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,["bao","admin"]);
    const {rows}=await client.query("SELECT c.*,d.institution,d.account_name,d.account_number_encrypted FROM cashout_requests c JOIN wallet_destinations d ON d.id=c.destination_id WHERE c.id=$1 FOR UPDATE OF c",[cashoutId]);
    const request=rows[0];if(!request) throw paymentError("Cashout not found.",404);
    const {rows:existing}=await client.query("SELECT * FROM payouts WHERE cashout_id=$1",[cashoutId]);
    if(existing[0]?.provider_transfer_id&&existing[0].provider_transfer_id!==transferId) throw paymentError("A different transfer is already attached.",409);
    if(["completed","failed"].includes(request.status)&&existing[0]?.provider_transfer_id===transferId) return {success:true,status:request.status};
    if(!["approved","processing"].includes(request.status)) throw paymentError("Approve the cashout before attaching a transfer.",409);
    const destination=transfer.destination_account;
    const normalize=value=>String(value||"").trim().toLowerCase().replace(/\s+/g," ");
    if(resource.id!==transferId||transfer.currency!=="PHP"||transfer.amount!==cents(request.amount)||
      destination?.number!==decryptAccount(request.account_number_encrypted)||destination?.bic!==request.institution||normalize(destination?.name)!==normalize(request.account_name)) throw paymentError("Transfer amount or destination does not match the approved cashout.",409);
    const target={pending:"processing",succeeded:"completed",failed:"failed"}[transfer.status];
    if(!target) throw paymentError("The provider returned an unsupported transfer status.",409);
    const proof={transfer_id:transferId,status:transfer.status,amount:transfer.amount,currency:"PHP",reference_number:transfer.provider_reference_number||transfer.reference_number,bank:request.institution,account_last_four:destination.number.slice(-4),verified_at:new Date().toISOString(),livemode:false};
    await client.query(
      `INSERT INTO payouts(cashout_id,provider_transfer_id,reference,status,proof,recorded_by,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4='processing' THEN NULL ELSE now() END)
       ON CONFLICT(cashout_id) DO UPDATE SET reference=EXCLUDED.reference,status=EXCLUDED.status,proof=EXCLUDED.proof,confirmed_at=EXCLUDED.confirmed_at`,
      [cashoutId,transferId,proof.reference_number||transferId,target==="completed"?"succeeded":target,JSON.stringify(proof),actorId]);
    if(target!=="processing") {
      await post(client,{walletId:request.wallet_id,bucket:"reserved",amount:-cents(request.amount),kind:target==="completed"?"cashout_paid":"cashout_released",key:`payout:${cashoutId}:reserved`,cashoutId});
      if(target==="failed") await availableCredit(client,request.wallet_id,cents(request.amount),{kind:"cashout_released",key:`payout:${cashoutId}`,cashoutId});
    }
    await client.query("UPDATE cashout_requests SET status=$1,updated_at=now() WHERE id=$2",[target,cashoutId]);
    await auditFinance(client,actorId,`cashout_${target}`,"cashout_request",cashoutId,`Verified PayMongo transfer ${transferId}`);
    if(target!=="processing") await financialNotice(client,request.seller_id,`Cashout for PHP ${request.amount} ${target==="completed"?"has a confirmed test transfer":"failed; reserved funds have been released"}.`);
    return {success:true,status:target};
  });
}

export async function financeDashboard() {
  return db.transaction(async client=>{
    await financeLock(client);const wallet=await walletFor(client),balance=await balances(client,wallet.id);
    const {rows:totals}=await client.query(
      `SELECT COALESCE((SELECT SUM(amount-refunded_amount) FROM payments WHERE status IN ('paid','partially_refunded','refunded')),0) AS sales,
       COALESCE((SELECT SUM(a.commission_amount-a.commission_refunded) FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE p.status IN ('paid','partially_refunded','refunded')),0) AS commission,
       COALESCE((SELECT SUM(amount) FROM cashout_requests WHERE status='completed'),0) AS withdrawals`);
    const {rows:payments}=await client.query("SELECT id,reference,amount,refunded_amount,fee_amount,status,created_at,paid_at FROM payments ORDER BY created_at DESC LIMIT 100");
    const {rows:cashouts}=await client.query("SELECT c.id,c.amount,c.status,c.reason,c.created_at,u.name,d.institution,d.account_name,d.account_last_four,p.provider_transfer_id,p.reference AS payout_reference FROM cashout_requests c JOIN users u ON u.id=c.seller_id JOIN wallet_destinations d ON d.id=c.destination_id LEFT JOIN payouts p ON p.cashout_id=c.id ORDER BY c.created_at DESC LIMIT 100");
    const {rows:destinations}=await client.query("SELECT d.id,d.institution,d.account_name,d.account_last_four,d.status,d.created_at,u.name AS seller_name FROM wallet_destinations d JOIN users u ON u.id=d.seller_id WHERE d.status='pending' ORDER BY d.created_at");
    const {rows:settings}=await client.query("SELECT minimum_cashout,release_policy FROM finance_settings WHERE id=true");
    const {rows:commissionReport}=await client.query("SELECT a.seller_id,u.name,COUNT(*) AS orders,SUM(a.gross_amount-a.refunded_amount) AS sales,SUM(a.commission_amount-a.commission_refunded) AS commission,SUM(a.seller_amount-a.seller_refunded) AS earnings FROM payment_allocations a JOIN users u ON u.id=a.seller_id JOIN payments p ON p.id=a.payment_id WHERE p.status IN ('paid','partially_refunded','refunded') GROUP BY a.seller_id,u.name ORDER BY SUM(a.gross_amount-a.refunded_amount) DESC");
    return {balances:Object.fromEntries(Object.entries(balance).map(([key,value])=>[key,pesos(value)])),totals:totals[0],payments,cashouts,destinations,commissionReport,settings:settings[0],mode:"test",payoutsEnabled:process.env.PAYMONGO_PAYOUTS_ENABLED==="true"};
  });
}
