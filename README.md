# Ethereum Phunks Monorepo

![Static Badge](https://img.shields.io/badge/100%25-PHUNKY-green) [![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/etherphunks?style=social)](https://twitter.com/etherphunks)

Ethereum Phunks Market is an open source platform for trading ethscriptions on the Ethereum blockchain. The project consists of three main components: a marketplace frontend, smart contracts, and an indexer service.

## ⚠️ Disclaimer

IMPORTANT: The smart contracts in this repository are experimental and have not been audited. They come with absolutely no security guarantees. The contracts and other parts of the codebase are not guaranteed to be secure and should be considered experimental in nature. The code can change at any time without prior notice. Users interact with this codebase entirely at their own risk.

## ⚠️ Breaking Changes Notice

**This version contains significant breaking changes and requires updated database migrations located in the `supabase/migrations` folder. Please ensure you have the latest migrations before running this version of the indexer or marketplace.**

### Major Changes in This Release:
- **Build System**: Migrated from Angular CLI to Vite for improved performance & XMTP WASM bindings
- **Contract Upgrades**: V2 marketplace contracts with enhanced security and features
- **New Auction System**: Comprehensive auction house functionality
- **Database Schema**: New tables for auctions, admin management, and authentication
- **Authentication System**: JWT-based admin authentication with refresh tokens
- **Collection Management**: Admin dashboard for collection owners

## Project Structure

The repository is organized into three main directories:

### 1. Marketplace (`/marketplace`)
An Angular-based frontend application that provides an interface for:

- **Marketplace Features**:
  - Buy, sell & trade curated ethscription collections
  - Advanced filtering and search capabilities with trait-based filtering
  - Real-time price tracking and market data
  - Auction system with bidding and management

- **Social Features**:
  - In-app chat system powered by XMTP v3
  - Comments and discussions
  - User activity tracking
  - Leaderboard system
  - Notifications system

- **Technical Features**:
  - Vite build system for improved performance
  - IPFS integration for content storage
  - Progressive Web App (PWA) support
  - GraphQL integration
  - State management system with NgRx
  - Custom pipes and directives
  - Advanced trait filtering and sorting

### 2. Contracts (`/contracts`)
Smart contracts written in Solidity that power the Ethereum Phunks ecosystem:

- **Core Marketplace Functionality**:
  - V2 marketplace contracts with enhanced security
  - Auction house contracts for bidding and auction management
  - Bridge contracts for cross-chain operations
  - Utility contracts for points and rewards
  - Governance and administration features

- **Contract Versions**:
  - V1: Original marketplace with bidding functionality
  - V2: Enhanced marketplace with improved security and gas efficiency
  - V2_1: Latest deployed marketplace upgrade
  - Auction House: Dedicated auction system

Built with:
- Hardhat development environment
- OpenZeppelin contracts (v5)
- Comprehensive test suite
- Deployment scripts for multiple networks

### 3. Indexer (`/indexer`)
A NestJS-based backend service that:

- Indexes and processes ethscriptions following the [Ethscriptions Protocol](https://ethscriptions.com)
- Tracks marketplace events and activities
- Manages real-time data synchronization
- Provides API endpoints for the marketplace
- Processes auction events and manages auction lifecycle
- Handles collection admin operations and authentication

Key features:
- Protocol-compliant ethscription processing
- Real-time block processing
- Queue-based event handling
- Bridge operation support
- WebSocket notifications
- JWT-based authentication system
- Collection admin management
- Enhanced auction indexing

### 4. Supabase (`/supabase`)
Contains the database schema and configuration for the project's PostgreSQL database:

- **Database Schema**:
  - Tables for ethscriptions, listings, bids, auctions, and collections
  - Auction system tables (auctions, auctionBids)
  - Admin management tables (collections with adminAddress)
  - Authentication tables (refresh_tokens, users)
  - Separate tables for mainnet and sepolia testnet
  - Event tracking and activity logs
  - Leaderboard and points system

- **Stored Procedures**:
  - Functions for fetching ethscriptions with listings and bids
  - Auction data retrieval and management
  - Pagination and filtering utilities
  - Volume and sales calculations
  - User activity tracking
  - Address verification and holder checks

- **Configuration**:
  - Database configuration settings
  - Migration scripts
  - Data seeding utilities

## Getting Started

### Prerequisites
- Node.js (v20 or higher)
- Yarn package manager
- Redis (for indexer queues)
- Supabase (for data storage)
- IPFS (for content storage)

### Development Setup

1. Clone the repository
2. Install dependencies for each component:
   ```bash
   # Marketplace
   cd marketplace
   yarn install

   # Contracts
   cd ../contracts
   yarn install

   # Indexer
   cd ../indexer
   yarn install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` in each directory
   - Update with your specific configuration

4. **Database Setup** (REQUIRED for new features):
   ```bash
   cd supabase
   # Apply the latest migrations for breaking changes
   # This includes new auction tables, admin management, and authentication
   ```

5. Start development servers:
   ```bash
   # Marketplace
   cd marketplace
   yarn start:mainnet # or yarn start:sepolia

   # Indexer
   cd ../indexer
   yarn start:dev
   ```

## Deployment

Each component has its own deployment process:

### Marketplace
```bash
cd marketplace
# NEW: Vite-based build system
yarn build:mainnet    # Build for mainnet
yarn build:sepolia    # Build for sepolia
yarn build            # Build both networks
# Deploy to your hosting service
```

### Contracts
```bash
cd contracts
yarn hardhat deploy --network <network>
```

### Indexer
```bash
cd indexer
yarn build
yarn engage
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. **IMPORTANT**: Test with the new database schema and contracts
4. Ensure all tests pass
5. Update documentation as needed
6. Commit your changes
7. Push to the branch
8. Create a Pull Request

## License

This project is licensed under the [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) license - see the LICENSE file for details.

## Resources

- [Ethscriptions Protocol](https://ethscriptions.com)
- [Twitter](https://twitter.com/etherphunks)
