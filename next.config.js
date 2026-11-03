/** @type {import('next').NextConfig} */
const path = require('path');
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  ...(isProd ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  transpilePackages: ['react-native-web'],
  experimental: {
    // Tree-shake lucide-react's barrel file per icon instead of bundling it all.
    optimizePackageImports: ['lucide-react'],
  },
  compiler: {
    // Strip debug logs from production bundles (keep warnings/errors).
    removeConsole:
      isProd ? { exclude: ['error', 'warn'] } : false,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': 'react-native-web',
    };
    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...config.resolve.extensions,
    ];
    return config;
  },
};

module.exports = nextConfig;
