import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { publicProducts } from "@/lib/catalog";
export async function GET(req) {
  try { const session=await getServerSession(authOptions);const result=await publicProducts(req,session?.user?.id);return Response.json(result.rows,{headers:result.headers}); }
  catch(error){console.error("Products GET failed:",error);return Response.json({error:error.status?error.message:"Unable to load products."},{status:error.status||503,headers:{"Cache-Control":"no-store"}});}
}
