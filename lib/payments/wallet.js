import "server-only";
import { db } from "@/lib/db";
import { cents,pesos } from "@/lib/payments/money";
import { paymentError,paymongo } from "@/lib/payments/paymongo";
import { encryptAccount,decryptAccount,fingerprint,uuid } from "@/lib/payments/security";
import { financeLock,currentActor,walletFor,balances,post,availableCredit,auditFinance,financialNotice,staffNotice } from "@/lib/payments/ledger";
import { commissionRecordsSql } from "@/lib/bao-commission-report";

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
export function addDestination(sellerId,input) { return addWalletDestination(sellerId,input,"seller"); }
export function addCommissionDestination(actorId,input) { return addWalletDestination(actorId,input,"bao"); }
async function addWalletDestination(actorId,input,kind) {
  const institution=String(input?.institution||"").trim().toUpperCase(),name=String(input?.account_name||"").trim(),number=String(input?.account_number||"").replace(/[\s-]/g,"");
  if(!/^[A-Z0-9]{4,15}$/.test(institution)||name.length<2||name.length>150||!/^\d{6,30}$/.test(number)) throw paymentError("Enter the institution BIC, account name, and a valid account number.");
  const encrypted=encryptAccount(number);
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,kind==="bao"?["bao","admin"]:["seller"]);
    const owner=kind==="bao"?null:actorId,wallet=await walletFor(client,owner);
    const {rows}=await client.query(
      `INSERT INTO wallet_destinations(seller_id,institution,account_name,account_number_encrypted,account_last_four,fingerprint,wallet_id,submitted_by,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(wallet_id,fingerprint) DO NOTHING RETURNING id,status`,
      [owner,institution,name,encrypted,number.slice(-4),fingerprint(`${kind==="bao"?"bao":actorId}:${institution}:${number}`),wallet.id,actorId,kind==="bao"?"approved":"pending"]);
    if(!rows[0]) throw paymentError("This payout destination is already registered.",409);
    await auditFinance(client,actorId,kind==="bao"?"bao_payout_destination_auto_approved":"payout_destination_submitted","wallet_destination",rows[0].id,kind==="bao"?"Ready to use; BAO destinations do not require manual review.":null);
    await staffNotice(client,kind==="bao"?"A BAO commission payout destination was added and is ready to use.":"A seller payout destination is awaiting review.");return rows[0];
  });
}
export function requestCashout(sellerId,input,key) { return requestWalletCashout(sellerId,input,key,"seller"); }
export function requestCommissionCashout(actorId,input,key) { return requestWalletCashout(actorId,input,key,"bao"); }
async function requestWalletCashout(actorId,input,key,kind) {
  uuid(key);uuid(input?.destination_id);
  let amount;try{amount=cents(input.amount);}catch(error){throw paymentError(error.message);}
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,kind==="bao"?["bao","admin"]:["seller"]);
    const owner=kind==="bao"?null:actorId,wallet=await walletFor(client,owner);
    const {rows:existing}=await client.query("SELECT id,amount,destination_id,status,requested_by FROM cashout_requests WHERE wallet_id=$1 AND idempotency_key=$2",[wallet.id,key]);
    if(existing[0]) {
      if(cents(existing[0].amount)!==amount||existing[0].destination_id!==input.destination_id||String(existing[0].requested_by)!==String(actorId)) throw paymentError("This request ID was used for a different cashout.",409);
      return existing[0];
    }
    const {rows:settings}=await client.query("SELECT minimum_cashout FROM finance_settings WHERE id=true");
    if(amount<cents(settings[0].minimum_cashout)) throw paymentError(`The minimum cashout is PHP ${settings[0].minimum_cashout}.`);
    const {rows:destinations}=await client.query("SELECT id FROM wallet_destinations WHERE id=$1 AND wallet_id=$2 AND status='approved'",[input.destination_id,wallet.id]);
    if(!destinations[0]) throw paymentError(kind==="bao"?"Choose an available BAO payout destination.":"Choose an approved payout destination.");
    const balance=await balances(client,wallet.id);
    if(balance.debt>0) throw paymentError("Refund recovery must be settled before requesting a cashout.",409);
    if(amount>balance.available) throw paymentError("The requested amount exceeds your available balance.",409);
    const {rows}=await client.query("INSERT INTO cashout_requests(wallet_id,seller_id,destination_id,amount,idempotency_key,requested_by,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status",[wallet.id,owner,input.destination_id,pesos(amount),key,actorId,kind==="bao"?"approved":"pending"]);
    const details={walletId:wallet.id,amount,kind:"cashout_reserved",cashoutId:rows[0].id};
    await post(client,{...details,bucket:"available",amount:-amount,key:`reserve:${rows[0].id}:available`});
    await post(client,{...details,bucket:"reserved",key:`reserve:${rows[0].id}:reserved`});
    await auditFinance(client,actorId,kind==="bao"?"bao_cashout_requested":"cashout_requested","cashout_request",rows[0].id,`Requested PHP ${pesos(amount)}${kind==="bao"?"; ready for transfer without manual review":""}`);
    await staffNotice(client,kind==="bao"?`BAO commission withdrawal ${rows[0].id} for PHP ${pesos(amount)} is ready for transfer.`:`Cashout ${rows[0].id} for PHP ${pesos(amount)} is awaiting review.`);return rows[0];
  });
}
export async function reviewDestination(actorId,id,action,reason="") {
  uuid(id);if(!["approve","reject"].includes(action)) throw paymentError("Invalid destination action.");
  if(action==="reject"&&!reason.trim()) throw paymentError("A rejection reason is required.");
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,["bao","admin"]);
    const {rows}=await client.query("SELECT d.*,w.kind FROM wallet_destinations d JOIN wallets w ON w.id=d.wallet_id WHERE d.id=$1 FOR UPDATE OF d",[id]);
    const destination=rows[0];
    if(destination?.kind==="bao") throw paymentError("BAO payout destinations do not require manual review.",409);
    if(!destination||destination.status!=="pending") throw paymentError("Destination was already reviewed or does not exist.",409);
    const status=action==="approve"?"approved":"rejected";
    await client.query("UPDATE wallet_destinations SET status=$1,reviewed_by=$2,reviewed_at=now(),remarks=$3 WHERE id=$4",[status,actorId,reason.trim().slice(0,1000)||null,id]);
    await auditFinance(client,actorId,`${destination.kind==="bao"?"bao_":""}payout_destination_${status}`,"wallet_destination",id,reason||null);
    await financialNotice(client,destination.submitted_by,`Your ${destination.kind==="bao"?"BAO commission ":""}payout destination was ${status}. ${reason}`);return {success:true};
  });
}
export async function reviewCashout(actorId,id,action,reason="") {
  uuid(id);if(!["approve","reject","cancel"].includes(action)) throw paymentError("Invalid cashout action.");
  if(action==="reject"&&!reason.trim()) throw paymentError("A rejection reason is required.");
  return db.transaction(async client=>{
    await financeLock(client);await currentActor(client,actorId,["bao","admin"]);
    const {rows}=await client.query("SELECT c.*,w.kind FROM cashout_requests c JOIN wallets w ON w.id=c.wallet_id WHERE c.id=$1 FOR UPDATE OF c",[id]);
    const request=rows[0];
    if(!request) throw paymentError("Cashout not found.",404);
    if(request.kind==="bao"&&action!=="cancel") throw paymentError("BAO commission withdrawals do not require manual review.",409);
    if(action==="cancel") {
      if(request.kind!=="bao") throw paymentError("Only BAO commission withdrawals can be cancelled here.");
      if(!["pending","approved"].includes(request.status)) throw paymentError("Only withdrawals awaiting transfer can be cancelled.",409);
      const {rows:payouts}=await client.query("SELECT id FROM payouts WHERE cashout_id=$1",[id]);
      if(payouts.length) throw paymentError("A transfer is already attached to this withdrawal.",409);
      reason=reason.trim()||"Cancelled before transfer.";
    } else if(request.status!=="pending") throw paymentError("This cashout is no longer awaiting review.",409);
    const balance=await balances(client,request.wallet_id);
    if(action==="approve"&&balance.debt) throw paymentError("This wallet has outstanding refund recovery.",409);
    if(action==="reject"||action==="cancel") {
      await post(client,{walletId:request.wallet_id,bucket:"reserved",amount:-cents(request.amount),kind:"cashout_released",key:`reject:${id}:reserved`,cashoutId:id});
      await availableCredit(client,request.wallet_id,cents(request.amount),{kind:"cashout_released",key:`reject:${id}`,cashoutId:id});
    }
    const status=action==="cancel"?"cancelled":action==="approve"?"approved":"rejected";
    await client.query("UPDATE cashout_requests SET status=$1,reason=$2,reviewed_by=$3,reviewed_at=now(),updated_at=now() WHERE id=$4",[status,reason.trim().slice(0,1000)||null,actorId,id]);
    await auditFinance(client,actorId,`${request.kind==="bao"?"bao_":""}cashout_${status}`,"cashout_request",id,reason||null);
    await financialNotice(client,request.requested_by,`Your cashout request for PHP ${request.amount} was ${status}. ${reason}`);
    return {success:true,status};
  });
}

// Demo fallback: staff initiates transfers in an authorized PayMongo dashboard.
// A withdrawal only completes after a matching provider transfer is verified.
export async function verifyPayout(actorId,cashoutId,transferId) {
  uuid(cashoutId);
  if(process.env.PAYMONGO_PAYOUTS_ENABLED!=="true") throw paymentError("Payout verification requires an activated PayMongo test wallet. A cashout request does not transfer funds.",503);
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
    if(!["approved","processing"].includes(request.status)) throw paymentError("This cashout is not ready for transfer verification.",409);
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
    if(target!=="processing") await financialNotice(client,request.requested_by,`Cashout for PHP ${request.amount} ${target==="completed"?"has a confirmed test transfer":"failed; reserved funds have been released"}.`);
    return {success:true,status:target};
  });
}

export async function financeDashboard() {
  return db.transaction(async client=>{
    await financeLock(client);const wallet=await walletFor(client),balance=await balances(client,wallet.id);
    const {rows:totals}=await client.query(
      `${commissionRecordsSql}
       SELECT
       COALESCE((SELECT SUM(amount-refunded_amount) FROM payments WHERE status IN ('paid','partially_refunded','refunded')),0) AS sales,
       COALESCE(SUM(commission_amount) FILTER (WHERE is_earned),0) AS commission,
       COALESCE(SUM(commission_amount) FILTER (WHERE is_earned AND payment_method <> 'paymongo'),0) AS cod_commission,
       COALESCE(SUM(commission_amount) FILTER (WHERE is_earned AND payment_method = 'paymongo'),0) AS online_commission,
       COALESCE((SELECT SUM(amount) FROM cashout_requests WHERE status='completed' AND seller_id IS NOT NULL),0) AS withdrawals
       FROM commission_records`);
    const {rows:payments}=await client.query("SELECT id,reference,amount,refunded_amount,fee_amount,status,created_at,paid_at FROM payments ORDER BY created_at DESC LIMIT 100");
    const {rows:cashouts}=await client.query("SELECT c.id,c.amount,c.status,c.reason,c.created_at,c.requested_by,w.kind AS wallet_kind,u.name,d.institution,d.account_name,d.account_last_four,p.provider_transfer_id,p.reference AS payout_reference FROM cashout_requests c JOIN users u ON u.id=c.requested_by JOIN wallets w ON w.id=c.wallet_id JOIN wallet_destinations d ON d.id=c.destination_id LEFT JOIN payouts p ON p.cashout_id=c.id ORDER BY c.created_at DESC LIMIT 100");
    const {rows:destinations}=await client.query("SELECT d.id,d.institution,d.account_name,d.account_last_four,d.status,d.created_at,d.submitted_by,w.kind AS wallet_kind,u.name AS seller_name FROM wallet_destinations d JOIN users u ON u.id=d.submitted_by JOIN wallets w ON w.id=d.wallet_id WHERE d.status='pending' ORDER BY d.created_at");
    const {rows:commissionDestinations}=await client.query("SELECT d.id,d.institution,d.account_name,d.account_last_four,d.status,d.remarks,d.submitted_by,u.name AS submitted_by_name FROM wallet_destinations d JOIN users u ON u.id=d.submitted_by WHERE d.wallet_id=$1 ORDER BY d.created_at DESC",[wallet.id]);
    const {rows:commissionCashouts}=await client.query("SELECT c.id,c.amount,c.status,c.reason,c.created_at,c.requested_by,u.name,d.institution,d.account_last_four,p.reference AS payout_reference FROM cashout_requests c JOIN users u ON u.id=c.requested_by JOIN wallet_destinations d ON d.id=c.destination_id LEFT JOIN payouts p ON p.cashout_id=c.id WHERE c.wallet_id=$1 ORDER BY c.created_at DESC LIMIT 100",[wallet.id]);
    const {rows:commissionHistory}=await client.query("SELECT id,bucket,amount,kind,order_id,cashout_id,created_at FROM wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100",[wallet.id]);
    const {rows:commissionTotals}=await client.query("SELECT COALESCE(SUM(amount),0) AS withdrawals FROM cashout_requests WHERE wallet_id=$1 AND status='completed'",[wallet.id]);
    const {rows:settings}=await client.query("SELECT minimum_cashout,release_policy FROM finance_settings WHERE id=true");
    const {rows:commissionReport}=await client.query("SELECT a.seller_id,u.name,COUNT(*) AS orders,SUM(a.gross_amount-a.refunded_amount) AS sales,SUM(a.commission_amount-a.commission_refunded) AS commission,SUM(a.seller_amount-a.seller_refunded) AS earnings FROM payment_allocations a JOIN users u ON u.id=a.seller_id JOIN payments p ON p.id=a.payment_id WHERE p.status IN ('paid','partially_refunded','refunded') GROUP BY a.seller_id,u.name ORDER BY SUM(a.gross_amount-a.refunded_amount) DESC");
    return {balances:Object.fromEntries(Object.entries(balance).map(([key,value])=>[key,pesos(value)])),totals:totals[0],payments,cashouts,destinations,commissionReport,commissionWallet:{destinations:commissionDestinations,cashouts:commissionCashouts,history:commissionHistory,withdrawals:commissionTotals[0].withdrawals},settings:settings[0],mode:"test",payoutsEnabled:process.env.PAYMONGO_PAYOUTS_ENABLED==="true"};
  });
}
