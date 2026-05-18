"use client";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const fileRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [savedPreview, setSavedPreview] = useState(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    address: "",
    currentPassword: "",
    newPassword: "",
  });
  const [savedForm, setSavedForm] = useState(null);

  // ✅ Fix: sync form from session once it loads
  useEffect(() => {
    if (!session?.user) return;

    const firstName = session.user.name || "";
    const lastName = session.user.lastName || firstName.split(" ").slice(1).join(" ") || "";

    const initial = {
      firstName,
      lastName,
      email: session.user.email || "",
      contactNumber: session.user.contactNumber || "",
      address: session.user.address || "",
      currentPassword: "",
      newPassword: "",
    };

    const timer = setTimeout(() => {
      setForm(initial);
      setSavedForm(initial);
      setPreview(session.user.image || null);
      setSavedPreview(session.user.image || null);
    }, 0);

    return () => clearTimeout(timer);
  }, [session]);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleEditClick = () => {
    setSavedForm({ ...form });
    setSavedPreview(preview);
    setError("");
    setSuccess("");
    setEditing(true);
    setEditingPassword(false);
  };

  const handleChangePasswordClick = () => {
    setSavedForm({ ...form });
    setSavedPreview(preview);
    setError("");
    setSuccess("");
    setEditingPassword(true);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...savedForm });
    setPreview(savedPreview);
    setImageFile(null);
    setError("");
    setSuccess("");
    setEditing(false);
    setEditingPassword(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("firstName", form.firstName);
    formData.append("lastName", form.lastName);
    formData.append("contactNumber", form.contactNumber);
    formData.append("address", form.address);
    if (form.currentPassword) formData.append("currentPassword", form.currentPassword);
    if (form.newPassword) formData.append("newPassword", form.newPassword);
    if (imageFile) formData.append("image", imageFile);

    const res = await fetch("/api/profile/update", { method: "POST", body: formData });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.message);
    } else {
      setSuccess("Profile updated successfully!");
      setSavedForm({ ...form });
      setSavedPreview(preview);
      setEditing(false);
      setEditingPassword(false);
      try {
        await update();
      } catch (err) {
        console.warn("[profile] session refresh failed", err);
      }
    }
  };

  const initials =
    `${form.firstName?.charAt(0) || ""}${form.lastName?.charAt(0) || ""}`.toUpperCase() || "?";

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#050712] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#1a2744] dark:border-white/20 border-t-transparent animate-spin" />
          <p className="text-sm text-[#1a2744]/60 dark:text-[#e8edf8]/60 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#050712]">
      {/* Top bar */}
      <div className="bg-[#1a2744] dark:bg-[#0f1831] px-6 py-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">My Account</h1>
            <p className="text-sm text-white/50">
              {editing ? "Editing your profile" : editingPassword ? "Changing your password" : "Manage your profile and account settings"}
            </p>
          </div>
          {!editing && !editingPassword && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleChangePasswordClick}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1976d2] hover:bg-[#1565c0] active:scale-[0.98] text-white text-sm font-semibold transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3zm-6 6a2 2 0 012-2h8a2 2 0 012 2v3H6v-3z" />
                </svg>
                Change Password
              </button>
              <button
                type="button"
                onClick={handleEditClick}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4caf50] hover:bg-[#43a047] active:scale-[0.98] text-white text-sm font-semibold transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 019 15V13z" />
                </svg>
                Edit Profile
              </button>
            </div>
          )}
          {editing && !editingPassword && (
            <button
              type="button"
              onClick={handleChangePasswordClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1976d2] hover:bg-[#1565c0] active:scale-[0.98] text-white text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3zm-6 6a2 2 0 012-2h8a2 2 0 012 2v3H6v-3z" />
              </svg>
              Change Password
            </button>
          )}
          {editingPassword && !editing && (
            <button
              type="button"
              onClick={handleEditClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4caf50] hover:bg-[#43a047] active:scale-[0.98] text-white text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 019 15V13z" />
              </svg>
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Success banner (after save, view mode) */}
        {success && !editing && !editingPassword && (
          <Alert type="success" message={success} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Profile header card */}
          <div className="bg-white dark:bg-[#0b1220] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
            {/* Banner */}
            <div className="h-24 bg-[#1a2744] dark:bg-[#0f1831]" />

            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-12 mb-4">
                {/* Avatar */}
                <div
                  className={`relative ${editing ? "cursor-pointer" : ""}`}
                  onClick={() => editing && fileRef.current.click()}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="avatar"
                      className="w-24 h-24 rounded-full border-4 border-white object-cover shadow"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-white bg-[#4caf50]/20 flex items-center justify-center shadow">
                      <span className="text-2xl font-bold text-[#4caf50]">{initials}</span>
                    </div>
                  )}
                  {editing && (
                    <div className="absolute bottom-1 right-1 w-7 h-7 bg-[#4caf50] rounded-full flex items-center justify-center shadow">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Badge */}
                <span className="mb-1 px-3 py-1 bg-[#1a2744]/10 dark:bg-white/5 border border-[#1a2744]/20 dark:border-white/10 rounded-full text-xs font-semibold text-[#1a2744] dark:text-[#e8edf8]">
                  Member
                </span>
              </div>

              <h2 className="text-lg font-bold text-[#1a2744] dark:text-[#e8edf8] leading-tight">
                {form.firstName} {form.lastName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-[#cbd5e1]">{form.email}</p>
              {editing && (
                <p className="mt-2 text-xs text-gray-400 dark:text-[#94a3b8]">Click avatar to change photo</p>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          {/* Personal info */}
          <div className="bg-white dark:bg-[#0b1220] rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
            <SectionHeader
              color="green"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              title="Personal Information"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name" type="text" value={form.firstName}
                onChange={set("firstName")} placeholder="First name" editing={editing} required />
              <Field label="Last Name" type="text" value={form.lastName}
                onChange={set("lastName")} placeholder="Last name" editing={editing} required />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="flex items-center h-10 px-3 rounded-xl bg-gray-50 dark:bg-[#06101f] border border-gray-200 dark:border-white/10">
                <span className="text-sm text-gray-500 dark:text-[#cbd5e1]">{form.email}</span>
                <span className="ml-auto text-[11px] font-medium text-gray-400 dark:text-[#94a3b8] bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                  Cannot change
                </span>
              </div>
            </div>

            <div className="mt-4">
              <Field label="Contact Number" type="tel" value={form.contactNumber}
                onChange={set("contactNumber")} placeholder="e.g. 09XX XXX XXXX" editing={editing} required={false} />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#94a3b8] uppercase tracking-wider mb-1.5">
                Address
              </label>
              {editing ? (
                <textarea
                  value={form.address}
                  onChange={set("address")}
                  placeholder="Your address"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#08101f] text-sm text-gray-900 dark:text-[#e8edf8] placeholder:text-gray-400 dark:placeholder:text-[#94a3b8] outline-none focus:ring-2 focus:ring-[#4caf50]/30 focus:border-[#4caf50] transition resize-none"
                />
              ) : (
                <div className="min-h-20 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#06101f] border border-gray-200 dark:border-white/10 text-sm text-gray-700 dark:text-[#cbd5e1]">
                  {form.address || <span className="text-gray-400 dark:text-[#94a3b8] italic">Not set</span>}
                </div>
              )}
            </div>
          </div>

          {/* Password card — edit mode only */}
          {editingPassword && (
            <div className="bg-white dark:bg-[#0b1220] rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
              <SectionHeader
                color="navy"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
                title="Change Password"
                subtitle="Leave blank to keep your current password"
              />
              <div className="flex flex-col gap-4">
                <Field label="Current Password" type="password" value={form.currentPassword}
                  onChange={set("currentPassword")} placeholder="Enter current password" editing={editingPassword} required={false} />
                <Field label="New Password" type="password" value={form.newPassword}
                  onChange={set("newPassword")} placeholder="Enter new password (min. 8 chars)" editing={editingPassword} required={false} />
              </div>
            </div>
          )}

          {/* Alerts */}
          {error && <Alert type="error" message={error} />}
          {success && (editing || editingPassword) && <Alert type="success" message={success} />}

          {/* Action buttons */}
          {(editing || editingPassword) && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#06101f] text-sm font-semibold text-gray-600 dark:text-[#d1d5e0] hover:bg-gray-50 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-11 rounded-xl bg-[#4caf50] hover:bg-[#43a047] active:scale-[0.98] text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </span>
                ) : editingPassword && !editing ? "Save Password" : "Save Changes"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function SectionHeader({ icon, title, subtitle, color = "green" }) {
  const colors = {
    green: "bg-[#4caf50]/10 text-[#4caf50]",
    navy: "bg-[#1a2744]/10 text-[#1a2744]",
  };
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-white/10">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-[#1a2744] dark:text-[#e8edf8]">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 dark:text-[#94a3b8] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, editing, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="h-10 px-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#08101f] text-sm text-gray-900 dark:text-[#e8edf8] placeholder:text-gray-400 dark:placeholder:text-[#94a3b8] outline-none focus:ring-2 focus:ring-[#4caf50]/30 focus:border-[#4caf50] transition"
        />
      ) : (
        <div className="h-10 flex items-center px-3 rounded-xl bg-gray-50 dark:bg-[#06101f] border border-gray-200 dark:border-white/10 text-sm text-gray-700 dark:text-[#cbd5e1]">
          {value || <span className="text-gray-400 italic">Not set</span>}
        </div>
      )}
    </div>
  );
}

function Alert({ type, message }) {
  const styles = {
    success: {
      wrapper: "bg-green-50 border-green-200",
      icon: "text-green-500",
      text: "text-green-700",
      path: "M5 13l4 4L19 7",
    },
    error: {
      wrapper: "bg-red-50 border-red-200",
      icon: "text-red-500",
      text: "text-red-700",
      path: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };
  const s = styles[type];
  return (
    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${s.wrapper}`}>
      <svg className={`w-5 h-5 shrink-0 ${s.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.path} />
      </svg>
      <p className={`text-sm font-medium ${s.text}`}>{message}</p>
    </div>
  );
}