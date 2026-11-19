let supabaseHost;
try { const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.protocol==="https:")supabaseHost=url.hostname; } catch {}
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/admin/login", destination: "/bao/login", permanent: false },
      { source: "/dashboard", destination: "/bao/dashboard", permanent: false },
      { source: "/dashboard/finance", destination: "/bao/finance", permanent: false },
      {
        source: "/dashboard/seller-applications",
        destination: "/bao/seller-applications",
        permanent: false,
      },
      { source: "/dashboard/:path*", destination: "/bao/dashboard", permanent: false },
    ];
  },
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
