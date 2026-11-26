import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

const rootDir = import.meta.dirname;

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom'],
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'firebase-firestore',
                test: /[\\/]node_modules[\\/](?:@firebase[\\/]firestore|firebase[\\/]firestore)[\\/]/,
                priority: 35,
              },
              {
                name: 'firebase-auth-core',
                test: /[\\/]node_modules[\\/](?:firebase|@firebase)[\\/]/,
                priority: 30,
              },
              {
                name: 'charts-vendor',
                test: /[\\/]node_modules[\\/](?:recharts|d3-[^\\/]+|victory-vendor)[\\/]/,
                priority: 28,
              },
              {
                name: 'react-vendor',
                test: /[\\/]node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 25,
              },
              {
                name: 'motion-vendor',
                test: /[\\/]node_modules[\\/](?:motion|framer-motion)[\\/]/,
                priority: 20,
              },
              {
                name: 'icons-vendor',
                test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
                priority: 15,
              },
            ],
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'lucide-react',
        'motion/react',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/analytics',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
