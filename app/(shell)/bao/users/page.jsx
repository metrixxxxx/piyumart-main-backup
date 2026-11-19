"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function BaoUsersPage() {
  const [users, setUsers] = useState([]);
  const [userToDelete, setUserToDelete] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/bao/users", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load users.");
        if (active) {
          setUsers(data);
          setError("");
        }
      })
      .catch((requestError) => {
        console.error("BAO user list request failed:", requestError);
        if (active) setError(requestError.message || "Unable to load users.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function deleteUser() {
    if (!userToDelete || deleting) return;
    setDeleting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/bao/users/${userToDelete.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || data.success !== true) {
        throw new Error(data.error || "Unable to delete the user.");
      }

      setUsers((current) => current.filter((user) => String(user.id) !== String(userToDelete.id)));
      setNotice(`${userToDelete.name || "User"} was deleted.`);
      setUserToDelete(null);
    } catch (requestError) {
      console.error("BAO user deletion failed:", requestError);
      setError(requestError.message || "Unable to delete the user.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-3rem)] p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#1a2a6c]">Users</h2>
        <p className="mt-1 text-sm text-slate-600">Review marketplace accounts and remove eligible users.</p>
      </div>
      {error ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Role</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-4 text-slate-600">Loading users...</td></tr>
            ) : users.length ? (
              users.map((user) => (
                <tr key={user.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#1a2a6c]/10 px-2 py-1 text-xs font-semibold capitalize text-[#1a2a6c]">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setUserToDelete(user)}
                      disabled={deleting}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-4 text-slate-600">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(userToDelete)}
        title="Delete this user?"
        description="This removes the user and related records that are eligible for cleanup. This action cannot be undone."
        confirmText="Delete user"
        onCancel={() => setUserToDelete(null)}
        onConfirm={deleteUser}
        loading={deleting}
      />
    </main>
  );
}
