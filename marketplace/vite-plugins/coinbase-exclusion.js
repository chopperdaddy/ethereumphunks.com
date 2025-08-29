/**
 * Vite Plugin: Coinbase Wallet SDK Exclusion
 *
 * This plugin completely removes the Coinbase Wallet SDK from the build process
 * to prevent telemetry scripts from running and protect user privacy.
 *
 * Features:
 * - Blocks all imports of @coinbase/wallet-sdk
 * - Provides safe stub modules for any references
 * - Transforms code to remove Coinbase dependencies
 * - Logs all exclusion activities for debugging
 */

export function coinbaseExclusionPlugin() {
  return {
    name: 'coinbase-exclusion',

    configResolved(config) {
      console.log('🚫 Coinbase exclusion plugin loaded');
    },

    // Block any imports
    resolveId(source) {
      if (source.includes('@coinbase/wallet-sdk')) {
        console.log('🚫 Blocked import:', source);
        return false;
      }

      // Handle coinbase-stub references
      if (source === 'coinbase-stub' || source === './coinbase-stub') {
        console.log('🚫 Resolving coinbase-stub to empty module');
        return 'coinbase-stub';
      }
    },

    // Replace any loaded content
    load(id) {
      if (id.includes('@coinbase/wallet-sdk')) {
        console.log('🚫 Replaced content for:', id);
        return 'export default {}; export const loadTelemetryScript = () => Promise.resolve(); export const ClientAnalytics = undefined;';
      }

      // Handle coinbase-stub module
      if (id === 'coinbase-stub') {
        console.log('🚫 Loading coinbase-stub empty module');
        return `
          // Empty stub module for Coinbase Wallet SDK
          export default {};
          export const loadTelemetryScript = () => Promise.resolve();
          export const ClientAnalytics = undefined;
          export const CoinbaseWalletSDK = undefined;
          export const createCoinbaseWalletSDK = undefined;
          export const CoinbaseWalletProvider = undefined;
          export const createCoinbaseWalletProvider = undefined;
        `;
      }
    },

    // Transform any code that references it
    transform(code, id) {
      if (code.includes('@coinbase/wallet-sdk')) {
        console.log('🚫 Transformed code in:', id);
        // Replace the import statement with a proper empty module
        return code
          .replace(/from\s+['"]@coinbase\/wallet-sdk['"]/g, "from './coinbase-stub'")
          .replace(/import\s+.*@coinbase\/wallet-sdk.*/g, "// Coinbase SDK import removed")
          .replace(/@coinbase\/wallet-sdk/g, 'coinbase-stub');
      }
    }
  };
}
