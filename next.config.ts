import { app } from "@/app/utils/firebase";
import { getAuth } from "firebase/auth";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'search1.kakaocdn.net',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
export const auth = getAuth(app);
