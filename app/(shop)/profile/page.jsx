"use client";
import { useSession } from "next-auth/react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    firstName: session?.user?.name?.split(" ")[0] || "",
    lastName: session?.user?.name?.split(" ")[1] || "",
    email: session?.user?.email || "",
    contactNumber: session?.user?.contactNumber || "",
    address: session?.user?.address || "",
    currentPassword: "",
    newPassword: "",
  });

  const [preview, setPreview] = useState(session?.user?.image || null);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const update2 = (field) => (e) =>
    setForm({ ...form, [field]: e.target.value });

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

    if (form.currentPassword) {
      formData.append("currentPassword", form.currentPassword);
    }

    if (form.newPassword) {
      formData.append("newPassword", form.newPassword);
    }

    if (imageFile) {
      formData.append("image", imageFile);
    }

    const res = await fetch("/api/profile/update", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data.message);
    } else {
      setSuccess("Profile updated successfully!");
      await update();
    }
  };

  const field = (
    label,
    type,
    key,
    placeholder,
    required = true
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1060]/45 dark:text-[#f0ede8]/35">
        {label}
      </label>

      <input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={update2(key)}
        required={required}
        className="h-11 rounded-xl border border-[#e8e5f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] px-4 text-sm text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/20 outline-none transition focus:border-[#6d4aff] dark:focus:border-[#c9a96e]"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f0eeff] dark:bg-[#0a0a0f] px-5 py-10 transition-colors duration-300">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1060] dark:text-[#f0ede8]">
            My Profile
          </h1>

          <p className="mt-2 text-sm text-[#1a1060]/50 dark:text-[#f0ede8]/40">
            Manage your personal information and account settings
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Avatar Card */}
          <div className="rounded-3xl border border-[#e8e5f0] bg-white p-6 shadow-[0_8px_30px_rgba(109,74,255,0.08)] dark:border-white/[0.07] dark:bg-[#12121a]">
            <div className="flex flex-col items-center gap-4">

              <div
                className="group relative cursor-pointer"
                onClick={() => fileRef.current.click()}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="avatar"
                    className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-lg dark:border-[#1a1a24]"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#ede9ff] text-4xl font-bold text-[#6d4aff] dark:bg-[#c9a96e]/10 dark:text-[#c9a96e]">
                    {form.firstName?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#6d4aff] text-white shadow-lg dark:bg-[#c9a96e] dark:text-[#0a0a0f]">
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 019 15V13z"
                    />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-lg font-bold text-[#1a1060] dark:text-[#f0ede8]">
                  {form.firstName} {form.lastName}
                </h2>

                <p className="text-sm text-[#1a1060]/45 dark:text-[#f0ede8]/35">
                  {form.email}
                </p>
              </div>

              <p className="text-xs text-[#1a1060]/40 dark:text-[#f0ede8]/30">
                Click profile picture to change photo
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* Personal Info */}
          <div className="rounded-3xl border border-[#e8e5f0] bg-white p-6 shadow-[0_8px_30px_rgba(109,74,255,0.06)] dark:border-white/[0.07] dark:bg-[#12121a]">
            <div className="mb-5">
              <h2 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8]">
                Personal Information
              </h2>

              <p className="mt-1 text-sm text-[#1a1060]/45 dark:text-[#f0ede8]/35">
                Update your personal details here
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {field("First Name", "text", "firstName", "First name")}
              {field("Last Name", "text", "lastName", "Last name")}
            </div>

            <div className="mt-4">
              {field("Email", "email", "email", "Email", false)}

              <p className="mt-2 text-[11px] text-[#1a1060]/35 dark:text-[#f0ede8]/25">
                Email cannot be changed.
              </p>
            </div>

            <div className="mt-4">
              {field(
                "Contact Number",
                "tel",
                "contactNumber",
                "e.g. 09XX XXX XXXX",
                false
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1060]/45 dark:text-[#f0ede8]/35">
                Address
              </label>

              <textarea
                placeholder="Your address"
                value={form.address}
                onChange={update2("address")}
                rows={3}
                className="resize-none rounded-xl border border-[#e8e5f0] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] px-4 py-3 text-sm text-[#1a1060] dark:text-[#f0ede8] placeholder:text-[#1a1060]/30 dark:placeholder:text-[#f0ede8]/20 outline-none transition focus:border-[#6d4aff] dark:focus:border-[#c9a96e]"
              />
            </div>
          </div>

          {/* Password Card */}
          <div className="rounded-3xl border border-[#e8e5f0] bg-white p-6 shadow-[0_8px_30px_rgba(109,74,255,0.06)] dark:border-white/[0.07] dark:bg-[#12121a]">
            <div className="mb-5">
              <h2 className="text-base font-bold text-[#1a1060] dark:text-[#f0ede8]">
                Change Password
              </h2>

              <p className="mt-1 text-sm text-[#1a1060]/45 dark:text-[#f0ede8]/35">
                Leave blank to keep your current password
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {field(
                "Current Password",
                "password",
                "currentPassword",
                "Current password",
                false
              )}

              {field(
                "New Password",
                "password",
                "newPassword",
                "New password",
                false
              )}
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-500 dark:border-red-500/20 dark:bg-red-500/10">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-600 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="h-11 flex-1 rounded-xl border border-[#e8e5f0] bg-white text-sm font-semibold text-[#1a1060]/60 transition hover:bg-[#f5f3ff] dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-[#f0ede8]/50 dark:hover:bg-white/[0.06]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="h-11 flex-1 rounded-xl bg-[#6d4aff] text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#c9a96e] dark:text-[#0a0a0f]"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}