import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Dominio tipico delle foto Google
        port: '',
        pathname: '/**',
      },
      // Aggiungi altri domini se necessario
    ],
  },
};

export default nextConfig;
