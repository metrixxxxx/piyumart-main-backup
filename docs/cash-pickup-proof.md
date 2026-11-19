# Order completion photo proof

The buyer must upload a photo of the received items before marking a cash-on-pickup
or online transaction completed. In **My orders**, an order that is ready to receive shows **Upload proof
& complete**. The dialog previews a JPG, PNG, or WebP photo (maximum 5 MB) and asks
the buyer to confirm receipt. Cash buyers also confirm that they paid the seller;
online buyers are reminded that payment was made online. A photo does not confirm
or replace PayMongo payment verification.

The photo is uploaded by the server to the private `pickup-proofs` bucket with an
order-specific random object key. The server checks ownership, order state, file
size, MIME type, and image signature. Client-provided image URLs or proof flags
cannot satisfy the requirement. Saving the proof reference, completing the order,
updating sold counts, recording cash commission or releasing eligible online
allocations, and recording the notification share one database transaction.
Upload or transaction failures leave the order open and
attempt to remove the unused object. Concurrent confirmations complete only once.

**View proof photo** is available to the buyer, the order's seller, and authorized
BAO staff. Access checks happen before issuing a signed URL that expires after 60
seconds. Listing APIs return a proof-presence flag instead of the storage key.
The photo remains private even if other buckets have broad Storage policies.

For an existing cash-proof setup, apply the online extension migration. For a new
environment, apply these migrations in order before using the updated routes:

- [Order columns and completion guard](../migrations/add_cash_pickup_proof.sql)
- [Private photo bucket and access policy](../migrations/add_cash_pickup_proof_storage.sql)
- [Extend the completion guard to online orders](../migrations/add_online_order_photo_proof.sql)

The migrations can be replayed in this order. Existing completed transactions
remain unchanged; all future cash and online completions require a photo, including
orders below the commission threshold. A database trigger also rejects completion without a proof reference
and upload time, and prevents replacing saved proof on a completed order. Under
the buyer-confirmation release policy, online funds remain pending until the
photo and receipt confirmation are saved successfully. Concurrent confirmations
cannot release the same allocation twice.

Verification uses synthetic records and mocked Storage/payment services:

```powershell
node --experimental-vm-modules --test tests/cash-pickup-proof.test.mjs
$env:PIYUMART_FINANCE_DB_TEST='1'
node --experimental-vm-modules --test tests/cash-pickup-proof.integration.test.mjs
```

An optional real Storage check uploads and removes one synthetic image without
creating an order or transaction:

```powershell
$env:PIYUMART_PICKUP_STORAGE_TEST='1'
node tests/cash-pickup-proof-storage-smoke.mjs
```
