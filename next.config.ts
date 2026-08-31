import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // 러비 에셋은 public/ 로컬 PNG만 사용하므로 최적화 도메인 설정이 필요하지 않다.
    unoptimized: false,
  },
};

export default nextConfig;
