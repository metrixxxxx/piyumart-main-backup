import { redirect } from "next/navigation";
import { getBaoAccess } from "@/lib/bao-access";
import BaoWorkspace from "@/components/bao/BaoWorkspace";

export default async function BaoLayout({ children }) {
  const access = await getBaoAccess();

  if (!access.session) {
    redirect(access.status === 401 ? "/bao/login" : "/");
  }

  return <BaoWorkspace>{children}</BaoWorkspace>;
}
