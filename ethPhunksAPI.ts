export interface EthPhunk {
  id: number // Useless ID that is completely irrelevant
  createdAt: string | null // The date of the transaction
  hashId: string // The hash of the original transaction
  creator: string | null // Address of the creator
  owner: string | null // Address of the owner
  phunkId: number | null // The phunk ID
  sha: string // The sha of the phunk image
  data: string | null // The data of the transaction (Image) as hex
  ethscriptionNumber: number | null // The number ID of the ethscription
  blockHash: string | null // The hash of the block
  txIndex: number | null // The index of the transaction in the block
}

// API Key
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY';

// Endpoints & usage
// Base URL
const baseApiUrl = 'https://kcbuycbhynlmsrvoegzp.supabase.co/rest/v1/ethPhunks';

// Available Headers
const headers = {
  'apikey': apiKey, // Required
  'Authorization': `Bearer ${apiKey}`, // I dont think this is required but if you have issues, use it
  'Range': '0-1000' // Use this for pagination
}

// Available parameters
const params = {
  // select: '*', // Get all (Limited to 1000)
  select: 'phunkId,owner,hashId', // Get specific fields
  phunkId: 'eq.1', // Filter by a field
  hashId: 'eq.0x00000000000000', // Filter by another field (all fields can be used for filtering but not all have an index so they may be slow)
  order: 'phunkId.asc', // Order by a field
}
