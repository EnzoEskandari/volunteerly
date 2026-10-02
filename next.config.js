/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    typedRoutes: false,
  },
  // The Blockcraft game is a static app in public/craft; serve it at /craft.
  async redirects() {
    return [{ source: "/craft", destination: "/craft/index.html", permanent: false }];
  },
};

module.exports = nextConfig;
