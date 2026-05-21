"use client";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

// ── Password validation ────────────────────────────────────────────────────
const PW_RULES = [
  { id: "len", label: "At least 8 characters",        test: (v) => v.length >= 8 },
  { id: "num", label: "At least 1 number",             test: (v) => /[0-9]/.test(v) },
  { id: "spc", label: "At least 1 special character",  test: (v) => /[^a-zA-Z0-9]/.test(v) },
];
function pwScore(v) { return PW_RULES.filter((r) => r.test(v)).length; }

// ── Eye-toggle password input ──────────────────────────────────────────────
function PwInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-10 w-full rounded-lg border border-[#2e3460] bg-[#252a4a] pl-3 pr-10 text-sm text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7] focus:ring-2 focus:ring-[#4f8ef7]/20"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5080] hover:text-[#e0e4ff] transition"
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.39 1 12a10.94 10.94 0 012.06-3.94M6.53 6.53A10.94 10.94 0 0112 4c5 0 9.27 3.61 11 8a10.94 10.94 0 01-4.12 5.37"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M1 12C2.73 7.61 7 4 12 4s9.27 3.61 11 8c-1.73 4.39-6 8-11 8S2.73 16.39 1 12z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Strength meter ─────────────────────────────────────────────────────────
function StrengthMeter({ value }) {
  if (!value) return null;
  const score = pwScore(value);
  const barColor = ["", "#e24b4a", "#ef9f27", "#4f8ef7"][score];
  const label    = ["", "Weak", "Almost there", "Strong ✓"][score];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? barColor : "#2e3460" }} />
        ))}
      </div>
      <ul className="space-y-0.5">
        {PW_RULES.map((r) => {
          const met = r.test(value);
          return (
            <li key={r.id} className="flex items-center gap-1.5 text-[11px] transition-colors"
              style={{ color: met ? "#4f8ef7" : "#4a5080" }}>
              <span>{met ? "✓" : "○"}</span>{r.label}
            </li>
          );
        })}
      </ul>
      {value.length > 0 && (
        <p className="text-right text-[10px] font-medium" style={{ color: barColor }}>{label}</p>
      )}
    </div>
  );
}

// ── Nav tabs (Shopee-style sidebar) ───────────────────────────────────────
const TABS = [
  {
    id: "profile",
    label: "My Profile",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    id: "password",
    label: "Change Password",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
    ),
  },
];

// ── Field ──────────────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, editing, required, note }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
        {label}
      </label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="h-10 w-full rounded-lg border border-[#2e3460] bg-[#252a4a] px-3 text-sm text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7] focus:ring-2 focus:ring-[#4f8ef7]/20"
        />
      ) : (
        <div className="flex h-10 items-center rounded-lg border border-[#2e3460] bg-[#1a1d35] px-3 text-sm text-[#e0e4ff]">
          {value || <span className="italic text-[#4a5080]">Not set</span>}
        </div>
      )}
      {note && <p className="text-[10px] text-[#4a5080]">{note}</p>}
    </div>
  );
}

// ── Alert ──────────────────────────────────────────────────────────────────
function Alert({ type, message, onClose }) {
  const s = type === "success"
    ? { bg: "bg-[#4f8ef7]/10 border-[#4f8ef7]/30", text: "text-[#4f8ef7]", icon: "M5 13l4 4L19 7" }
    : { bg: "bg-red-500/10 border-red-500/30",     text: "text-red-400",   icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" };
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${s.bg}`}>
      <svg className={`w-4 h-4 shrink-0 ${s.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d={s.icon}/>
      </svg>
      <p className={`text-sm font-medium flex-1 ${s.text}`}>{message}</p>
      {onClose && (
        <button onClick={onClose} className={`text-xs ${s.text} opacity-60 hover:opacity-100`}>✕</button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const fileRef = useRef(null);

  const [tab, setTab]           = useState("profile"); // "profile" | "password"
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview]     = useState(null);
  const [savedPreview, setSavedPreview] = useState(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    contactNumber: "", address: "",
    currentPassword: "", newPassword: "",
  });
  const [savedForm, setSavedForm] = useState(null);

  useEffect(() => {
    if (!session?.user) return;
    const firstName = session.user.name || "";
    const lastName  = session.user.lastName || "";
    const initial = {
      firstName, lastName,
      email: session.user.email || "",
      contactNumber: session.user.contactNumber || "",
      address: session.user.address || "",
      currentPassword: "", newPassword: "",
    };
    const t = setTimeout(() => {
      setForm(initial); setSavedForm(initial);
      setPreview(session.user.image || null);
      setSavedPreview(session.user.image || null);
    }, 0);
    return () => clearTimeout(t);
  }, [session]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleTabChange = (id) => {
    if (editing) handleCancel();
    setTab(id);
    setError(""); setSuccess("");
    if (id === "profile") setEditing(false);
    if (id === "password") setEditing(true);
  };

  const handleEditClick = () => {
    setSavedForm({ ...form }); setSavedPreview(preview);
    setError(""); setSuccess(""); setEditing(true);
  };

  const handleCancel = () => {
    setForm({ ...savedForm }); setPreview(savedPreview);
    setImageFile(null); setError(""); setSuccess("");
    setEditing(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  // ── Validate on client before submit ──
  const validatePw = (pw) => {
    if (!pw) return null;
    if (pw.length < 8)           return "Password must be at least 8 characters.";
    if (!/[0-9]/.test(pw))       return "Password must include at least one number.";
    if (!/[^a-zA-Z0-9]/.test(pw)) return "Password must include at least one special character.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (tab === "password") {
      if (!form.currentPassword) return setError("Enter your current password.");
      if (!form.newPassword)     return setError("Enter a new password.");
      const pwErr = validatePw(form.newPassword);
      if (pwErr) return setError(pwErr);
      if (form.currentPassword === form.newPassword)
        return setError("New password must differ from current password.");
    }

    setSaving(true);
    const fd = new FormData();
    fd.append("firstName",       form.firstName);
    fd.append("lastName",        form.lastName);
    fd.append("contactNumber",   form.contactNumber);
    fd.append("address",         form.address);
    if (form.currentPassword) fd.append("currentPassword", form.currentPassword);
    if (form.newPassword)     fd.append("newPassword",     form.newPassword);
    if (imageFile)            fd.append("image",           imageFile);

    const res  = await fetch("/api/profile/update", { method: "POST", body: fd });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.message);
    } else {
      setSuccess(tab === "password" ? "Password changed successfully!" : "Profile updated successfully!");
      setSavedForm({ ...form, currentPassword: "", newPassword: "" });
      setForm((f) => ({ ...f, currentPassword: "", newPassword: "" }));
      setSavedPreview(preview);
      if (tab === "profile") setEditing(false);
      try { await update(); } catch (err) { console.warn("[profile] session refresh failed", err); }
    }
  };

  const initials = `${form.firstName?.charAt(0) || ""}${form.lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  const pwOk     = pwScore(form.newPassword) === 3;
  const canSavePw = form.currentPassword && pwOk && form.newPassword !== form.currentPassword;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1123]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#252a4a] border-t-[#4f8ef7]" />
          <p className="text-sm text-[#4a5080]">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1123] pb-16 pt-8">
      <div className="mx-auto max-w-5xl px-4">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-widest text-white">
            PIYU<span className="text-[#4f8ef7]">MART</span>
          </h1>
          <p className="mt-0.5 text-xs text-[#4a5080]">Account settings</p>
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-start">

          {/* ── Sidebar ──────────────────────────────────────────────── */}
          <aside className="w-full shrink-0 md:w-56">
            <div className="rounded-2xl bg-[#1a1d35] overflow-hidden border border-[#2e3460]">

              {/* User card */}
              <div className="flex items-center gap-3 border-b border-[#2e3460] px-4 py-4">
                <div
                  className="relative cursor-pointer shrink-0"
                  onClick={() => { if (tab === "profile" && editing) fileRef.current.click(); }}
                >
                  {preview ? (
                    <img src={preview} alt="avatar"
                      className="h-11 w-11 rounded-full border-2 border-[#4f8ef7]/40 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#4f8ef7]/40 bg-[#252a4a]">
                      <span className="text-base font-bold text-[#4f8ef7]">{initials}</span>
                    </div>
                  )}
                  {tab === "profile" && editing && (
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#4f8ef7] shadow">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#e0e4ff]">
                    {form.firstName} {form.lastName}
                  </p>
                  <p className="truncate text-[10px] text-[#4a5080]">{form.email}</p>
                </div>
              </div>

              {/* Nav items */}
              <nav className="p-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTabChange(t.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      tab === t.id
                        ? "bg-[#4f8ef7]/10 text-[#4f8ef7] border border-[#4f8ef7]/20"
                        : "text-[#4a5080] hover:bg-[#252a4a] hover:text-[#e0e4ff]"
                    }`}
                  >
                    <span className={tab === t.id ? "text-[#4f8ef7]" : ""}>{t.icon}</span>
                    {t.label}
                    {tab === t.id && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#4f8ef7]" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Main content ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <form onSubmit={handleSubmit}>

              {/* ── Profile tab ── */}
              {tab === "profile" && (
                <div className="rounded-2xl bg-[#1a1d35] border border-[#2e3460] overflow-hidden">

                  {/* Header row */}
                  <div className="flex items-center justify-between border-b border-[#2e3460] px-6 py-4">
                    <div>
                      <h2 className="text-sm font-bold text-[#e0e4ff]">My Profile</h2>
                      <p className="text-[11px] text-[#4a5080]">
                        {editing ? "Make changes and save" : "Manage your personal information"}
                      </p>
                    </div>
                    {!editing ? (
                      <button
                        type="button"
                        onClick={handleEditClick}
                        className="flex items-center gap-1.5 rounded-lg border border-[#4f8ef7]/30 bg-[#4f8ef7]/10 px-3 py-1.5 text-xs font-semibold text-[#4f8ef7] transition hover:bg-[#4f8ef7]/20 active:scale-95"
                      >
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                      </button>
                    ) : (
                      <button type="button" onClick={handleCancel}
                        className="text-xs text-[#4a5080] hover:text-[#e0e4ff] transition">
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Body — Shopee two-column layout */}
                  <div className="flex flex-col gap-0 md:flex-row">

                    {/* Avatar column */}
                    <div className="flex flex-col items-center gap-3 border-b border-[#2e3460] px-6 py-8 md:w-48 md:border-b-0 md:border-r md:shrink-0">
                      <div
                        className={`relative ${editing ? "cursor-pointer group" : ""}`}
                        onClick={() => editing && fileRef.current.click()}
                      >
                        {preview ? (
                          <img src={preview} alt="avatar"
                            className="h-24 w-24 rounded-full border-4 border-[#2e3460] object-cover shadow-lg" />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#2e3460] bg-[#252a4a] shadow-lg">
                            <span className="text-3xl font-bold text-[#4f8ef7]">{initials}</span>
                          </div>
                        )}
                        {editing && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                            <span className="mt-1 text-[10px] text-white/80">Change</span>
                          </div>
                        )}
                      </div>
                      {editing && (
                        <>
                          <button type="button" onClick={() => fileRef.current.click()}
                            className="rounded-lg border border-[#2e3460] bg-[#252a4a] px-3 py-1.5 text-[11px] font-medium text-[#4a5080] hover:border-[#4f8ef7] hover:text-[#4f8ef7] transition">
                            Select Photo
                          </button>
                          <p className="text-center text-[10px] leading-snug text-[#4a5080]">
                            JPG, PNG, WebP<br />Max 5 MB
                          </p>
                        </>
                      )}
                      <span className="rounded-full border border-[#4f8ef7]/20 bg-[#4f8ef7]/10 px-3 py-0.5 text-[11px] font-semibold text-[#4f8ef7]">
                        Member
                      </span>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </div>

                    {/* Fields column */}
                    <div className="flex flex-1 flex-col gap-5 px-6 py-6">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="First Name" value={form.firstName} onChange={set("firstName")}
                          placeholder="First name" editing={editing} required />
                        <Field label="Last Name"  value={form.lastName}  onChange={set("lastName")}
                          placeholder="Last name"  editing={editing} required />
                      </div>

                      {/* Email — read-only */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
                          Email Address
                        </label>
                        <div className="flex h-10 items-center rounded-lg border border-[#2e3460] bg-[#13162b] px-3">
                          <span className="text-sm text-[#4a5080]">{form.email}</span>
                          <span className="ml-auto rounded-full bg-[#252a4a] px-2 py-0.5 text-[10px] font-medium text-[#4a5080]">
                            Cannot change
                          </span>
                        </div>
                      </div>

                      <Field label="Contact Number" type="tel" value={form.contactNumber}
                        onChange={set("contactNumber")} placeholder="09XX XXX XXXX" editing={editing} />

                      {/* Address */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
                          Address
                        </label>
                        {editing ? (
                          <textarea
                            value={form.address}
                            onChange={set("address")}
                            placeholder="Your full address"
                            rows={3}
                            className="w-full resize-none rounded-lg border border-[#2e3460] bg-[#252a4a] px-3 py-2.5 text-sm text-[#e0e4ff] placeholder-[#4a5080] outline-none transition focus:border-[#4f8ef7] focus:ring-2 focus:ring-[#4f8ef7]/20"
                          />
                        ) : (
                          <div className="min-h-[5rem] rounded-lg border border-[#2e3460] bg-[#1a1d35] px-3 py-2.5 text-sm text-[#e0e4ff]">
                            {form.address || <span className="italic text-[#4a5080]">Not set</span>}
                          </div>
                        )}
                      </div>

                      {/* Alerts */}
                      {error   && <Alert type="error"   message={error}   onClose={() => setError("")} />}
                      {success && <Alert type="success" message={success} onClose={() => setSuccess("")} />}

                      {/* Save */}
                      {editing && (
                        <div className="flex gap-3">
                          <button type="button" onClick={handleCancel}
                            className="h-10 flex-1 rounded-lg border border-[#2e3460] bg-transparent text-sm font-semibold text-[#4a5080] hover:border-[#4f8ef7] hover:text-[#e0e4ff] transition">
                            Cancel
                          </button>
                          <button type="submit" disabled={saving}
                            className="h-10 flex-1 rounded-lg bg-[#4f8ef7] text-sm font-bold text-white transition hover:bg-[#3a7de8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                            {saving ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Saving…
                              </span>
                            ) : "Save Changes"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Password tab ── */}
              {tab === "password" && (
                <div className="rounded-2xl bg-[#1a1d35] border border-[#2e3460] overflow-hidden">
                  <div className="border-b border-[#2e3460] px-6 py-4">
                    <h2 className="text-sm font-bold text-[#e0e4ff]">Change Password</h2>
                    <p className="text-[11px] text-[#4a5080]">Keep your account secure with a strong password</p>
                  </div>

                  <div className="px-6 py-6">
                    {/* Security tip */}
                    <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#4f8ef7]/20 bg-[#4f8ef7]/5 px-4 py-3">
                      <svg width="15" height="15" className="mt-0.5 shrink-0 text-[#4f8ef7]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <p className="text-[11px] leading-relaxed text-[#4f8ef7]/80">
                        For security, use 8+ characters with at least one number and one special character (e.g. !, @, #).
                      </p>
                    </div>

                    <div className="flex max-w-md flex-col gap-5">
                      {/* Current */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
                          Current Password
                        </label>
                        <PwInput
                          value={form.currentPassword}
                          onChange={set("currentPassword")}
                          placeholder="Enter current password"
                          autoComplete="current-password"
                        />
                      </div>

                      {/* New */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5080]">
                          New Password
                        </label>
                        <PwInput
                          value={form.newPassword}
                          onChange={set("newPassword")}
                          placeholder="Enter new password"
                          autoComplete="new-password"
                        />
                        <StrengthMeter value={form.newPassword} />
                      </div>

                      {/* Same-password warning */}
                      {form.currentPassword && form.newPassword &&
                        form.currentPassword === form.newPassword && (
                        <p className="text-[11px] text-red-400">
                          New password must differ from current password.
                        </p>
                      )}

                      {/* Alerts */}
                      {error   && <Alert type="error"   message={error}   onClose={() => setError("")} />}
                      {success && <Alert type="success" message={success} onClose={() => setSuccess("")} />}

                      {/* Save */}
                      <div className="flex gap-3 pt-1">
                        <button type="button"
                          onClick={() => { setForm((f) => ({ ...f, currentPassword: "", newPassword: "" })); setError(""); setSuccess(""); }}
                          className="h-10 flex-1 rounded-lg border border-[#2e3460] bg-transparent text-sm font-semibold text-[#4a5080] hover:border-[#4f8ef7] hover:text-[#e0e4ff] transition">
                          Clear
                        </button>
                        <button type="submit" disabled={saving || !canSavePw}
                          className="h-10 flex-1 rounded-lg bg-[#4f8ef7] text-sm font-bold text-white transition hover:bg-[#3a7de8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                          {saving ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                              </svg>
                              Saving…
                            </span>
                          ) : "Save Password"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}