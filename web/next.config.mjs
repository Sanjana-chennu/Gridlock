/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile maplibre-gl for proper ESM support
  transpilePackages: ["maplibre-gl", "react-map-gl"],
};

export default nextConfig;
