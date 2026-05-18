"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function SellPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [attributeDefs, setAttributeDefs] = useState([]);
  const [form, setForm] = useState({
    name: "", description: "", price: "", category_id: "", stock: 0, is_visible: 1,
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
    setForm({ name: "", description: "", price: "", category_id: "", stock: 0, is_visible: 1 });
    setAttrValues({});
    setAttributeDefs([]);
    setMainImages([]);
    setVariants([]);
  }

 async function handleSubmit() {
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

  const res = await fetch("/api/sell", { method: editProduct ? "PUT" : "POST", body: formData });
  const data = await res.json();
  if (data.success) {
    alert(editProduct ? "Updated!" : "Posted!");
    setShowForm(false);
    setEditProduct(null);
    resetForm();
  }
}

  async function handleDelete(id) {
    if (!confirm("Delete product?")) return;
    await fetch("/api/sell", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
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
  if (!form.category_id) return;
  async function fetchAttrs() {
    const res = await fetch(`/api/attributes?category_id=${form.category_id}`);
    const data = await res.json();
    setAttributeDefs(Array.isArray(data) ? data : []);
    // ✅ FIX 2: only reset attr values when adding new product, not editing
    if (!editProduct) setAttrValues({});
  }
  fetchAttrs();
}, [form.category_id]);

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
      <div className="flex items-center justify-center min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f]">
        <p className="text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">Loading...</p>
      </div>
    );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] transition-colors duration-300">

      {/* HERO */}
      <section className="bg-[#beafdd] dark:bg-[#12121a] text-white text-center px-5 py-12">
        <h1 className="text-3xl font-bold">Sell Your Items</h1>
        <p className="text-white/60 mt-1.5 text-sm">What are you selling today? Add and manage your products here.</p>
      </section>

      <div className="max-w-[960px] mx-auto px-5 py-6">

        {/* SELLER CARD */}
        <div className="bg-white dark:bg-[#12121a] border border-[#e8e5f0] dark:border-white/[0.07] rounded-2xl p-4 flex items-center mb-6 shadow-sm">
          <div className="w-11 h-11 rounded-full bg-[#6d4aff] dark:bg-[#c9a96e] flex items-center justify-center text-white dark:text-[#0a0a0f] font-bold text-sm shrink-0">
            {session?.user?.name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div className="ml-3">
            <h2 className="font-semibold text-sm text-[#1a1060] dark:text-[#f0ede8]">{session?.user?.name}</h2>
            <p className="text-xs text-[#1a1060]/45 dark:text-[#f0ede8]/40">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => { setEditProduct(null); resetForm(); setShowForm(true); }}
            className="ml-auto text-xs font-semibold px-4 py-2 rounded-xl bg-[#1a1060] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] hover:opacity-90 transition"
          >
            + Add Product
          </button>
        </div>

        {/* FORM */}
        {showForm && (
          <div className="bg-white dark:bg-[#12121a] border border-[#e8e5f0] dark:border-white/[0.07] rounded-2xl p-6 mb-6 shadow-sm">
            <h3 className="font-semibold text-sm mb-4 text-[#1a1060] dark:text-[#f0ede8]">
              {editProduct ? "Edit Product" : "Add Product"}
            </h3>
            <div className="grid gap-3">

              <input
                className="w-full px-3 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
                placeholder="Name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors resize-none"
                placeholder="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <input
                className="w-full px-3 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
                type="number" placeholder="Price" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />

              <select
                className="w-full px-3 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {attributeDefs.length > 0 && (
                <div className="grid gap-3">
                  {attributeDefs.map((def) => (
                    <div key={def.id}>
                      <label className="text-xs text-[#1a1060]/50 dark:text-[#f0ede8]/40 mb-1 block">{def.name}</label>
                      <input
                        className="w-full px-3 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
                        placeholder={def.name}
                        value={attrValues[def.id] || ""}
                        onChange={(e) => setAttrValues({ ...attrValues, [def.id]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}

              <input
                className="w-full px-3 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 bg-[#f5f3ff] dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
                type="number" min="0" placeholder="Stock quantity" value={form.stock}
                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
              />

              {/* PRODUCT PHOTOS */}
              <div>
                <p className="text-xs font-semibold text-[#1a1060]/70 dark:text-[#f0ede8]/50 mb-2">Product Photos</p>
                <div className="flex flex-wrap gap-2.5 items-center">
                  {mainImages.map((img, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={img.preview} className="w-full h-full object-cover rounded-xl border border-[#e8e5f0] dark:border-white/10" />
                      <button
                        onClick={() => removeMainImage(i)}
                        className="absolute -top-1.5 -right-1.5 bg-[#e94560] text-white border-none rounded-full w-[18px] h-[18px] text-[10px] font-bold cursor-pointer flex items-center justify-center"
                      >✕</button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-[#d1d5db] dark:border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer text-[#9ca3af] dark:text-[#f0ede8]/30 text-[11px] gap-0.5 hover:border-[#6d4aff] dark:hover:border-[#c9a96e] transition-colors">
                    <span className="text-xl">+</span>
                    Add photo
                    <input type="file" accept="image/*" multiple onChange={handleMainImages} className="hidden" />
                  </label>
                </div>
              </div>

              {/* VARIANTS */}
              <div>
                <p className="text-xs font-semibold text-[#1a1060]/70 dark:text-[#f0ede8]/50 mb-2">
                  Variants <span className="font-normal text-[#1a1060]/35 dark:text-[#f0ede8]/30">(color, size, etc.)</span>
                </p>
                <div className="flex flex-col gap-2">
                  {variants.map((variant, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-[#f9fafb] dark:bg-white/[0.04] rounded-xl px-3 py-2 border border-[#f3f4f6] dark:border-white/[0.06]">
                      <label className="cursor-pointer shrink-0">
                        {variant.preview ? (
                          <img src={variant.preview} className="w-[52px] h-[52px] object-cover rounded-lg border border-[#e5e7eb] dark:border-white/10" />
                        ) : (
                          <div className="w-[52px] h-[52px] border-2 border-dashed border-[#d1d5db] dark:border-white/20 rounded-lg flex items-center justify-center text-[#9ca3af] dark:text-[#f0ede8]/30 text-lg">+</div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => updateVariantImage(i, e.target.files[0])} className="hidden" />
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Red - Large"
                        value={variant.label}
                        onChange={(e) => updateVariantLabel(i, e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/[0.04] text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/30 text-sm outline-none focus:border-[#6d4aff] dark:focus:border-[#c9a96e] transition-colors"
                      />
                      <button onClick={() => removeVariant(i)} className="bg-transparent border-none text-[#e94560] cursor-pointer text-lg leading-none">✕</button>
                    </div>
                  ))}
                  <button
                    onClick={addVariant}
                    className="flex items-center gap-1.5 bg-transparent border border-dashed border-[#d1d5db] dark:border-white/20 rounded-xl px-3.5 py-2 text-[#6b7280] dark:text-[#f0ede8]/40 text-xs cursor-pointer w-fit hover:border-[#6d4aff] dark:hover:border-[#c9a96e] hover:text-[#6d4aff] dark:hover:text-[#c9a96e] transition-colors"
                  >
                    + Add variant
                  </button>
                </div>
              </div>

              {/* VISIBILITY TOGGLE */}
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#1a1060]/70 dark:text-[#f0ede8]/55">
                <div
                  onClick={() => setForm({ ...form, is_visible: form.is_visible ? 0 : 1 })}
                  className={`relative w-[42px] h-6 rounded-full transition-colors duration-200 cursor-pointer
                    ${form.is_visible ? "bg-[#6d4aff] dark:bg-[#c9a96e]" : "bg-[#d1d5db] dark:bg-white/20"}`}
                >
                  <div className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-200
                    ${form.is_visible ? "left-[21px]" : "left-[3px]"}`}
                  />
                </div>
                {form.is_visible ? "Visible to buyers" : "Hidden from buyers"}
              </label>

              <div className="flex gap-2">
                <button onClick={handleSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a1060] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] text-sm font-semibold hover:opacity-90 transition border-none cursor-pointer">
                  {editProduct ? "Save" : "Post"}
                </button>
                <button onClick={() => { setShowForm(false); setEditProduct(null); resetForm(); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#e8e5f0] dark:border-white/10 text-sm text-[#1a1060]/60 dark:text-[#f0ede8]/50 hover:bg-[#f5f3ff] dark:hover:bg-white/[0.04] transition bg-transparent cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MY PRODUCTS */}
        <h3 className="font-semibold text-sm mb-4 text-[#1a1060] dark:text-[#f0ede8]">My Products</h3>
        {products.length === 0 ? (
          <div className="bg-white dark:bg-[#12121a] border border-[#e8e5f0] dark:border-white/[0.07] rounded-2xl text-center text-[#1a1060]/35 dark:text-[#f0ede8]/30 py-10 text-sm">
            No products yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => handleEdit(product)}
                className={`bg-white dark:bg-[#12121a] border border-[#e8e5f0] dark:border-white/[0.07] rounded-2xl p-4 cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(109,74,255,0.1)] dark:hover:shadow-[0_8px_24px_rgba(201,169,110,0.08)] transition-all duration-200
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
                  <h4 className="font-semibold text-sm text-[#1a1060] dark:text-[#f0ede8]">{product.name}</h4>
                  <p className="text-sm font-bold text-[#6d4aff] dark:text-[#c9a96e]">₱{Number(product.price).toLocaleString()}</p>
                  <p className={`text-xs mt-0.5 font-medium ${product.stock === 0 ? "text-[#e94560]" : "text-[#16a34a]"}`}>
                    {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
                  </p>
                  {product.variants?.length > 0 && (
                    <p className="text-[11px] text-[#1a1060]/35 dark:text-[#f0ede8]/30 mt-0.5">
                      {product.variants.length} variant{product.variants.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                    className="flex-1 py-2 rounded-xl bg-[#1a1060] dark:bg-[#c9a96e] text-white dark:text-[#0a0a0f] text-xs font-semibold hover:opacity-90 transition border-none cursor-pointer"
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
    </main>
  );
}