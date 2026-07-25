import { create } from 'ipfs-http-client';
import { fileURLToPath } from 'url';

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

import dotenv from 'dotenv';
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const configArg = args.find(arg => arg.startsWith('--configuration='));
const config = configArg ? configArg.split('=')[1] : null;

if (!checkOnly && (!config || !['mainnet', 'sepolia'].includes(config))) {
  logError('Please specify --configuration=mainnet, --configuration=sepolia, or --check');
  process.exit(1);
}

// IPFS configuration
const cloudNode = process.env.IPFS_CLOUD_NODE?.trim();
const cloudToken = process.env.IPFS_CLOUD_TOKEN?.trim();
const retainPrevious = process.env.IPFS_RETAIN_PREVIOUS === 'true';

if (!cloudNode) {
  logError('IPFS_CLOUD_NODE is not set');
  process.exit(1);
}

try {
  new URL(cloudNode);
} catch {
  logError(`IPFS_CLOUD_NODE is not a valid URL: ${cloudNode}`);
  process.exit(1);
}

// Common IPFS options for consistent hashing
const ipfsOptions = {
  cidVersion: 1,
  hashAlg: 'sha2-256',
  wrapWithDirectory: true,
  pin: true
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryOperation(operation, retries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(chalk.yellow(`Attempt ${i + 1} failed, retrying in ${RETRY_DELAY/1000} seconds...`));
      await sleep(RETRY_DELAY);
    }
  }
  throw lastError;
}

function logSection(title) {
  console.log(chalk.blue('\n' + '='.repeat(50)));
  console.log(chalk.blue.bold(` ${title} `));
  console.log(chalk.blue('='.repeat(50) + '\n'));
}

function logSuccess(message) {
  console.log(chalk.green('✓ ' + message));
}

function logError(message) {
  console.log(chalk.red('✗ ' + message));
}

function logInfo(message) {
  console.log(chalk.cyan('ℹ ' + message));
}

function logUrl(url) {
  console.log(chalk.hex('#00BFFF').underline(url));
}

function createCloudClient() {
  const options = {
    url: cloudNode,
    timeout: '5m'
  };

  if (cloudToken) {
    options.headers = {
      Authorization: `Bearer ${cloudToken}`
    };
  }

  return create(options);
}

async function checkConnection(cloudClient) {
  const version = await retryOperation(() => cloudClient.version());
  logSuccess(`Connected to Kubo ${version.version} at ${cloudNode}`);
}

async function listDeploymentPins(cloudClient, pinName) {
  const pins = [];

  for await (const pin of cloudClient.pin.ls({
    type: 'recursive',
    name: pinName
  })) {
    pins.push(pin.cid.toString());
  }

  return pins;
}

async function removePreviousPins(cloudClient, previousPins, rootHash) {
  if (retainPrevious) {
    logInfo('IPFS_RETAIN_PREVIOUS=true; retaining prior deployment pins');
    return;
  }

  for (const previousCid of previousPins) {
    if (previousCid === rootHash) {
      continue;
    }

    await retryOperation(() => cloudClient.pin.rm(previousCid));
    logSuccess(`Unpinned previous deployment: ${previousCid}`);
  }
}

async function deployToIPFS() {
  try {
    const cloudClient = createCloudClient();
    await checkConnection(cloudClient);

    if (checkOnly) {
      return;
    }

    logSection(`Deploying ${config.toUpperCase()} Build`);
    const pinName = `etherphunks-market-${config}`;
    const previousPins = await listDeploymentPins(cloudClient, pinName);

    if (previousPins.length > 0) {
      logInfo(`Found ${previousPins.length} previous ${config} deployment pin(s)`);
    }

    // Generate timestamp for build output directory (format: MMDD)
    const timestamp = new Date().toLocaleDateString("en", {
      month: "2-digit",
      day: "2-digit",
    }).replace("/", "").toLowerCase();

    const buildDir = path.join(__dirname, 'dist', `etherphunks-market-${config}_${timestamp}`);

    if (!fs.existsSync(buildDir)) {
      logError(`Build directory not found: ${buildDir}`);
      process.exit(1);
    }

    logInfo(`Build directory: ${buildDir}`);

    // Read all files in the build directory recursively and sort them
    const files = [];
    function readDir(dir, relativePath = '') {
      const items = fs.readdirSync(dir).sort(); // Sort files for consistent order
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relPath = path.join(relativePath, item);
        if (fs.statSync(fullPath).isDirectory()) {
          readDir(fullPath, relPath);
        } else {
          files.push({
            path: relPath,
            content: fs.createReadStream(fullPath)
          });
        }
      }
    }
    readDir(buildDir);

    let rootHash;
    let rootCid;

    // Upload to remote node
    try {
      logInfo(`Uploading to remote IPFS node...`);
      const remoteAddResult = cloudClient.addAll(files, ipfsOptions);
      for await (const result of remoteAddResult) {
        if (result.path === '') {
          rootHash = result.cid.toString();
          rootCid = result.cid;
          logSuccess(`IPFS Hash: ${rootHash}`);
        }
      }

      if (!rootCid) {
        throw new Error('Kubo did not return a wrapped root CID');
      }

      logSuccess(`Pinned to remote node`);
    } catch (error) {
      logError(`Failed to upload to remote node: ${error.message}`);
      throw error;
    }

    // Assign a stable name so the next deployment can retire only this
    // environment's previous pin without touching unrelated content.
    await cloudClient.pin.add(rootCid, {
      recursive: true,
      name: pinName
    });
    logSuccess(`Named pin: ${pinName}`);

    await removePreviousPins(cloudClient, previousPins, rootHash);

    logSection(`${config.toUpperCase()} Deployment Complete`);
    logSuccess(`IPFS Hash: ${rootHash}`);
    logInfo('You can access your site at:');
    logUrl(`https://${rootHash}.ipfs.dweb.link`);

  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

deployToIPFS();
