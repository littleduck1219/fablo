import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack FileSystem 캐시가 dev에서 디스크 쓰기 폭주 + 메모리 고갈로
    // 시스템 프리즈를 유발해 비활성화 (2026-07-10 진단)
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
