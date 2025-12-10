#!/usr/bin/env ts-node

/**
 * Backfill Collection Script
 * 
 * This script backfills a collection's data from Ethereum mainnet:
 * 1. Loads collection metadata JSON
 * 2. Populates attributes_new table with SHA → traits mapping
 * 3. Creates/verifies collection exists in database
 * 4. Fetches all transfer history from Ethscriptions API
 * 5. Processes transactions in correct order via indexer's reindex endpoint
 * 
 * Usage:
 *   ts-node scripts/backfill-collection.ts --metadata=./metadata/collection.json
 * 
 * Options:
 *   --slug: Collection slug (optional - defaults to slug from metadata JSON)
 *   --metadata: Path to metadata JSON file (required)
 *   --network: Network to use - "mainnet" or "sepolia" (default: mainnet)
 *   --indexer-url: Indexer URL (default: http://localhost:3069)
 *   --dry-run: Don't actually process transactions, just show what would happen
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables (network-specific env will be loaded in parseArgs)
dotenv.config({ path: '.env.supabase' });

// Helper function to prompt for user input
function promptForInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface Attribute {
  trait_type: string;
  value: string;
}

interface CollectionItem {
  id: string;
  index: number;
  sha: string;
  name: string;
  description: string;
  attributes: Attribute[];
}

interface CollectionMetadata {
  name: string;
  slug: string;
  description: string;
  total_supply: number;
  logo_image?: string;
  banner_image?: string;
  website_url?: string;
  twitter_url?: string;
  discord_url?: string;
  background_color?: string;
  collection_items: CollectionItem[];
}

interface EthscriptionTransfer {
  ethscription_transaction_hash: string;
  transaction_hash: string;
  block_number: number;
  transaction_index: number;
  event_log_index: number | null;
  transfer_index: string;
}

interface TransactionToProcess {
  hash: string;
  block_number: number;
  transaction_index: number;
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    slug: null,  // Will be read from metadata JSON
    indexerUrl: 'http://localhost:3069',
    network: 'mainnet',
    dryRun: false,
  };

  args.forEach(arg => {
    if (arg.startsWith('--slug=')) {
      options.slug = arg.split('=')[1];
    } else if (arg.startsWith('--metadata=')) {
      options.metadata = arg.split('=')[1];
    } else if (arg.startsWith('--indexer-url=')) {
      options.indexerUrl = arg.split('=')[1];
    } else if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.split('=')[1];
    } else if (arg.startsWith('--network=')) {
      const network = arg.split('=')[1].toLowerCase();
      if (network !== 'mainnet' && network !== 'sepolia') {
        console.error('Error: --network must be either "mainnet" or "sepolia"');
        process.exit(1);
      }
      options.network = network;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });

  // metadata is optional - will prompt if not provided

  // Load network-specific environment
  dotenv.config({ path: `.env.${options.network}` });

  // Get API key from env if not provided
  if (!options.apiKey) {
    options.apiKey = process.env.API_PRIVATE_KEY;
    if (!options.apiKey) {
      console.error('Error: API key required. Provide via --api-key or set API_PRIVATE_KEY in .env');
      process.exit(1);
    }
  }

  // Set network-specific values
  options.chainId = options.network === 'mainnet' ? 1 : 11155111;
  options.tableSuffix = options.network === 'sepolia' ? '_sepolia' : '';
  options.apiBaseUrl = options.network === 'mainnet' 
    ? 'https://api.ethscriptions.com/v2'
    : 'https://sepolia-api.ethscriptions.com/v2';

  return options;
}

// Initialize Supabase client
function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set in .env.supabase');
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Load and parse metadata JSON from local file or URL
async function loadMetadata(metadataPath: string): Promise<CollectionMetadata> {
  console.log(`\n📖 Loading metadata from: ${metadataPath}`);
  
  let metadata: CollectionMetadata;
  
  // Check if it's a URL (http:// or https://)
  if (metadataPath.startsWith('http://') || metadataPath.startsWith('https://')) {
    console.log('🌐 Fetching from URL...');
    const response = await fetch(metadataPath);
    
    if (!response.ok) {
      console.error(`Error: Failed to fetch metadata: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
    
    metadata = await response.json() as CollectionMetadata;
  } else {
    // Local file path
    console.log('📁 Loading from local file...');
    const resolvedPath = path.resolve(metadataPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Metadata file not found at ${resolvedPath}`);
      process.exit(1);
    }

    metadata = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }
  
  console.log(`✅ Loaded metadata for "${metadata.name}" (${metadata.collection_items.length} items)`);
  
  return metadata;
}

// Desired attribute order for consistent database structure
const ATTRIBUTE_ORDER = [
  'Type',
  'Featured Artist',
  '1 of 1',
  'Origin',
  'Vest/Armor',
  'Tie',
  'Smoke',
  'Shirt/Jacket',
  'Ninja Outfit',
  'Mouth',
  'Mask',
  'Headphones',
  'Headband',
  'Hat/Helmet',
  'Hair',
  'Glasses',
  'Facial',
  'Chain',
  'Cape',
  'Balloon',
  'Background',
  'Power/Strength',
  'Speed/Agility',
  'Wisdom/Magic'
];

// Populate attributes_new table
async function populateAttributes(supabase: any, slug: string, items: CollectionItem[]) {
  console.log(`\n🎨 Populating attributes for ${items.length} items...`);

  const attributeRecords = items.map(item => {
    // First, collect all attributes into an unordered object
    const unorderedValues = item.attributes?.reduce((acc: any, attr: any) => {
      const { trait_type, value } = attr;
      if (acc[trait_type]) {
        if (Array.isArray(acc[trait_type])) {
          acc[trait_type].push(value);
        } else {
          acc[trait_type] = [acc[trait_type], value];
        }
      } else {
        acc[trait_type] = value;
      }
      return acc;
    }, {});

    // Then, rebuild in the desired order
    const values: any = {};
    ATTRIBUTE_ORDER.forEach(key => {
      if (unorderedValues && unorderedValues[key] !== undefined) {
        values[key] = unorderedValues[key];
      }
    });
    
    // Add any attributes not in the order list (just in case)
    if (unorderedValues) {
      Object.keys(unorderedValues).forEach(key => {
        if (!ATTRIBUTE_ORDER.includes(key)) {
          values[key] = unorderedValues[key];
        }
      });
    }

    return {
      slug,
      sha: item.sha,
      values,
      tokenId: item.index,
    };
  });

  // Upsert to attributes_new table
  const { error: errorNew } = await supabase
    .from('attributes_new')
    .upsert(attributeRecords, {
      onConflict: 'sha'
      // Will overwrite existing records with mainnet data as source of truth
    });

  if (errorNew) {
    console.error('❌ Error populating attributes_new:', errorNew);
    throw errorNew;
  }

  // Also upsert to legacy attributes table (required for FK constraints)
  const { error: errorLegacy } = await supabase
    .from('attributes')
    .upsert(attributeRecords, {
      onConflict: 'sha'
    });

  if (errorLegacy) {
    console.error('❌ Error populating attributes:', errorLegacy);
    throw errorLegacy;
  }

  console.log(`✅ Populated ${attributeRecords.length} attribute records in both tables`);
}

// Create or verify collection exists
async function ensureCollection(supabase: any, metadata: CollectionMetadata, tableSuffix: string) {
  console.log(`\n📦 Checking collection "${metadata.slug}"...`);

  const { data: existing, error: fetchError } = await supabase
    .from(`collections${tableSuffix}`)
    .select('*')
    .eq('slug', metadata.slug)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Error checking collection:', fetchError);
    throw fetchError;
  }

  if (existing) {
    console.log(`✅ Collection "${metadata.slug}" already exists`);
    return;
  }

  console.log(`➕ Creating collection "${metadata.slug}"...`);
  
  const { error: createError } = await supabase
    .from(`collections${tableSuffix}`)
    .insert({
      slug: metadata.slug,
      name: metadata.name,
      singleName: metadata.name,
      description: metadata.description,
      supply: metadata.total_supply,
      active: true,
      website: metadata.website_url,
      twitter: metadata.twitter_url?.replace('https://x.com/', ''),
      discord: metadata.discord_url,
      defaultBackground: metadata.background_color,
    });

  if (createError) {
    console.error('❌ Error creating collection:', createError);
    throw createError;
  }

  console.log(`✅ Created collection "${metadata.slug}"`);
}

// Fetch ethscription data (creation + transfers) from Ethscriptions API
async function fetchEthscriptionData(items: CollectionItem[], apiBaseUrl: string): Promise<{ creations: TransactionToProcess[], transfers: EthscriptionTransfer[] }> {
  console.log(`\n🔍 Fetching ethscription data for ${items.length} items from Ethscriptions API...`);
  
  const allCreations: TransactionToProcess[] = [];
  const allTransfers: EthscriptionTransfer[] = [];
  const baseUrl = apiBaseUrl;
  const concurrencyLimit = 50;
  const maxRetries = 3;
  
  // Helper function to fetch complete ethscription data (creation + transfers) with retry logic
  async function fetchItemData(item: CollectionItem, index: number): Promise<{ creation: TransactionToProcess | null, transfers: EthscriptionTransfer[] }> {
    const ethscriptionHash = item.id;
    
    // Validate that we have an ethscription hash
    if (!ethscriptionHash) {
      console.error(`❌ Item at index ${index} is missing 'id' field:`, JSON.stringify(item).substring(0, 200));
      return { creation: null, transfers: [] };
    }
    
    if (index % 100 === 0) {
      console.log(`  Progress: ${index}/${items.length}`);
    }

    let retries = 0;
    let success = false;
    let creation: TransactionToProcess | null = null;
    let transfers: EthscriptionTransfer[] = [];

    while (retries < maxRetries && !success) {
      try {
        const response = await fetch(`${baseUrl}/ethscriptions/${ethscriptionHash}`);
        
        if (!response.ok) {
          if (retries < maxRetries - 1) {
            console.warn(`⚠️  API error for ${ethscriptionHash}: ${response.status}, retrying... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
            retries++;
            continue;
          } else {
            console.error(`❌ API error for ${ethscriptionHash} after ${maxRetries} retries: ${response.status}`);
            break;
          }
        }

        const data: any = await response.json();
        const ethscription = data.result;
        
        if (ethscription) {
          // Extract creation transaction
          creation = {
            hash: ethscription.transaction_hash,
            block_number: parseInt(ethscription.block_number),
            transaction_index: parseInt(ethscription.transaction_index)
          };
          
          // Extract transfers if present
          if (ethscription.ethscription_transfers && Array.isArray(ethscription.ethscription_transfers)) {
            transfers = ethscription.ethscription_transfers;
          }
        }
        
        success = true;
      } catch (error) {
        if (retries < maxRetries - 1) {
          console.warn(`⚠️  Error fetching data for ${ethscriptionHash}, retrying... (${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
          retries++;
        } else {
          console.error(`❌ Error fetching data for ${ethscriptionHash} after ${maxRetries} retries:`, error);
          break;
        }
      }
    }
    
    return { creation, transfers };
  }
  
  // Process items in batches with concurrency limit
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map((item, batchIndex) => 
      fetchItemData(item, i + batchIndex)
    );
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ creation, transfers }) => {
      if (creation) allCreations.push(creation);
      allTransfers.push(...transfers);
    });
    
    // Rate limiting between batches
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`✅ Fetched ${allCreations.length} creations and ${allTransfers.length} transfers`);
  return { creations: allCreations, transfers: allTransfers };
}

// Combine and sort all transactions
function combineAndSortTransactions(creations: TransactionToProcess[], transfers: EthscriptionTransfer[]): TransactionToProcess[] {
  console.log(`\n🔨 Combining and sorting transactions...`);
  
  const transactionMap = new Map<string, TransactionToProcess>();

  // Add creation transactions
  creations.forEach(creation => {
    transactionMap.set(creation.hash, creation);
  });

  // Add transfer transactions
  transfers.forEach(transfer => {
    if (!transactionMap.has(transfer.transaction_hash)) {
      transactionMap.set(transfer.transaction_hash, {
        hash: transfer.transaction_hash,
        block_number: transfer.block_number,
        transaction_index: transfer.transaction_index,
      });
    }
  });
  
  // Sort by block number and transaction index
  const transactions = Array.from(transactionMap.values())
    .sort((a, b) => {
      if (a.block_number !== b.block_number) {
        return a.block_number - b.block_number;
      }
      return a.transaction_index - b.transaction_index;
    });

  console.log(`✅ Found ${transactions.length} unique transactions (${creations.length} creations + ${transactionMap.size - creations.length} transfers)`);
  return transactions;
}



// Process transactions via indexer endpoint
async function processTransactions(
  transactions: TransactionToProcess[],
  indexerUrl: string,
  apiKey: string,
  dryRun: boolean
) {
  console.log(`\n⚙️  Processing ${transactions.length} transactions...`);
  
  if (dryRun) {
    console.log('🏃 DRY RUN MODE - Not actually processing transactions');
    console.log('\nFirst 5 transactions that would be processed:');
    transactions.slice(0, 5).forEach((tx, i) => {
      console.log(`  ${i + 1}. Block ${tx.block_number}, TX Index ${tx.transaction_index}: ${tx.hash}`);
    });
    return;
  }

  let processed = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      const response = await fetch(`${indexerUrl}/admin/reindex-transaction`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ hash: tx.hash }),
      });

      if (!response.ok) {
        console.error(`❌ Error processing ${tx.hash}: ${response.status}`);
        errors++;
      } else {
        processed++;
        if (processed % 10 === 0) {
          console.log(`  Progress: ${processed}/${transactions.length} (${errors} errors)`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Error processing ${tx.hash}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Processed ${processed}/${transactions.length} transactions (${errors} errors)`);
}

// Update block tracker to latest
async function updateBlockTracker(supabase: any, chainId: number, apiBaseUrl: string) {
  console.log(`\n🔄 Updating block tracker to latest...`);

  try {
    // Fetch latest block from Ethscriptions API
    const response = await fetch(`${apiBaseUrl}/status`);
    const data: any = await response.json();
    const latestBlock = data.current_block_number;

    if (!latestBlock) {
      console.error('❌ Could not fetch latest block number');
      return;
    }

    // Update blocks table
    const { error } = await supabase
      .from('blocks')
      .upsert({
        network: chainId,
        blockNumber: latestBlock,
        createdAt: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Error updating block tracker:', error);
      throw error;
    }

    console.log(`✅ Updated block tracker to block ${latestBlock}`);
  } catch (error) {
    console.error('❌ Error updating block tracker:', error);
  }
}

// Main execution
async function main() {
  const options = parseArgs();
  const supabase = initSupabase();

  console.log('\n🚀 Starting collection backfill...');
  console.log(`   Network: ${options.network} (chain ID: ${options.chainId})`);
  console.log(`   Indexer URL: ${options.indexerUrl}`);
  console.log(`   API Key: ${options.apiKey ? '***' + options.apiKey.slice(-4) : 'none'}`);
  console.log(`   Dry Run: ${options.dryRun}`);

  try {
    // 1. Get metadata location (prompt if not provided)
    if (!options.metadata) {
      console.log('\n📍 Metadata location can be:');
      console.log('   - Local file path (e.g., ./metadata/nakamingos.json)');
      console.log('   - GitHub raw URL (e.g., https://raw.githubusercontent.com/user/repo/main/metadata.json)');
      options.metadata = await promptForInput('\nEnter metadata location: ');
      
      if (!options.metadata) {
        console.error('Error: Metadata location is required');
        process.exit(1);
      }
    }
    
    console.log(`   Metadata: ${options.metadata}`);

    // 2. Load metadata
    const metadata = await loadMetadata(options.metadata);

    // 3. Use slug from metadata (CLI --slug overrides if provided)
    const slug = options.slug || metadata.slug;
    if (!slug) {
      console.error('Error: No slug found in metadata JSON and --slug not provided');
      process.exit(1);
    }
    console.log(`   Slug (from ${options.slug ? 'CLI' : 'metadata'}): ${slug}`);

    // 4. Populate attributes
    await populateAttributes(supabase, slug, metadata.collection_items);

    // 4. Ensure collection exists
    await ensureCollection(supabase, metadata, options.tableSuffix);

    // 5. Fetch ethscription data (creations + transfers)
    const { creations, transfers } = await fetchEthscriptionData(metadata.collection_items, options.apiBaseUrl);

    // 6. Combine and sort all transactions
    const transactions = combineAndSortTransactions(creations, transfers);

    // 7. Process transactions
    await processTransactions(transactions, options.indexerUrl, options.apiKey, options.dryRun);

    // 8. Update block tracker (skip in dry run)
    if (!options.dryRun) {
      await updateBlockTracker(supabase, options.chainId, options.apiBaseUrl);
    }

    console.log('\n✅ Backfill complete!\n');
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

main();
