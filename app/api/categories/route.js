import { cachedCategories } from "@/lib/catalog-cache";
export async function GET(){try{return Response.json(await cachedCategories(),{headers:{"Cache-Control":"public, max-age=60, s-maxage=300"}});}catch(error){console.error("Categories failed:",error);return Response.json({error:"Unable to load categories."},{status:503,headers:{"Cache-Control":"no-store"}});}}
