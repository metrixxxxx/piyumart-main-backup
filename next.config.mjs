let supabaseHost;
try { const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.protocol==="https:")supabaseHost=url.hostname; } catch {}
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ffqhspyzvxlrvdeiwtkh.supabase.co",
      },
      ...(supabaseHost&&supabaseHost!=="ffqhspyzvxlrvdeiwtkh.supabase.co"?[{protocol:"https",hostname:supabaseHost}]:[]),
    ],
  },
};

export default nextConfig;
