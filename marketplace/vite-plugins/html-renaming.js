/**
 * Vite Plugin: HTML Renaming
 *
 * This plugin renames the HTML output file after build to match the expected
 * filename for the deployment environment.
 */

import fs from 'fs';
import { join } from 'path';

export function htmlRenamingPlugin(command, mode, outDir) {
  // Extract chain name from mode (e.g. 'sepolia' from 'dev-sepolia')
  const chainName = mode.split("-")[1] || mode;

  return {
    name: "html-renaming",

    closeBundle() {
      if (command !== "build") return;

      const htmlName = `index.${chainName}.html`;
      const src = join(outDir, htmlName);
      const dest = join(outDir, "index.html");

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
        console.log(`✅ Renamed ${htmlName} to index.html`);
      }
    },
  };
}
