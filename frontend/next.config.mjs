/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.mresult.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
