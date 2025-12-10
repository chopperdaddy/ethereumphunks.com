#!/usr/bin/env ts-node

/**
 * Backfill Collection Script
 * 
 * This script backfills an Ethscription collection's data from Ethereum Mainnet or Sepolia:
 * 1. Loads collection metadata JSON
 * 2. Validates and normalizes data
 * 3. Populates attributes_new table with SHA → traits mapping
 * 4. Creates/verifies collection exists in database
 * 5. Fetches all transfer history from Ethscriptions API
 * 6. Processes transactions in correct order via indexer's reindex endpoint
 * 
 * Usage:
 *   ts-node scripts/backfill-collection.ts --metadata=./metadata/collection.json
 * 
 * Options:
 *   --metadata: Path to metadata JSON file (required, must contain "slug" field)
 *   --network: Network to use - "mainnet" or "sepolia" (default: mainnet)
 *   --indexer-url: Indexer URL (default: http://localhost:3069)
 *   --dry-run: Don't actually process transactions, just show what would happen
 *   --no-strict: Disable strict mode (warnings won't cause failure)
 *   --force: Skip collection exists check
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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedItems: CollectionItem[];
  stats: {
    totalItems: number;
    normalizedShas: number;
    duplicateIndexes: Map<number, string[]>;
    duplicateShas: Map<string, number[]>;
    missingNames: number;
    missingEthscriptionNumbers: number;
    indexGaps: number[];
  };
}

// Validation regex patterns
const HEX_64 = /^[0-9a-f]{64}$/i;
const HEX_66 = /^0x[0-9a-f]{64}$/i;

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    indexerUrl: 'http://localhost:3069',
    network: 'mainnet',
    dryRun: false,
    strict: true,  // Strict mode ON by default
    force: false,
  };

  args.forEach((arg, index) => {
    if (arg.startsWith('--metadata=')) {
      options.metadata = arg.split('=')[1];
    } else if (arg === '--metadata' && args[index + 1]) {
      options.metadata = args[index + 1];
    } else if (arg.startsWith('--indexer-url=')) {
      options.indexerUrl = arg.split('=')[1];
    } else if (arg === '--indexer-url' && args[index + 1]) {
      options.indexerUrl = args[index + 1];
    } else if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.split('=')[1];
    } else if (arg === '--api-key' && args[index + 1]) {
      options.apiKey = args[index + 1];
    } else if (arg.startsWith('--network=')) {
      const network = arg.split('=')[1].toLowerCase();
      if (network !== 'mainnet' && network !== 'sepolia') {
        console.error('Error: --network must be either "mainnet" or "sepolia"');
        process.exit(1);
      }
      options.network = network;
    } else if (arg === '--network' && args[index + 1]) {
      const network = args[index + 1].toLowerCase();
      if (network !== 'mainnet' && network !== 'sepolia') {
        console.error('Error: --network must be either "mainnet" or "sepolia"');
        process.exit(1);
      }
      options.network = network;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--no-strict') {
      options.strict = false;
    } else if (arg === '--force') {
      options.force = true;
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

// Validate and normalize collection metadata
function validateAndNormalizeMetadata(metadata: CollectionMetadata): ValidationResult {
  console.log(`\n🔍 Validating metadata...`);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedItems: CollectionItem[] = [];
  
  const stats = {
    totalItems: metadata.collection_items.length,
    normalizedShas: 0,
    duplicateIndexes: new Map<number, string[]>(),
    duplicateShas: new Map<string, number[]>(),
    missingNames: 0,
    missingEthscriptionNumbers: 0,
    indexGaps: [] as number[],
  };

  // Track seen values for duplicate detection
  const seenIndexes = new Map<number, string>(); // index -> first id that used it
  const seenShas = new Map<string, number>(); // sha -> first index that used it
  const allIndexes: number[] = [];

  for (let i = 0; i < metadata.collection_items.length; i++) {
    const item = { ...metadata.collection_items[i] };
    
    // === Required field validation ===
    if (!item.id) {
      errors.push(`Item ${i}: Missing required field 'id'`);
      continue;
    }
    if (!item.sha) {
      errors.push(`Item ${i}: Missing required field 'sha'`);
      continue;
    }
    if (item.index === undefined || item.index === null) {
      errors.push(`Item ${i}: Missing required field 'index'`);
      continue;
    }

    // === Validate ID (transaction hash) - must be 0x + 64 hex chars ===
    const normalizedId = item.id.toLowerCase();
    if (!HEX_66.test(normalizedId)) {
      errors.push(`Item ${i} (index ${item.index}): Invalid ID format '${item.id}' - must be 0x + 64 hex chars`);
      continue;
    }
    item.id = normalizedId;

    // === Normalize SHA ===
    let normalizedSha = item.sha.toLowerCase();
    if (normalizedSha.startsWith('0x')) {
      normalizedSha = normalizedSha.slice(2);
      stats.normalizedShas++;
    }
    
    // Validate SHA format (must be 64 hex chars, no 0x prefix)
    if (!HEX_64.test(normalizedSha)) {
      errors.push(`Item ${i} (index ${item.index}): Invalid SHA format '${item.sha}' - must be 64 char hex`);
      continue;
    }
    item.sha = normalizedSha;

    // === Validate index is a number ===
    const indexNum = Number(item.index);
    if (isNaN(indexNum) || !Number.isInteger(indexNum)) {
      errors.push(`Item ${i}: Invalid index '${item.index}' - must be an integer`);
      continue;
    }
    item.index = indexNum;
    allIndexes.push(indexNum);

    // === Check for duplicate indexes ===
    if (seenIndexes.has(indexNum)) {
      if (!stats.duplicateIndexes.has(indexNum)) {
        stats.duplicateIndexes.set(indexNum, [seenIndexes.get(indexNum)!]);
      }
      stats.duplicateIndexes.get(indexNum)!.push(item.id);
      warnings.push(`Item ${i}: Duplicate index ${indexNum} (also used by ${seenIndexes.get(indexNum)})`);
    } else {
      seenIndexes.set(indexNum, item.id);
    }

    // === Check for duplicate SHAs ===
    if (seenShas.has(normalizedSha)) {
      if (!stats.duplicateShas.has(normalizedSha)) {
        stats.duplicateShas.set(normalizedSha, [seenShas.get(normalizedSha)!]);
      }
      stats.duplicateShas.get(normalizedSha)!.push(indexNum);
      warnings.push(`Item ${i}: Duplicate SHA ${normalizedSha.slice(0, 16)}... (also used by index ${seenShas.get(normalizedSha)})`);
    } else {
      seenShas.set(normalizedSha, indexNum);
    }

    // === Check for missing optional fields ===
    if (!item.name || item.name.trim() === '') {
      stats.missingNames++;
      warnings.push(`Item ${i} (index ${indexNum}): Missing 'name' field`);
    }

    // Check for ethscription_number if it exists in schema
    if (!(item as any).ethscription_number) {
      stats.missingEthscriptionNumbers++;
    }

    normalizedItems.push(item);
  }

  // === Check for index gaps ===
  if (allIndexes.length > 0) {
    const sortedIndexes = [...allIndexes].sort((a, b) => a - b);
    const minIndex = sortedIndexes[0];
    const maxIndex = sortedIndexes[sortedIndexes.length - 1];
    const indexSet = new Set(sortedIndexes);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      if (!indexSet.has(i)) {
        stats.indexGaps.push(i);
      }
    }
    
    if (stats.indexGaps.length > 0) {
      const gapPreview = stats.indexGaps.slice(0, 5).join(', ');
      const moreCount = stats.indexGaps.length > 5 ? ` and ${stats.indexGaps.length - 5} more` : '';
      warnings.push(`Index gaps detected: ${gapPreview}${moreCount} (total: ${stats.indexGaps.length} gaps in range ${minIndex}-${maxIndex})`);
    }
  }

  // === Print validation report ===
  console.log(`\n📊 Validation Report:`);
  console.log(`   Total items: ${stats.totalItems}`);
  console.log(`   Valid items: ${normalizedItems.length}`);
  console.log(`   Normalized SHAs (removed 0x): ${stats.normalizedShas}`);
  
  if (stats.duplicateIndexes.size > 0) {
    console.log(`   ⚠️  Duplicate indexes: ${stats.duplicateIndexes.size}`);
  }
  if (stats.duplicateShas.size > 0) {
    console.log(`   ⚠️  Duplicate SHAs: ${stats.duplicateShas.size}`);
  }
  if (stats.missingNames > 0) {
    console.log(`   ⚠️  Missing names: ${stats.missingNames}`);
  }
  if (stats.indexGaps.length > 0) {
    console.log(`   ⚠️  Index gaps: ${stats.indexGaps.length}`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => console.log(`   ${e}`));
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.slice(0, 10).forEach(w => console.log(`   ${w}`));
    if (warnings.length > 10) {
      console.log(`   ... and ${warnings.length - 10} more warnings`);
    }
  }

  const isValid = errors.length === 0;
  
  if (isValid && warnings.length === 0) {
    console.log(`\n✅ Validation passed with no issues`);
  } else if (isValid) {
    console.log(`\n✅ Validation passed with ${warnings.length} warning(s)`);
  } else {
    console.log(`\n❌ Validation failed with ${errors.length} error(s)`);
  }

  return {
    isValid,
    errors,
    warnings,
    normalizedItems,
    stats,
  };
}

// Check if collection already exists in database
async function checkCollectionExists(supabase: any, slug: string, tableSuffix: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(`collections${tableSuffix}`)
    .select('slug')
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('❌ Error checking collection:', error);
    throw error;
  }

  return !!data;
}

// Check for duplicate ethscription IDs in database
async function checkDuplicateIdsInDatabase(
  supabase: any, 
  items: CollectionItem[], 
  tableSuffix: string
): Promise<{ duplicates: Array<{ id: string; index: number; existingSlug: string }> }> {
  console.log(`\n🔍 Checking for duplicate ethscription IDs in database...`);
  
  const duplicates: Array<{ id: string; index: number; existingSlug: string }> = [];
  const batchSize = 100;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const ids = batch.map(item => item.id);
    
    const { data, error } = await supabase
      .from(`ethscriptions${tableSuffix}`)
      .select('hashId, slug')
      .in('hashId', ids);

    if (error) {
      console.error('❌ Error checking for duplicates:', error);
      throw error;
    }

    if (data && data.length > 0) {
      data.forEach((existing: any) => {
        const item = batch.find(b => b.id.toLowerCase() === existing.hashId?.toLowerCase());
        if (item) {
          duplicates.push({
            id: existing.hashId,
            index: item.index,
            existingSlug: existing.slug,
          });
        }
      });
    }
  }

  if (duplicates.length > 0) {
    console.log(`   ⚠️  Found ${duplicates.length} ethscription ID(s) already in database`);
    duplicates.slice(0, 5).forEach(d => {
      console.log(`      - ${d.id.slice(0, 20)}... (index ${d.index}) exists in '${d.existingSlug}'`);
    });
    if (duplicates.length > 5) {
      console.log(`      ... and ${duplicates.length - 5} more`);
    }
  } else {
    console.log(`   ✅ No duplicate ethscription IDs found`);
  }

  return { duplicates };
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
  console.log(`   Strict Mode: ${options.strict}`);
  console.log(`   Force: ${options.force}`);

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
    
    // 2a. Get slug from metadata (required)
    const slug = metadata.slug;
    if (!slug) {
      console.error('❌ Error: Metadata JSON must contain a "slug" field.');
      process.exit(1);
    }
    console.log(`   Slug: ${slug}`);

    // 3. Validate and normalize metadata
    const validation = validateAndNormalizeMetadata(metadata);
    
    // 3a. Handle validation errors
    if (!validation.isValid) {
      console.error(`\n❌ Validation failed with ${validation.errors.length} error(s)`);
      if (options.strict) {
        console.error('   Strict mode is ON. Use --no-strict to proceed with warnings only.');
        process.exit(1);
      } else {
        console.warn('   Strict mode is OFF. Proceeding with valid items only...');
      }
    }
    
    // 3b. Handle strict mode warnings
    if (options.strict && validation.warnings.length > 0) {
      console.warn(`\n⚠️  Validation has ${validation.warnings.length} warning(s) in strict mode.`);
      console.warn('   Use --no-strict to ignore warnings and proceed.');
      
      // In strict mode, duplicate indexes, duplicate SHAs, and index gaps are fatal
      if (validation.stats.duplicateIndexes.size > 0 || validation.stats.duplicateShas.size > 0) {
        console.error('   ❌ Duplicate indexes or SHAs detected - cannot proceed in strict mode.');
        process.exit(1);
      }
      
      if (validation.stats.indexGaps.length > 0) {
        console.error(`   ❌ Index gaps detected (${validation.stats.indexGaps.length} gaps) - cannot proceed in strict mode.`);
        process.exit(1);
      }
    }
    
    // Use normalized items for processing
    const itemsToProcess = validation.normalizedItems;
    if (itemsToProcess.length === 0) {
      console.error('❌ No valid items to process after validation');
      process.exit(1);
    }
    console.log(`\n📦 Processing ${itemsToProcess.length} validated items`);

    // 4. Check if collection already exists
    const collectionExists = await checkCollectionExists(supabase, slug, options.tableSuffix);
    if (collectionExists && !options.force) {
      console.error(`\n❌ Collection "${slug}" already exists in database.`);
      console.error('   Use --force to overwrite existing collection data.');
      process.exit(1);
    } else if (collectionExists && options.force) {
      console.warn(`\n⚠️  Collection "${slug}" exists - will overwrite with --force flag`);
    }

    // 5. Check for duplicate ethscription IDs already in database
    const dbCheck = await checkDuplicateIdsInDatabase(supabase, itemsToProcess, options.tableSuffix);
    if (dbCheck.duplicates.length > 0 && !options.force) {
      console.error(`\n❌ Found ${dbCheck.duplicates.length} ethscription ID(s) already in database.`);
      console.error('   Use --force to overwrite existing ethscription data.');
      process.exit(1);
    } else if (dbCheck.duplicates.length > 0 && options.force) {
      console.warn(`\n⚠️  ${dbCheck.duplicates.length} ethscriptions exist - will overwrite with --force flag`);
    }

    // 6. Populate attributes (use validated/normalized items)
    await populateAttributes(supabase, slug, itemsToProcess);

    // 7. Ensure collection exists
    await ensureCollection(supabase, metadata, options.tableSuffix);

    // 8. Fetch ethscription data (creations + transfers)
    const { creations, transfers } = await fetchEthscriptionData(itemsToProcess, options.apiBaseUrl);

    // 9. Combine and sort all transactions
    const transactions = combineAndSortTransactions(creations, transfers);

    // 10. Process transactions
    await processTransactions(transactions, options.indexerUrl, options.apiKey, options.dryRun);

    // 11. Update block tracker (skip in dry run)
    if (!options.dryRun) {
      await updateBlockTracker(supabase, options.chainId, options.apiBaseUrl);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Collection: ${metadata.name} (${slug})`);
    console.log(`   Network: ${options.network}`);
    console.log(`   Items processed: ${itemsToProcess.length}/${validation.stats.totalItems}`);
    console.log(`   Transactions: ${transactions.length}`);
    if (validation.stats.normalizedShas > 0) {
      console.log(`   SHAs normalized: ${validation.stats.normalizedShas}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`   Warnings: ${validation.warnings.length}`);
    }
    console.log('='.repeat(60));

    console.log('\n✅ Backfill complete!\n');
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

main();
