"use client";

import ActionFeedback from "@/components/ui/ActionFeedback";
import { useEffect, useState } from "react";
import Image from "next/image";
import ConfirmModal from "@/components/ui/ConfirmModal";

const PRODUCT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "active", label: "Legacy active" },
  { value: "all", label: "All statuses" },
];

const ACTION_LABELS = {
  approve: "Approve product",
  reject: "Reject product",
  suspend: "Suspend product",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-PH") : "—";
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function StatusBadge({ status }) {
  const styles = {
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
    suspended: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${styles[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
      {status || "unknown"}
    </span>
  );
}

export default function BaoProductsPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [product, setProduct] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [detailRequest, setDetailRequest] = useState({ key: "", error: "" });
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [working, setWorking] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const detailRequestKey = selectedProductId ? `${selectedProductId}:${refreshKey}` : "";
  const detailLoading = Boolean(selectedProductId) && detailRequest.key !== detailRequestKey;
  const detailError = detailRequest.key === detailRequestKey ? detailRequest.error : "";

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ status: statusFilter });
    if (search) params.set("search", search);

    fetch(`/api/bao/products?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load products.");
        if (!active) return;
        setListError("");
        setProducts(data);
        setSelectedProductId((current) =>
          current && data.some((item) => String(item.id) === String(current))
            ? current
            : data[0]?.id ?? null
        );
      })
      .catch((error) => {
        console.error("BAO product list request failed:", error);
        if (active) setListError(error.message || "Unable to load products.");
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter, search, refreshKey]);

  useEffect(() => {
    if (!selectedProductId) return;

    let active = true;
    const requestKey = `${selectedProductId}:${refreshKey}`;

    fetch(`/api/bao/products/${selectedProductId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load product details.");
        if (active) {
          setProduct(data);
          setDetailRequest({ key: requestKey, error: "" });
        }
      })
      .catch((error) => {
        console.error("BAO product detail request failed:", error);
        if (active) {
          setDetailRequest({
            key: requestKey,
            error: error.message || "Unable to load product details.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedProductId, refreshKey]);

  async function moderateProduct() {
    if (!pendingAction || !product) return;
    const trimmedReason = reason.trim();
    if (pendingAction === "reject" && !trimmedReason) {
      setReasonError("A reason is required to reject a product.");
      setPendingAction("");
      return;
    }

    setWorking(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await fetch(`/api/bao/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingAction, reason: trimmedReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update product.");

      let notice = `${product.name} was ${pendingAction === "approve" ? "approved" : pendingAction === "reject" ? "rejected" : "suspended"}.`;
      if (pendingAction === "suspend") {
        const cancelled = data.cancelledOrders?.length || 0;
        const pending = data.pendingRefunds?.length || 0;
        const failed = data.failedRefunds?.length || 0;
        if (cancelled) notice += ` ${cancelled} order(s) cancelled.`;
        if (pending) notice += ` ${pending} PayMongo refund(s) are processing.`;
        setActionError(failed ? `${failed} PayMongo refund(s) need BAO review.` : "");
      }
      setActionNotice(notice);
      setReason("");
      setReasonError("");
      setPendingAction("");
      setListLoading(true);
      setListError("");
      setRefreshKey((current) => current + 1);
    } catch (error) {
      console.error("Product moderation action failed:", error);
      setActionError(error.message || "Unable to update product.");
      setPendingAction("");
    } finally {
      setWorking(false);
    }
  }

  async function toggleFeatured() {
    if (!product || working) return;
    setWorking(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await fetch(`/api/bao/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_feature" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update featured status.");

      setProduct((current) => ({ ...current, is_featured: data.product.is_featured }));
      setProducts((current) => current.map((item) =>
        String(item.id) === String(data.product.id)
          ? { ...item, is_featured: data.product.is_featured }
          : item
      ));
      setActionNotice(`${product.name} ${data.product.is_featured ? "was featured" : "was removed from featured products"}.`);
    } catch (error) {
      console.error("Product feature update failed:", error);
      setActionError(error.message || "Unable to update featured status.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteProduct() {
    if (!product || working) return;
    setWorking(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await fetch(`/api/bao/products/${product.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete product.");

      setProducts((current) => current.filter((item) => String(item.id) !== String(product.id)));
      setSelectedProductId(null);
      setProduct(null);
      setDeleteConfirmOpen(false);
      setActionNotice(`${product.name} was deleted.`);
    } catch (error) {
      console.error("Product deletion failed:", error);
      setActionError(error.message || "Unable to delete product.");
    } finally {
      setWorking(false);
    }
  }

  const selectedImages = product?.images?.length
    ? product.images
    : product?.image_url
      ? [product.image_url]
      : [];

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#927116] dark:text-[#e3c36c]">
            Marketplace management
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2a6c] dark:text-white sm:text-4xl">
            Product moderation
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Review listing details, photos, seller information, and moderation history.
          </p>
        </div>

        {actionNotice ? (
          <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
            {actionNotice}
          </div>
        ) : null}
        {actionError ? (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {actionError}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b] sm:grid-cols-[minmax(0,1fr)_220px]">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setListLoading(true);
              setListError("");
              setSearch(searchInput.trim());
            }}
          >
            <label className="sr-only" htmlFor="bao-product-search">Search products or sellers</label>
            <input
              id="bao-product-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search products or sellers"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
            />
            <button type="submit" className="rounded-xl bg-[#1a2a6c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24377f]">
              Search
            </button>
          </form>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setListLoading(true);
                setListError("");
                setStatusFilter(event.target.value);
              }}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:text-slate-100 dark:focus:border-[#c9a028]"
            >
              {PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        {listError ? (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {listError}
          </div>
        ) : null}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
          <section aria-label="Products to moderate" className="space-y-3">
            {listLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-[#111a2b]">
                <h2 className="font-semibold text-[#1a2a6c] dark:text-white">No products found</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Try another status or search term.
                </p>
              </div>
            ) : (
              products.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedProductId(item.id)}
                  aria-pressed={String(selectedProductId) === String(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition ${
                    String(selectedProductId) === String(item.id)
                      ? "border-[#c9a028] bg-[#fffdf6] ring-1 ring-[#c9a028]/40 dark:bg-[#231e10]"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700/70 dark:bg-[#111a2b] dark:hover:border-slate-600"
                  }`}
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    {item.image_url ? (
                      <Image src={item.image_url} alt="" fill sizes="64px" unoptimized className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-slate-400">No image</span>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{item.name}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.seller_name || "Unknown seller"}</span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <span className="text-xs font-semibold text-[#1a2a6c] dark:text-[#e9d48f]">{formatPrice(item.price)}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </section>

          <section aria-label="Selected product details" className="min-w-0">
            {!selectedProductId ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Select a product to review its details.
              </div>
            ) : detailLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Loading product details...
              </div>
            ) : detailError ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
                {detailError}
              </div>
            ) : !product ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#111a2b] dark:text-slate-400">
                Select a product to review its details.
              </div>
            ) : (
              <div className="space-y-4">
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-extrabold text-[#1a2a6c] dark:text-white">{product.name}</h2>
                          <StatusBadge status={product.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {product.category_name || "Uncategorized"} · Submitted {formatDate(product.created_at)}
                        </p>
                      </div>
                      <p className="text-lg font-extrabold text-[#1a2a6c] dark:text-[#e9d48f]">{formatPrice(product.price)}</p>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {product.description || "No description provided."}
                    </p>
                  </div>

                  <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)]">
                    <div>
                      <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Product photos</h3>
                      {selectedImages.length ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {selectedImages.map((url, index) => (
                            <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                              <Image src={url} alt={`${product.name} photo ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 180px" unoptimized className="object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                          No product photos provided.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Seller</h3>
                        <p className="mt-2 text-sm font-semibold">{product.seller?.name || product.seller_name || "Unknown seller"}</p>
                        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{product.seller?.email || "No email available"}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product.seller?.contact_number || "No contact number"}</p>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Stock: {product.stock ?? 0}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Visibility preference: {product.is_visible ? "Visible" : "Hidden"}</p>
                      </div>

                      {product.variants?.length ? (
                        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Variants</h3>
                          <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            {product.variants.map((variant) => (
                              <li key={variant.id || variant.label} className="flex justify-between gap-3">
                                <span>{variant.name || variant.label || variant.value}</span>
                                <span>{variant.stock != null ? `${variant.stock} in stock` : ""}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {product.attributes?.length ? (
                        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Product attributes</h3>
                          <dl className="mt-2 space-y-2 text-xs">
                            {product.attributes.map((attribute, index) => (
                              <div key={`${attribute.name}-${index}`} className="flex justify-between gap-3">
                                <dt className="text-slate-500 dark:text-slate-400">{attribute.label || attribute.name}</dt>
                                <dd className="text-right font-medium">{attribute.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                    <label htmlFor="moderation-reason" className="mb-2 block text-sm font-bold text-slate-900 dark:text-white">
                      Moderation reason
                    </label>
                    <textarea
                      id="moderation-reason"
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setReasonError("");
                      }}
                      rows={3}
                      maxLength={1000}
                      placeholder="Required when rejecting. Add context for other moderation actions if helpful."
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#1a2a6c] dark:border-slate-700 dark:bg-[#0b1220] dark:focus:border-[#c9a028]"
                    />
                    {reasonError ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-300">{reasonError}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={toggleFeatured}
                        disabled={working}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${
                          product.is_featured
                            ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        {product.is_featured ? "Remove featured" : "Feature product"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={working}
                        className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50"
                      >
                        Delete product
                      </button>
                      {product.status !== "approved" ? (
                        <button type="button" onClick={() => setPendingAction("approve")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
                          Approve
                        </button>
                      ) : null}
                      {product.status !== "rejected" ? (
                        <button type="button" onClick={() => setPendingAction("reject")} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800">
                          Reject
                        </button>
                      ) : null}
                      {product.status !== "suspended" ? (
                        <button type="button" onClick={() => setPendingAction("suspend")} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                          Suspend
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-[#111a2b]">
                  <h3 className="text-base font-extrabold text-[#1a2a6c] dark:text-white">Moderation history</h3>
                  {product.history?.length ? (
                    <ol className="mt-4 space-y-4">
                      {product.history.map((entry) => (
                        <li key={entry.id} className="border-l-2 border-[#c9a028] pl-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold capitalize text-slate-900 dark:text-white">
                              {entry.action.replaceAll("_", " ")}
                            </p>
                            <time className="text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.created_at)}</time>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            By {[entry.actor_name, entry.actor_last_name].filter(Boolean).join(" ") || `User ${entry.actor_id}`}
                          </p>
                          {entry.reason ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{entry.reason}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No moderation actions have been recorded for this product.</p>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingAction)}
        title={ACTION_LABELS[pendingAction] || "Confirm moderation action"}
        description={`Confirm that you want to ${pendingAction} this product. This action will be recorded in the BAO audit log.`}
        confirmText={ACTION_LABELS[pendingAction] || "Confirm"}
        onCancel={() => setPendingAction("")}
        onConfirm={moderateProduct}
        loading={working}
      />
      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete product?"
        description="This removes the product and its listing details. Products with related order records cannot be deleted."
        confirmText="Delete product"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={deleteProduct}
        loading={working}
      />
    <ActionFeedback pending={working} error={actionError} success={actionNotice} showLoading={false} successTitle="Listing updated" />
      </main>
  );
}
