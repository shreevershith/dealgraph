/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Handle pdfjs-dist canvas dependency (not needed in browser)
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
