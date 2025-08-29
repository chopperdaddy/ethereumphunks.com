/**
 * Vite Configuration File
 * This file configures the build and development settings for the EtherPhunks Marketplace application.
 */

import { defineConfig, loadEnv } from "vite";
import { join, resolve } from "path";

import angular from "@analogjs/vite-plugin-angular";
import { visualizer } from "rollup-plugin-visualizer";
import checker from "vite-plugin-checker";

import { environmentSetupPlugin, coinbaseExclusionPlugin, htmlRenamingPlugin } from "./vite-plugins";

import fs from "fs";


/**
 * Main Vite configuration function
 * @param {Object} options Configuration options
 * @param {string} options.command The command being run (e.g. 'serve', 'build')
 * @param {string} options.mode The current mode (e.g. 'development', 'production')
 */
export default defineConfig(({ command, mode }) => {
  // Extract chain name from mode (e.g. 'sepolia' from 'dev-sepolia')
  const chainName = mode.split("-")[1] || mode;

  // Generate timestamp for build output directory (format: MMDD)
  const timestamp = new Date().toLocaleDateString("en", {
    month: "2-digit",
    day: "2-digit",
  }).replace("/", "").toLowerCase();

  // Default development server port
  const serverPort = 4200;

  /**
   * Environment-specific configurations
   * Each environment defines:
   * - envFile: The environment file to use
   * - optimization: Whether to enable build optimizations
   * - sourcemap: Whether to generate sourcemaps
   * - indexHtml: Path to the HTML entry file
   * - outDir: (Production only) Output directory for builds
   */
  const envConfig = {
    "dev-sepolia": {
      envFile: `environment.${mode}.ts`,
      optimization: false,
      sourcemap: true,
      indexHtml: resolve(__dirname, `src/index.${chainName}.html`),
    },
    "dev-mainnet": {
      envFile: `environment.${mode}.ts`,
      optimization: false,
      sourcemap: true,
      indexHtml: resolve(__dirname, `src/index.${chainName}.html`),
    },
    sepolia: {
      outDir: resolve(
        __dirname,
        `dist/etherphunks-market-${mode}_${timestamp}`
      ),
      envFile: `environment.${mode}.ts`,
      optimization: true,
      sourcemap: false,
      indexHtml: resolve(__dirname, `src/index.${chainName}.html`),
    },
    mainnet: {
      outDir: resolve(
        __dirname,
        `dist/etherphunks-market-${mode}_${timestamp}`
      ),
      envFile: `environment.${mode}.ts`,
      optimization: true,
      sourcemap: false,
      indexHtml: resolve(__dirname, `src/index.${chainName}.html`),
    },
  };

  // Get current environment config, fallback to dev-sepolia if not found
  const currentEnv = envConfig[mode] || envConfig["dev-sepolia"];

  // Environment file handling
  const targetEnvFile = currentEnv.envFile || `environment.${mode}.ts`;
  const sourceEnvPath = resolve(__dirname, `src/environments/${targetEnvFile}`);
  const destEnvPath = resolve(__dirname, `src/environments/environment.ts`);

  console.log(`🌍 Environment: ${targetEnvFile} → environment.ts`);

  // Verify environment file exists
  if (!fs.existsSync(sourceEnvPath)) {
    console.error(`❌ Environment file not found: ${sourceEnvPath}`);
    process.exit(1);
  }

  // Create environment.ts for TypeScript checker
  if (fs.existsSync(destEnvPath)) {
    fs.unlinkSync(destEnvPath);
  }
  fs.copyFileSync(sourceEnvPath, destEnvPath);
  console.log(`✅ Created environment.ts from ${targetEnvFile} (initial)`);

  // Development mode flag for performance optimizations
  const isDevMode = mode.startsWith("dev");

  return {
    // Project root directory (source files location)
    root: "src",
    base: "/",
    publicDir: "../public",

    // Module resolution configuration
    resolve: {
      mainFields: ["module", "browser", "main"],
      alias: {
        "@": resolve(__dirname, "src/app"), // Application source
        "@scss": resolve(__dirname, "src/scss"), // Styles
        "@environments": resolve(__dirname, "src/environments"), // Environment configs
        "@ng-select/ng-select": resolve(
          __dirname,
          "node_modules/@ng-select/ng-select"
        ),
        "ngx-slider": resolve(__dirname, "node_modules/@angular-slider/ngx-slider"),
        qrcode: resolve(__dirname, "node_modules/qrcode/lib/browser.js"),
        "tippy.js": resolve(__dirname, "node_modules/tippy.js"),
      },
      // WalletConnect compatibility
      conditions: ["import", "module", "browser", "default"],
    },

    // Define global variables for WalletConnect compatibility
    // define: {
    //   global: "globalThis",
    //   "process.env": {},
    //   "process.env.NODE_ENV": JSON.stringify(mode),
    // },

    // Build configuration
    build: {
      outDir: currentEnv.outDir, // Output directory
      emptyOutDir: true, // Clean output directory before build
      target: "es2020", // Target ECMAScript version
      sourcemap: currentEnv.sourcemap,
      minify: currentEnv.optimization ? "esbuild" : false,
      rollupOptions: {
        input: {
          main: currentEnv.indexHtml || resolve(__dirname, "src/index.html"),
        },
        external: [
          'react',
          'react-dom',
          '@tanstack/react-query',
          'use-sync-external-store',
          '@coinbase/wallet-sdk'
        ],
        output: {
          manualChunks: (id) => {
            // Phosphor icons from wagmi?
            if (id.includes('@phosphor-icons')) {
              return 'phosphor';
            }
          },
        },
      },
      modulePreload: true, // Enable module preloading
      cssCodeSplit: !isDevMode, // Disable CSS code splitting in dev mode to prevent missing styles on navigation
      chunkSizeWarningLimit: 1000, // Warning threshold for chunk size (increased due to better chunking)
      reportCompressedSize: true, // Report gzipped sizes
      assetsInlineLimit: 4096, // Max size for inlined assets
    },

    // Vite plugins configuration
    plugins: [
      // Angular integration plugin
      angular({
        inlineStylesExtension: "scss",
        entryFile: resolve(__dirname, "src/main.ts"),
        tsconfig: resolve(__dirname, "tsconfig.app.json"),
        workspaceRoot: __dirname,
        liveReload: true,
      }),

      // Environment setup plugin
      environmentSetupPlugin(mode),

      // Coinbase exclusion plugin (fuck coinbase)
      coinbaseExclusionPlugin(),

      // HTML file renaming plugin
      htmlRenamingPlugin(command, mode, currentEnv.outDir),

      // TypeScript type checking plugin
      checker({
        typescript: {
          root: __dirname,
          tsconfigPath: resolve(__dirname, "tsconfig.app.json"),
        },
        overlay: {
          initialIsOpen: true,
          position: "tl",
        },
        enableBuild: false,
      }),

      // Bundle visualization plugin
      visualizer({
        filename: "./dist/stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
    ],

    // Development server configuration
    server: {
      port: serverPort,
      host: true,
      allowedHosts: ["localhost", "127.0.0.1", "0.0.0.0"],
      hmr: {
        overlay: true,
        clientPort: serverPort,
      },
      watch: {
        usePolling: false, // Use native file watching
        ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      },
    },

    // Preview server configuration
    preview: {
      port: serverPort,
      host: true,
    },

    // Dependency optimization configuration
    optimizeDeps: {
      include: [
        "@wagmi/core",
        "qrcode",
        "zone.js",
        "@ng-select/ng-select",
        "@xmtp/proto",
      ],
      exclude: [
        "@xmtp/wasm-bindings",
        "@xmtp/browser-sdk",
        "react",
        "react-dom",
        "@tanstack/react-query",
        "use-sync-external-store",
        "@coinbase/wallet-sdk",
      ],
      cacheDir: "node_modules/.vite",
      esbuildOptions: {
        target: "es2020",
        define: {
          global: "globalThis",
        },
        minify: !isDevMode, // Skip minification in dev mode
        treeShaking: !isDevMode, // Skip tree shaking in dev mode
      },
    },
  };
});
