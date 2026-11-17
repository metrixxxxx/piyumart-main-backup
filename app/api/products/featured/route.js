import { cachedFeatured } from "@/lib/catalog-cache";
export async function GET(){try{return Response.json(await cachedFeatured(),{headers:{"Cache-Control":"no-cache"}});}catch(error){console.error("Featured products failed:",error);return Response.json({error:"Unable to load featured products."},{status:503,headers:{"Cache-Control":"no-store"}});}}
