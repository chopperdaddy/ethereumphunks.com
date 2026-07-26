import { VitePWA } from 'vite-plugin-pwa';
import { appConfig } from '../src/environments/app.js';

/**
 * PWA Plugin Configuration
 * Configures Progressive Web App functionality using VitePWA plugin
 *
 * @param {boolean} isDevMode - Whether the build is in development mode
 * @returns {Object} VitePWA plugin instance
 */
export function pwaPlugin(isDevMode = false) {
  return VitePWA({
    registerType: 'autoUpdate',
    filename: 'sw.js',
    includeAssets: ['favicon.ico', 'manifest.webmanifest'],
    manifestFilename: 'manifest.webmanifest',
    useCredentials: false, // Avoid credential conflicts with Clear-Site-Data header
    workbox: {
      // IPFS gateways can briefly return the HTML shell for an unavailable
      // asset. Never precache or runtime-cache executable chunks: caching one
      // of those fallback responses poisons future dynamic imports with
      // "Unexpected token '<'".
      cleanupOutdatedCaches: true,
      cacheId: `ethereumphunks-v${appConfig.version}`,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
      globPatterns: [
        '**/*.{css,html}',
        'favicon.ico'
      ],
      runtimeCaching: [
        {
          urlPattern: /\.(?:svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: `assets-cache-v${appConfig.version}`,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: !isDevMode, // Only enable in production-like environments
    },
  });
}
