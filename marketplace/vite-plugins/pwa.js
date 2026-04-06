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
      // Force cache clearing when app version changes
      cleanupOutdatedCaches: true,
      // Add version to cache names to force invalidation on version bump
      cacheId: `ethereumphunks-v${appConfig.version}`,
      // Increase file size limit to handle large bundles
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
      // Asset groups equivalent - prefetch app files
      globPatterns: [
        '**/*.{js,css,html}',
        'favicon.ico'
      ],
      // Runtime caching for large JS bundles (cached on-demand)
      runtimeCaching: [
        {
          urlPattern: /\/assets\/(main|index|bindings).*\.(js|wasm)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: `large-bundles-cache-v${appConfig.version}`,
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            },
          },
        },
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
        // Data groups equivalent - API freshness strategy
        {
          urlPattern: /^https?:\/\/.*\/api\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: `api-cache-v${appConfig.version}`,
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60, // 1 hour
            },
          },
        },
        // Catch-all for other requests (mimics ngsw-config "/**")
        {
          urlPattern: /^https?:\/\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: `general-cache-v${appConfig.version}`,
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60, // 1 hour
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
