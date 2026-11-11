import { redirect } from "next/navigation";
import { getBaoAccess } from "@/lib/bao-access";

export default async function BaoLayout({ children }) {
  const access = await getBaoAccess();

  if (access.session?.user?.role === "admin") {
    redirect("/dashboard");
  }

  if (!access.session) {
    redirect(access.status === 401 ? "/login" : "/");
  }

  return children;
}
