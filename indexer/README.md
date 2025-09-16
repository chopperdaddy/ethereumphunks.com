# Ethereum Phunks Indexer

An EVM inscriptions indexer that indexes collections curated by the Ethereum Phunks marketplace. Follows the [Ethscriptions Protocol](https://ethscriptions.com) specifications for processing transfers, contract events, points, comments, auctions, and marketplace activities. Supports Ethereum Mainnet and Sepolia testnet with Layer 2 support.

## ⚠️ Breaking Changes Notice

**This version contains significant breaking changes and requires updated database migrations located in the `supabase/` folder. Please ensure you have the latest migrations before running the indexer.**

## Protocol Compliance

The indexer implements the complete Ethscriptions Protocol specification, including:

- **Data Format Validation**: Ensures all ethscriptions follow the protocol's data format rules
- **Content Type Handling**: Proper processing of supported content types as per protocol specifications
- **Transfer Rules**: Implements the protocol's transfer mechanism and validation
- **State Management**: Maintains accurate state tracking in accordance with protocol rules
- **Event Processing**: Handles all protocol-defined events and their implications

## Primary Features

- **Ethscription Indexing**: Core functionality for tracking and indexing ethscriptions curated by the marketplace
- **Marketplace Event Processing**:
  - Transfer tracking
  - Contract event monitoring
  - Points system events
  - Comment system events
  - Auction system events
  - Other marketplace-specific activities
- **Real-time Block Processing**: Watches and processes new blocks as they are added to the chain
- **Backfill Capability**: Can process historical blocks to catch up with the chain
- **Multi-chain Support**: L1/L2 bridge operations 

## Core Modules

### Core Processing Modules
1. **Ethscriptions Module**: Primary module for processing and tracking ethscriptions with ESIP compliance
2. **Processing Module**: Orchestrates block processing and transaction handling
3. **Storage Module**: Handles data persistence with enhanced Supabase integration
4. **EVM Module**: Manages blockchain connections and RPC fallbacks

### Marketplace Modules
1. **Marketplace Module**: Core marketplace event processing
2. **Auctions Module**: Auction lifecycle management and tracking
3. **Points Module**: Community points system
4. **Comments Module**: Comment system for ethscriptions

### Bridge & Infrastructure Modules
1. **BridgeL1Module**: Manages Layer 1 bridge operations (conditionally loaded)
2. **BridgeL2Module**: Handles Layer 2 bridge operations (conditionally loaded)
3. **Queue Module**: Manages background processing queues with Bull (conditionally loaded)
4. **Transaction Pool Module**: Optional module for transaction pool monitoring (conditionally loaded)

### Optional Feature Modules
1. **EthscriptionsMint Module**: Optional module for minting operations (conditionally loaded)
2. **Notifications Module**: Discord, Telegram, and Twitter integration
3. **Admin Module**: Administrative operations and collection management
4. **Collection Admin Module**: Collection-specific administrative tasks

## Prerequisites

- **Node.js**: v20 or higher
- **Yarn**: Package manager (preferred over npm)
- **Redis**: For queue management (required if QUEUE=1)
- **Supabase**: For data storage and management
- **Environment Configuration**: Properly configured environment files (see Configuration section)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```

## Configuration

The indexer uses a configuration system with environment validation and feature flags. **All configuration is centralized through the AppConfigService.**

### Environment Files Structure

The indexer requires three main environment files:

- `.env.supabase`: Supabase database configuration
- `.env.<network>`: Network-specific configuration

### Required Environment Variables

#### Core Configuration
- `NODE_ENV`: Environment mode ('development' or 'production')
- `PORT`: Service port (default: 3069)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `BRIDGE_BLOCK_DELAY`: Block delay for bridge operations (default: 10)

#### Feature Flags (0/1)
- `QUEUE`: Enable/disable queue processing
- `BRIDGE`: Enable/disable bridge operations
- `DISCORD`: Enable/disable Discord notification integration
- `TWITTER`: Enable/disable Twitter notification integration
- `TELEGRAM`: Enable/disable Telegram notification integration
- `TX_POOL`: Enable/disable transaction pool monitoring
- `MINT`: Enable/disable minting operations

#### Supabase Configuration
- `SUPABASE_URL`: Development/Local Supabase project URL
- `SUPABASE_SERVICE_ROLE`: Development/Local Supabase service role key
- `SUPABASE_URL_PROD`: Production Supabase URL (required in production)
- `SUPABASE_SERVICE_ROLE_PROD`: Production service role key (required in production)

#### Blockchain Configuration
- `CHAIN_ID_L1`: L1 chain ID
- `CHAIN_ID_L2`: Layer 2 chain ID
- `RPC_URL_L1`: Primary L1 RPC endpoint
- `RPC_URL_BACKUP_L1`: Backup L1 RPC endpoint (optional)
- `RPC_URL_L2`: Primary L2 RPC endpoint
- `RPC_URL_BACKUP_L2`: Backup L2 RPC endpoint (optional)

#### Contract Addresses
- `MARKET_ADDRESS_L1`: L1 marketplace contract address
- `MARKET_ADDRESS_L2`: L2 marketplace contract address
- `BRIDGE_ADDRESS_L1`: L1 bridge contract address
- `BRIDGE_ADDRESS_L2`: L2 bridge contract address
- `POINTS_ADDRESS_L1`: L1 points contract address
- `POINTS_ADDRESS_L2`: L2 points contract address
- `AUCTION_HOUSE_ADDRESS_L1`: L1 auction house contract address

#### Relayer Configuration
- `RELAY_SIGNER_ADDRESS_L1`: L1 relayer signer address
- `RELAY_SIGNER_PK_L1`: L1 relayer private key
- `RELAY_SIGNER_ADDRESS_L2`: L2 relayer signer address
- `RELAY_SIGNER_PK_L2`: L2 relayer private key

#### API Security
- `API_PRIVATE_KEY`: API private key for authentication
- `API_PUBLIC_KEY`: API public key for authentication

#### Notification Services (Optional)
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Telegram chat ID
- `DISCORD_BOT_TOKEN`: Discord bot token
- `TWITTER_USERNAME`: Twitter username
- `TWITTER_PASSWORD`: Twitter password
- `TWITTER_TWO_FACTOR_SECRET`: Twitter 2FA secret

### Configuration Validation

The indexer includes configuration validation using Joi schemas. Invalid configurations prevent startup with detailed error messages.

### Key Database Tables

- `ethscriptions` / `ethscriptions_sepolia`: Core ethscription data
- `collections` / `collections_sepolia`: Collection metadata and configuration
- `events` / `events_sepolia`: Transaction events and marketplace activities
- `auctions` / `auctions_sepolia`: Auction data and lifecycle
- `auctionBids` / `auctionBids_sepolia`: Auction bid tracking
- `listings` / `listings_sepolia`: Marketplace listings
- `bids` / `bids_sepolia`: Marketplace bids
- `comments` / `comments_sepolia`: Comment system data
- `users` / `users_sepolia`: User data and preferences
- `blocks`: Block processing tracking
- `refresh_tokens`: Authentication tokens

## Running the Indexer

### Development Mode

```bash
# For mainnet
yarn start:mainnet

# For Sepolia
yarn start:sepolia

# Add custom start commands for each network
```

### Production Mode (PM2)

PM2 configuration:

```bash
# Build and start all networks
yarn engage

# Build individual networks
yarn build:mainnet
yarn build:sepolia

# Start with PM2
pm2 start pm2.config.js
```

## API Endpoints

Protected API endpoints:

- `/admin/*`: Administrative operations and collection management
- `/ethscriptions/*`: Ethscription-related operations
- `/notifications/*`: Notification management
- `/bridge-l1/*`: Layer 1 bridge operations
- `/queue/*`: Queue management and monitoring
- `/auth/*`: Authentication and user management

**All POST endpoints are protected with API key middleware.**

## Queue System

Bull queues for background processing:

- **Block Processing Queue**: Handles block processing with retry logic
- **Bridge Processing Queue**: Manages bridge operations and cross-chain transfers

### Queue Management

```bash
# Monitor queue status
curl -X POST /queue/status

# Pause/resume queues
curl -X POST /queue/pause
curl -X POST /queue/resume

# Clear queues
curl -X POST /queue/clear
```

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create your feature branch
3. Ensure all tests pass
4. Update documentation as needed
5. Commit your changes
6. Push to the branch
7. Create a Pull Request

## Troubleshooting

### Common Issues

1. **Configuration Errors**: Check environment variable validation messages
2. **Database Connection**: Verify Supabase credentials and network access
3. **Queue Issues**: Ensure Redis is running and accessible
4. **RPC Failures**: Check RPC endpoint availability and fallback configuration

### Debug Mode

Enable debug logging by setting appropriate log levels in your environment configuration.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the configuration validation messages
- Review the database migration requirements
- Ensure all prerequisites are met
- Check the troubleshooting section above
