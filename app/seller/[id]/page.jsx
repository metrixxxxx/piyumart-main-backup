import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProductCard from "@/components/products/ProductCard";

export default async function SellerPage({ params }) {
  const { id } = await params;
  const sellerId = Number(id);
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    notFound();
  }

  const [sellerRows] = await db.query(
    `SELECT id, name, last_name, email, contact_number, address, image, role, status, created_at
     FROM users
     WHERE id = $1`,
    [sellerId]
  );

  if (!sellerRows || sellerRows.length === 0) {
    notFound();
  }

  const seller = sellerRows[0];
  const sellerName = `${seller.name}${seller.last_name ? ` ${seller.last_name}` : ""}`.trim();

  const [productRows] = await db.query(
    `SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock, p.seller_id, p.seller_name, p.category_id, c.name as category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.seller_id = $1
       AND p.is_visible = true
     ORDER BY p.created_at DESC`,
    [sellerId]
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] text-[#1a1060] dark:text-[#f0ede8] transition-colors duration-300">
      <section className="max-w-[1100px] mx-auto px-5 py-10">
        <div className="bg-white dark:bg-[#12121a] rounded-3xl border border-[#e8e5f0] dark:border-white/[0.07] shadow-[0_16px_48px_rgba(16,24,40,0.08)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-[#ede9ff] dark:bg-[#c9a96e]/10 flex items-center justify-center text-4xl font-bold text-[#6d4aff] dark:text-[#c9a96e]">
                {seller.image ? (
                  <img src={seller.image} alt={sellerName} className="w-full h-full object-cover" />
                ) : (
                  <span>{sellerName.split(" ").map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#6d4aff] dark:text-[#c9a96e] font-semibold mb-1">Seller profile</p>
                <h1 className="text-3xl font-extrabold tracking-tight">{sellerName || "Unknown Seller"}</h1>
                <p className="mt-2 text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/60 max-w-2xl">
                  Explore products from this seller and check their campus marketplace activity. Sellers are shown with their verified profile details and available listings.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-[#1a1060]/70 dark:text-[#f0ede8]/60">
              <div className="rounded-2xl bg-[#f9fafb] dark:bg-white/[0.04] p-4 border border-[#f0f0f0] dark:border-white/[0.05]">
                <p className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-2">Products</p>
                <p className="text-2xl font-bold">{productRows.length}</p>
              </div>
              <div className="rounded-2xl bg-[#f9fafb] dark:bg-white/[0.04] p-4 border border-[#f0f0f0] dark:border-white/[0.05]">
                <p className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-2">Status</p>
                <p className="font-semibold capitalize">{seller.status || "active"}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#f0f0f0] dark:border-white/[0.05] px-6 py-8 md:px-10">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="rounded-3xl bg-[#f9fafb] dark:bg-white/[0.04] p-6 border border-[#f0f0f0] dark:border-white/[0.05]">
                  <h2 className="text-lg font-semibold mb-4">About this seller</h2>
                  <div className="space-y-3 text-sm text-[#1a1060]/70 dark:text-[#f0ede8]/70">
                    <p><span className="font-semibold">Email:</span> {seller.email || "Not shared"}</p>
                    <p><span className="font-semibold">Contact:</span> {seller.contact_number || "Not available"}</p>
                    <p><span className="font-semibold">Address:</span> {seller.address || "Not available"}</p>
                    <p><span className="font-semibold">Joined:</span> {new Date(seller.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl bg-[#f9fafb] dark:bg-white/[0.04] p-6 border border-[#f0f0f0] dark:border-white/[0.05]">
                <h2 className="text-lg font-semibold mb-4">Seller activity</h2>
                <p className="text-sm text-[#1a1060]/70 dark:text-[#f0ede8]/70 mb-4">
                  Buyers can view the seller&apos;s active listings, contact details, and campus reputation while browsing the marketplace.
                </p>
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6d4aff] dark:text-[#c9a96e] hover:underline">
                  Browse other products
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-[#f0f0f0] dark:border-white/[0.05] px-6 py-8 md:px-10">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold">Products sold by {seller.name}</h2>
                <p className="text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/60">See all available listings from this seller.</p>
              </div>
              <Link href="/" className="text-xs uppercase tracking-[0.2em] font-semibold text-[#6d4aff] dark:text-[#c9a96e] hover:underline">
                Browse all products
              </Link>
            </div>

            {productRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#c4b5fd] dark:border-[#c9a96e]/50 bg-[#faf8ff] dark:bg-[#111118] p-10 text-center">
                <p className="text-sm text-[#1a1060]/70 dark:text-[#f0ede8]/70">This seller has no visible products right now.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {productRows.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
