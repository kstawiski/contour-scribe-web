import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React and core libraries
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          // UI component libraries
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Medical imaging libraries
          'medical-vendor': [
            'dicom-parser',
            'nifti-reader-js',
          ],
          // Utility libraries
          'utils-vendor': [
            'jszip',
            'file-saver',
            '@tanstack/react-query',
            'clsx',
            'tailwind-merge',
          ],
        },
      },
    },
    // Increase chunk size warning limit to 600KB (since medical imaging apps are larger)
    chunkSizeWarningLimit: 600,
  },
}));
