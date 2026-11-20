# Seller verification

The marketplace uses NextAuth for buyers/sellers, signed staff cookies for BAO/admin,
and the existing `pg` transaction helper. Permissions are loaded from `users` on
the server. Only active sellers can use listing management. Existing staff product
moderation remains available through its staff endpoints.

## Setup

Run `migrations/add_seller_verification_support.sql` in Supabase SQL Editor after
the migration you already ran. This adds the optional application `note`, a partial
unique index for one pending application per user, and the private `seller-proofs`
bucket with a 5 MB limit and JPG/PNG/PDF MIME types. It also restricts direct anon
and Supabase-authenticated access to applications and proof objects: custom auth
uses server routes instead.

Apply `migrations/add_seller_application_cor.sql` before deploying the two-file
application form. Earlier applications keep their original upload.

The server needs the existing `DATABASE_URL`, `NEXTAUTH_SECRET`,
`NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service
role key in a `NEXT_PUBLIC_` variable. Each document field stores a private object
key. The BAO review URL stays the same and checks the current staff session each
time it serves a document from the private bucket.

Edit `LSPU_DEPARTMENTS` and `MEETUP_POINTS` in `lib/campus.js` for your campus.
The initial college names follow the [LSPU college directory](https://lspu.edu.ph/academic_colleges).
Application approval sets `users.department`; listing creation copies that server
value. Department submitted with a listing is ignored. Existing listings without
these fields show fallback text; editing a listing requires a meetup location.

If an upload logs `ENOTFOUND` for a host ending in `.supabase.com`, correct
`NEXT_PUBLIC_SUPABASE_URL` to the project's `.supabase.co` URL. Reload the dev
server after changing environment variables. A missing `seller-proofs` bucket or
application `note` column means the support migration above still needs to run.

## Automated verification

```text
npm run build
node --experimental-vm-modules --test tests/seller-verification.test.mjs
```

The unit tests exercise real route handlers and transaction code with isolated
database/Storage boundaries. They cover role spoofing, suspended sellers, listing
validation, both required uploads, partial upload cleanup, pending submission serialization, reusable private review links,
reviewer revalidation, approval/rejection, and rollback on notification/audit failure.
They do not apply the migration or write to live Supabase.

With the local server running (`node server.js`):

```text
node tests/seller-verification-smoke.mjs
```

This makes anonymous HTTP requests to the running app and checks sign-in redirects
and protected API denials. Authenticated end-to-end and visual checks must be
completed with test accounts after applying the support migration.

## Manual test steps

### A. Normal user is blocked

1. Sign in as an active `users.role = 'user'` account. The desktop account menu and
   mobile menu show **Become a seller**; seller dashboard links are hidden.
2. Open `/sell`. The application screen appears, with no listing editor. Opening
   `/my-listings` redirects to `/sell`.
3. In the browser console on the app's origin, run the following. All five requests
   must return **403**, including empty bodies. Repeat after changing any
   client-visible role to `seller`; access must still be denied.

```js
for (const [url, method] of [
  ['/api/sell', 'POST'], ['/api/sell', 'PUT'], ['/api/sell', 'DELETE'],
  ['/api/my-listings/1', 'PATCH'], ['/api/my-listings/1', 'DELETE'],
]) {
  console.log(method, url, (await fetch(url, { method })).status);
}
```

4. Anonymous requests return **401**. An active buyer or seller also cannot view
   the staff application list, request proof links, or approve applications.

### B. Apply and re-apply

1. Choose a department on `/sell` and upload both a student ID and a Certificate of
   Registration (COR). Each file can be a JPG, PNG, or PDF up to 5 MB. Optionally
   add a note and submit. Expect **Your application is under review**.
2. Verify one pending `seller_applications` row with your authenticated user ID,
   department, optional note, and distinct object keys in `id_proof_url` and
   `cor_proof_url`. Both objects belong in the private `seller-proofs` bucket.
   The application status response omits both keys.
3. Attempt submission in two tabs at once. One succeeds and the other returns
   **409**; there is only one pending row. Try an unsupported file, an oversized
   file, and a text file renamed to `.png`: the server rejects them.
4. Have BAO reject this application with a reason. Revisit `/sell`: confirm the
   reason and new application form appear. Re-apply with both documents and
   confirm the old rejected row remains and one new pending row is inserted.

### C. BAO/admin reviews

1. Sign in through the existing staff flow. BAO opens **Seller Applications** at
   `/bao/seller-applications`; admin opens it from the dashboard navigation at
   `/dashboard/seller-applications`.
2. Switch Pending / Approved / Rejected. Check applicant name, email, department,
   submission date, and optional note. Use **Review files** to open the student ID
   and COR. Reopen each URL after a minute while signed in, then sign out and
   verify a new request to either URL requires a BAO session. Older applications
   show the single original upload. For an older pending application, reject it
   with a reason asking the applicant to re-apply with both files.
3. Approve a pending application. Verify `status = 'approved'`, `reviewed_by`,
   `reviewed_at`, `users.role = 'seller'`, and `users.department` copied from the
   application. Verify one user notification and one `bao_audit_logs` entry with
   `entity_type = 'seller_application'`, actor, entity ID, and metadata.
4. Verify Reject requires a nonblank reason. Reject a second application and
   check remarks, review fields, notification, audit entry, and unchanged buyer role.
5. Review the same application in two staff tabs. Only one decision succeeds;
   the second returns **409**, without another notification or audit entry.

### D. New seller creates and edits a listing

1. Return to the approved account's `/sell` tab. It refreshes after approval
   while pending, or on focus/page refresh. The menu now shows **Sell a Product**.
2. Create a listing and choose **Library**. Save it and verify
   `products.department = users.department` and `products.meetup_point = 'Library'`.
   Omitting or sending a whitespace-only meetup point must return **400**.
3. Edit it, choose **Other**, and enter a campus location. Verify it persists and
   is prefilled when editing again. A blank custom location must be rejected.
4. Listings still follow the existing BAO product approval flow. Approve the
   listing through product moderation, then use a separate buyer account to
   verify department and meetup on its card, product details, Buy Now checkout,
   cart checkout, selected-cart checkout, and the placed order summary.
5. Send another seller's listing ID to the edit/delete routes. Ownership checks
   must deny it. Suspend the seller through the existing BAO flow and confirm
   listing mutations return **403**.

## Changed files

See the complete file inventory below (including this guide and the test scripts).

```text
app/(dashboard)/dashboard/page.jsx
app/(dashboard)/dashboard/seller-applications/page.jsx
app/(shop)/checkout/page.jsx
app/(shop)/my-listings/layout.jsx
app/(shop)/my-orders/page.jsx
app/(shop)/products/[id]/page.jsx
app/(shop)/sell/page.jsx
app/api/bao/seller-applications/route.js
app/api/bao/seller-applications/[id]/route.js
app/api/bao/seller-applications/[id]/proof/route.js
app/api/cart/route.js
app/api/my-listings/route.js
app/api/my-listings/[id]/route.js
app/api/my-listings/stats/route.js
app/api/orders/route.js
app/api/products/search/route.js
app/api/sell/route.js
app/api/seller-applications/route.js
app/api/seller/orders/route.js
app/api/seller/reviews/route.js
app/bao/seller-applications/page.jsx
components/BecomeSeller.jsx
components/Footer.jsx
components/SellManager.jsx
components/bao/BaoHeader.jsx
components/bao/SellerApplications.jsx
components/products/ListingLocation.jsx
components/products/ProductCard.js
components/ui/navbar.jsx
lib/authOptions.js
lib/campus.js
lib/seller-access.js
lib/seller-applications.js
lib/seller-proof.js
migrations/add_seller_verification_support.sql
migrations/add_seller_application_cor.sql
tests/seller-verification.test.mjs
tests/seller-verification-smoke.mjs
docs/seller-verification.md
```
