/**
 * Vite Plugin: Environment Setup
 *
 * This plugin handles environment-specific configuration by:
 * - Copying the appropriate environment file to environment.ts
 * - Cleaning up temporary files after builds
 * - Managing environment switching during development
 */

import fs from 'fs';
import { resolve } from 'path';

export function environmentSetupPlugin(mode) {
  // Extract chain name from mode (e.g. 'sepolia' from 'dev-sepolia')
  const chainName = mode.split("-")[1] || mode;

  // Environment file handling
  const targetEnvFile = `environment.${mode}.ts`;
  const sourceEnvPath = resolve(process.cwd(), `src/environments/${targetEnvFile}`);
  const destEnvPath = resolve(process.cwd(), `src/environments/environment.ts`);

  console.log(`🌍 Environment: ${targetEnvFile} → environment.ts`);
  console.log(`📁 Source: ${sourceEnvPath}`);
  console.log(`📁 Destination: ${destEnvPath}`);

  // Verify environment file exists
  if (!fs.existsSync(sourceEnvPath)) {
    console.error(`❌ Environment file not found: ${sourceEnvPath}`);
    process.exit(1);
  }

  return {
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
  };
}
