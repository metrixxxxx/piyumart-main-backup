"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import ConfirmModal from "@/components/ui/ConfirmModal";
import FeedbackModal from "@/components/ui/FeedbackModal";
import LoadingModal from "@/components/ui/LoadingModal";

export default function SellPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [attributeDefs, setAttributeDefs] = useState([]);
  const [form, setForm] = useState({
    name: "", description: "", price: "", category_id: "", stock: "", is_visible: 1,
  });
  const [attrValues, setAttrValues] = useState({});
  const [mainImages, setMainImages] = useState([]);
  const [variants, setVariants] = useState([]);

  const handleMainImages = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setMainImages((prev) => [...prev, ...previews]);
  };

  const removeMainImage = (index) => setMainImages((prev) => prev.filter((_, i) => i !== index));
  const addVariant = () => setVariants((prev) => [...prev, { label: "", file: null, preview: null }]);
  const updateVariantLabel = (index, label) => setVariants((prev) => prev.map((v, i) => i === index ? { ...v, label } : v));
  const updateVariantImage = (index, file) => setVariants((prev) => prev.map((v, i) => i === index ? { ...v, file, preview: URL.createObjectURL(file) } : v));
  const removeVariant = (index) => setVariants((prev) => prev.filter((_, i) => i !== index));

  async function fetchCategories() {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  }

  async function fetchMyProducts() {
    try {
      const res = await fetch("/api/sell");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ name: "", description: "", price: "", category_id: "", stock: "", is_visible: 1 });
    setAttrValues({});
    setAttributeDefs([]);
    setMainImages([]);
    setVariants([]);
  }

 async function handleSubmit() {
  if (!form.name.trim() || !form.price || !form.category_id) {
    setFeedback({
      type: "error",
      title: "Missing product details",
      description: "Please enter a product name, price, and category before posting.",
    });
    return;
  }
  setSubmitting(true);
  const attributes = attributeDefs.map((def) => ({
    attribute_definition_id: def.id,
    value: attrValues[def.id] || "",
  }));
  const formData = new FormData();
  formData.append("name", form.name);
  formData.append("description", form.description);
  formData.append("price", form.price);
  formData.append("category_id", form.category_id);
  formData.append("stock", form.stock);
  formData.append("is_visible", form.is_visible);
  formData.append("attributes", JSON.stringify(attributes));
  if (editProduct) formData.append("id", editProduct.id);

  // ✅ FIX 1: separate new files from existing URLs
  const existingUrls = [];
  mainImages.forEach((img) => {
    if (img.file) {
      formData.append("images", img.file);
    } else {
      existingUrls.push(img.preview);
    }
  });
  formData.append("existing_image_urls", JSON.stringify(existingUrls));

  variants.forEach((v, i) => {
    formData.append(`variant_label_${i}`, v.label);
    if (v.file) formData.append(`variant_image_${i}`, v.file);
    else if (v.preview) formData.append(`variant_existing_image_${i}`, v.preview);
  });
  formData.append("variant_count", variants.length);

  try {
    const res = await fetch("/api/sell", { method: editProduct ? "PUT" : "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || data.message || "Failed to save product");
    await fetchMyProducts();
    setShowForm(false);
    setEditProduct(null);
    resetForm();
    setFeedback({
      type: "success",
      title: editProduct ? "Product updated" : "Product posted",
      description: editProduct ? "Your listing changes are now live." : "Your product is now available in the marketplace.",
    });
  } catch (err) {
    setFeedback({
      type: "error",
      title: "Unable to save product",
      description: err.message || "Please try again.",
    });
  } finally {
    setSubmitting(false);
  }
}

  async function handleDelete(id) {
    setConfirmDeleteId(id);
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setDeleting(true);
    try {
      const res = await fetch("/api/sell", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete product");
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setConfirmDeleteId(null);
      setFeedback({
        type: "success",
        title: "Product deleted",
        description: "The listing was removed from your shop.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        title: "Unable to delete product",
        description: err.message || "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  function handleEdit(product) {
  setEditProduct(product);
  setForm({
    name: product.name, description: product.description, price: product.price,
    category_id: product.category_id || "", stock: product.stock ?? 0, is_visible: product.is_visible ?? 1,
  });

  // ✅ FIX 2: pre-populate existing attribute values
  const existingAttrs = {};
  product.attributes?.forEach((a) => {
    existingAttrs[a.attribute_definition_id] = a.value;
  });
  setAttrValues(existingAttrs);

  setMainImages(
    product.images?.map((url) => ({ file: null, preview: url })) ||
    (product.image_url ? [{ file: null, preview: product.image_url }] : [])
  );
  setVariants(product.variants?.map((v) => ({ label: v.label, file: null, preview: v.image_url })) || []);
  setShowForm(true);
}

 useEffect(() => {
  async function fetchAttrs() {

    // ✅ no category selected
    if (!form.category_id) {
      setAttributeDefs([]);
      setAttrValues({});
      return;
    }

    try {
      const res = await fetch(
        `/api/attributes?category_id=${form.category_id}`
      );

      const data = await res.json();

      setAttributeDefs(Array.isArray(data) ? data : []);

      // keep existing values when editing
      if (!editProduct) {
        setAttrValues({});
      }

    } catch (err) {
      console.error(err);
      setAttributeDefs([]);
    }
  }

  fetchAttrs();
}, [form.category_id, editProduct]);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    async function init() { await fetchMyProducts(); await fetchCategories(); }
    init();
  }, [status]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("products:new", (product) => {
      if (String(product.seller_id) === String(session?.user?.id))
        setProducts((prev) => [product, ...prev]);
    });
    socket.on("products:updated", (updated) => {
      setProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p));
    });
    socket.on("products:deleted", ({ id }) => {
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
    });
    return () => {
      socket.off("products:new");
      socket.off("products:updated");
      socket.off("products:deleted");
    };
  }, [session?.user?.id]);

  if (status === "loading" || loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#eef2f7] dark:bg-[#070b14]">
        <p className="text-sm text-[#0e1a3d]/50 dark:text-[#e8edf8]/40">Loading...</p>
      </div>
    );

  return (
    <main className="min-h-screen bg-[#eef2f7] dark:bg-[#070b14] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-[#1a2a6c] dark:bg-[#0a0e1f] text-white text-center px-4 sm:px-5 py-10 sm:py-12">
        <h1 className="text-3xl font-bold">Sell Your Items</h1>
        <p className="text-white/60 mt-1.5 text-sm">What are you selling today? Add and manage your products here.</p>
      </section>

      <div className="max-w-[960px] mx-auto px-4 sm:px-5 py-6">

        {/* SELLER CARD */}
        <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-2xl p-4 flex flex-wrap items-center gap-3 mb-6 shadow-sm">
          <div className="w-11 h-11 rounded-full bg-[#1a2a6c] dark:bg-[#c9a028] flex items-center justify-center text-white dark:text-[#070b14] font-bold text-sm shrink-0">
            {session?.user?.name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm text-[#0e1a3d] dark:text-[#e8edf8]">{session?.user?.name}</h2>
            <p className="text-xs text-[#0e1a3d]/45 dark:text-[#e8edf8]/40">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => { setEditProduct(null); resetForm(); setShowForm(true); }}
            className="w-full text-xs font-semibold px-4 py-2 rounded-xl bg-[#1a2a6c] text-white hover:bg-[#142060] transition sm:w-auto"
          >
            + Add Product
          </button>
        </div>

        {/* FORM */}
        {showForm && (
          <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
            <h3 className="font-semibold text-sm mb-4 text-[#0e1a3d] dark:text-[#e8edf8]">
              {editProduct ? "Edit Product" : "Add Product"}
            </h3>
            <div className="grid gap-3">

              <input
                className="w-full px-3 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors"
                placeholder="Name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors resize-none"
                placeholder="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <input
                className="w-full px-3 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors"
                type="number" placeholder="Price" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />

              <select
                className="w-full px-3 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] focus:ring-2 focus:ring-[#1a2a6c] dark:focus:ring-[#c9a028] transition-colors appearance-none cursor-pointer"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option
  value=""
  className="bg-white dark:bg-[#0e1520] text-[#0e1a3d] dark:text-[#e8edf8]"
>
  No Category
</option>

{categories.map((c) => (
  <option
    key={c.id}
    value={c.id}
    className="bg-white dark:bg-[#0e1520] text-[#0e1a3d] dark:text-[#e8edf8]"
  >
    {c.name}
  </option>
))}
              </select>

              {attributeDefs.length > 0 && (
                <div className="grid gap-3">
                  {attributeDefs.map((def) => (
                    <div key={def.id}>
                      <label className="text-xs text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-1 block">{def.name}</label>
                      <input
                        className="w-full px-3 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors"
                        placeholder={def.name}
                        value={attrValues[def.id] || ""}
                        onChange={(e) => setAttrValues({ ...attrValues, [def.id]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
  <label className="text-xs font-semibold text-[#0e1a3d]/50 dark:text-[#e8edf8]/40 mb-1 block">
    Stock Quantity
  </label>
  <input
    className="w-full px-3 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 bg-[#f0f4ff] dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors"
    type="number" min="0" placeholder="e.g. 10"
    value={form.stock}
    onChange={(e) => setForm({ ...form, stock: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
  />
</div>

              {/* PRODUCT PHOTOS */}
              <div>
                <p className="text-xs font-semibold text-[#0e1a3d]/70 dark:text-[#e8edf8]/50 mb-2">Product Photos</p>
                <div className="flex flex-wrap gap-2.5 items-center">
                  {mainImages.map((img, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={img.preview} className="w-full h-full object-cover rounded-xl border border-[#c5cfe8] dark:border-white/10" />
                      <button
                        onClick={() => removeMainImage(i)}
                        className="absolute -top-1.5 -right-1.5 bg-[#e94560] text-white border-none rounded-full w-[18px] h-[18px] text-[10px] font-bold cursor-pointer flex items-center justify-center"
                      >✕</button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-[#d1d5db] dark:border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer text-[#9ca3af] dark:text-[#e8edf8]/30 text-[11px] gap-0.5 hover:border-[#1a2a6c] dark:hover:border-[#c9a028] transition-colors">
                    <span className="text-xl">+</span>
                    Add photo
                    <input type="file" accept="image/*" multiple onChange={handleMainImages} className="hidden" />
                  </label>
                </div>
              </div>

              {/* VARIANTS */}
              <div>
                <p className="text-xs font-semibold text-[#0e1a3d]/70 dark:text-[#e8edf8]/50 mb-2">
                  Variants <span className="font-normal text-[#0e1a3d]/35 dark:text-[#e8edf8]/30">(color, size, etc.)</span>
                </p>
                <div className="flex flex-col gap-2">
                  {variants.map((variant, i) => (
                    <div key={i} className="flex flex-col gap-2.5 bg-[#f9fafb] dark:bg-white/[0.04] rounded-xl px-3 py-2 border border-[#f3f4f6] dark:border-white/[0.06] sm:flex-row sm:items-center">
                      <label className="cursor-pointer shrink-0">
                        {variant.preview ? (
                          <img src={variant.preview} className="w-[52px] h-[52px] object-cover rounded-lg border border-[#e5e7eb] dark:border-white/10" />
                        ) : (
                          <div className="w-[52px] h-[52px] border-2 border-dashed border-[#d1d5db] dark:border-white/20 rounded-lg flex items-center justify-center text-[#9ca3af] dark:text-[#e8edf8]/30 text-lg">+</div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => updateVariantImage(i, e.target.files[0])} className="hidden" />
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Red - Large"
                        value={variant.label}
                        onChange={(e) => updateVariantLabel(i, e.target.value)}
                        className="w-full sm:flex-1 px-3 py-2 rounded-lg border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/[0.04] text-[#0e1a3d] dark:text-[#e8edf8] placeholder:text-[#0e1a3d]/30 dark:placeholder:text-[#e8edf8]/30 text-sm outline-none focus:border-[#1a2a6c] dark:focus:border-[#c9a028] transition-colors"
                      />
                      <button onClick={() => removeVariant(i)} className="bg-transparent border-none text-[#e94560] cursor-pointer text-lg leading-none">✕</button>
                    </div>
                  ))}
                  <button
                    onClick={addVariant}
                    className="flex items-center gap-1.5 bg-transparent border border-dashed border-[#d1d5db] dark:border-white/20 rounded-xl px-3.5 py-2 text-[#6b7280] dark:text-[#e8edf8]/40 text-xs cursor-pointer w-fit hover:border-[#1a2a6c] dark:hover:border-[#c9a028] hover:text-[#1a2a6c] dark:hover:text-[#c9a028] transition-colors"
                  >
                    + Add variant
                  </button>
                </div>
              </div>

              {/* VISIBILITY TOGGLE */}
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#0e1a3d]/70 dark:text-[#e8edf8]/55">
                <div
                  onClick={() => setForm({ ...form, is_visible: form.is_visible ? 0 : 1 })}
                  className={`relative w-[42px] h-6 rounded-full transition-colors duration-200 cursor-pointer
                    ${form.is_visible ? "bg-[#1a2a6c] dark:bg-[#c9a028]" : "bg-[#d1d5db] dark:bg-white/20"}`}
                >
                  <div className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-200
                    ${form.is_visible ? "left-[21px]" : "left-[3px]"}`}
                  />
                </div>
                {form.is_visible ? "Visible to buyers" : "Hidden from buyers"}
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a2a6c] text-white text-sm font-semibold hover:bg-[#142060] transition border-none cursor-pointer">
                  {submitting ? "Saving..." : editProduct ? "Save" : "Post"}
                </button>
                <button onClick={() => { setShowForm(false); setEditProduct(null); resetForm(); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#c5cfe8] dark:border-white/10 text-sm text-[#0e1a3d]/60 dark:text-[#e8edf8]/50 hover:bg-[#f0f4ff] dark:hover:bg-white/[0.04] transition bg-transparent cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MY PRODUCTS */}
        <h3 className="font-semibold text-sm mb-4 text-[#0e1a3d] dark:text-[#e8edf8]">My Products</h3>
        {products.length === 0 ? (
          <div className="bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-2xl text-center text-[#0e1a3d]/35 dark:text-[#e8edf8]/30 py-10 text-sm">
            No products yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => handleEdit(product)}
                className={`bg-white dark:bg-[#0e1520] border border-[#c5cfe8] dark:border-white/[0.07] rounded-2xl p-4 cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(26,42,108,0.1)] dark:hover:shadow-[0_8px_24px_rgba(201,160,40,0.08)] transition-all duration-200
                  ${product.is_visible ? "opacity-100" : "opacity-60"}`}
              >
                {/* Image */}
                <div className="relative">
                  <img
                    src={product.images?.[0] || product.image_url || "/placeholder.png"}
                    className="h-40 w-full object-cover rounded-xl"
                  />
                  {product.images?.length > 1 && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/55 text-white text-[11px] px-2 py-0.5 rounded-full">
                      +{product.images.length - 1} photos
                    </span>
                  )}
                  {!product.is_visible && (
                    <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                      <span className="text-white text-xs font-bold bg-[#555] px-3 py-1 rounded-full">Hidden</span>
                    </div>
                  )}
                  {product.stock === 0 && product.is_visible && (
                    <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
                      <span className="text-white text-xs font-bold bg-[#e94560] px-3 py-1 rounded-full">Out of Stock</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="mt-3">
                  <h4 className="font-semibold text-sm text-[#0e1a3d] dark:text-[#e8edf8]">{product.name}</h4>
                  <p className="text-sm font-bold text-[#1a2a6c] dark:text-[#c9a028]">₱{Number(product.price).toLocaleString()}</p>
                  <p className={`text-xs mt-0.5 font-medium ${product.stock === 0 ? "text-[#e94560]" : "text-[#16a34a]"}`}>
                    {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
                  </p>
                  {product.variants?.length > 0 && (
                    <p className="text-[11px] text-[#0e1a3d]/35 dark:text-[#e8edf8]/30 mt-0.5">
                      {product.variants.length} variant{product.variants.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2 mt-3 sm:flex-row">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                    className="flex-1 py-2 rounded-xl bg-[#1a2a6c] text-white text-xs font-semibold hover:bg-[#142060] transition border-none cursor-pointer"
                  >Edit</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                    className="flex-1 py-2 rounded-xl bg-[#e94560] text-white text-xs font-semibold hover:opacity-90 transition border-none cursor-pointer"
                  >Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(confirmDeleteId)}
        title="Delete product?"
        description="This will permanently remove the product from your listings."
        confirmText="Delete product"
        cancelText="Keep product"
        loading={deleting}
        onCancel={() => !deleting && setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
      <LoadingModal
        open={submitting}
        title={editProduct ? "Updating product" : "Posting product"}
        description="Uploading details and saving your listing."
      />
      <LoadingModal
        open={deleting}
        title="Deleting product"
        description="Removing this listing from your shop."
      />
      <FeedbackModal
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title}
        description={feedback?.description}
        onClose={() => setFeedback(null)}
      />
    </main>
  );
}
