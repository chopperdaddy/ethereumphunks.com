/**
 * Vite Configuration File
 * This file configures the build and development settings for the EtherPhunks Marketplace application.
 */

import { defineConfig, loadEnv } from "vite";
import { join, resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer"; // For bundle size analysis

import angular from "@analogjs/vite-plugin-angular"; // Angular integration for Vite
import checker from "vite-plugin-checker"; // For TypeScript type checking
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

  console.log(`🔧 Build Mode: ${mode}`);

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
    },

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
        output: {
          manualChunks: {
            // Vendor chunk configuration for better caching
            vendor: ["@web3modal/wagmi", "@xmtp/proto", "@ng-select/ng-select"],
          },
        },
      },
      modulePreload: true, // Enable module preloading
      cssCodeSplit: !isDevMode, // Disable CSS code splitting in dev mode to prevent missing styles on navigation
      chunkSizeWarningLimit: 500, // Warning threshold for chunk size
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
      {
        name: "environment-setup",
        buildStart() {
          // Ensure environment file exists at build start
          if (!fs.existsSync(destEnvPath)) {
            fs.copyFileSync(sourceEnvPath, destEnvPath);
            console.log(`✅ Created environment.ts from ${targetEnvFile} (build start)`);
          }
        },
        configureServer(server) {
          // Clean up environment file when dev server closes
          server.httpServer?.on('close', () => {
            if (fs.existsSync(destEnvPath)) {
              try {
                fs.unlinkSync(destEnvPath);
                console.log(`🧹 Cleaned up environment.ts`);
              } catch (error) {
                console.warn(`⚠️  Could not clean up environment.ts: ${error.message}`);
              }
            }
          });
        },
        buildEnd() {
          // Clean up environment file after build
          if (fs.existsSync(destEnvPath)) {
            try {
              fs.unlinkSync(destEnvPath);
              console.log(`🧹 Cleaned up environment.ts`);
            } catch (error) {
              console.warn(`⚠️  Could not clean up environment.ts: ${error.message}`);
            }
          }
        },
        closeBundle() {
          // Final cleanup of environment file
          if (fs.existsSync(destEnvPath)) {
            try {
              fs.unlinkSync(destEnvPath);
              console.log(`🧹 Cleaned up environment.ts (final)`);
            } catch (error) {
              console.warn(`⚠️  Could not clean up environment.ts: ${error.message}`);
            }
          }
        },
      },

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

      // HTML file renaming plugin
      {
        name: "rename-html-after-build",
        closeBundle() {
          if (command !== "build") return;
          const outDir = currentEnv.outDir;
          const htmlName = `index.${chainName}.html`;
          const src = join(outDir, htmlName);
          const dest = join(outDir, "index.html");

          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
          }
        },
      },
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
        "@web3modal/wagmi",
        "qrcode",
        "zone.js",
        "@ng-select/ng-select",
        "@xmtp/proto",
      ],
      exclude: ["@xmtp/wasm-bindings", "@xmtp/browser-sdk"],
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
