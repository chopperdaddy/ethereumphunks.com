# PointsV2

`PointsV2` keeps points as a contract-native ledger and adds Ethscription receipts for point operations. Points are not a standalone Ethscriptions token.

## Source Of Truth

The contract remains the canonical source of truth for balances:

```solidity
mapping(address => uint256) public points;
```

Consumers should read balances from `points(user)`. Ethscriptions emitted by the contract are operation receipts that make point activity visible to Ethscriptions-aware indexers, but they do not replace the contract ledger.

## Swap-In API

`PointsV2` keeps the original callable function names:

- `addPoints(address user, uint256 amount)`
- `removePoints(address user, uint256 amount)`
- `transferPoints(address to, uint256 amount)`
- `drainPoints(address user)`
- `changeMultiplier(uint newMultiplier)`
- `grantManager(address manager)`
- `revokeManager(address manager)`

The existing `PointsAdded`, `PointsRemoved`, and `PointsTransferred` events are still emitted for compatibility. `PointsSeeded` is emitted only during constructor seeding.

## Deployment Seeding

Initial balances can be seeded in the constructor:

```solidity
constructor(address[] memory seedUsers, uint256[] memory seedAmounts)
```

The arrays must have the same length. Each `seedAmounts[i]` becomes the initial balance for `seedUsers[i]`.

Example constructor arguments:

```text
seedUsers:   [0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222]
seedAmounts: [100, 250]
```

The deploy script accepts an optional `POINTS_V2_SEED_FILE` environment variable. The file can be an array of tuple entries:

```json
[
  ["0x1111111111111111111111111111111111111111", "100"],
  ["0x2222222222222222222222222222222222222222", "250"]
]
```

Or an array of object entries:

```json
[
  { "address": "0x1111111111111111111111111111111111111111", "value": "100" },
  { "address": "0x2222222222222222222222222222222222222222", "value": "250" }
]
```

Run the deployment with:

```bash
POINTS_V2_SEED_FILE=./points-v2-seed.json HARDHAT_SOURCES_PATH=./contracts/V2 npx hardhat run --network mainnet scripts/9-deploy-points-v2.ts
```

For verification with seeded constructor arrays, create a constructor args file that exports `[seedUsers, seedAmounts]` and pass it to Hardhat:

```bash
npx hardhat verify --network mainnet --constructor-args ./points-v2-args.ts <contract-address>
```

Constructor seeding emits one Ethscription creation receipt for the whole seed batch. A deployment transaction can only create one protocol-valid Ethscription, so the constructor does not emit one Ethscription per seeded balance.

The seed Ethscription is a migration manifest with this decoded JSON shape:

```json
{
  "p": "ethereumphunks.points.v2",
  "op": "PointsSeeded",
  "seedCount": "2",
  "seedTotal": "350",
  "seedHash": "0x..."
}
```

`seedHash` is:

```solidity
keccak256(abi.encode(seedUsers, seedAmounts))
```

This lets anyone verify the off-chain seed file against the on-chain deployment receipt without storing the full address/value list inside the Ethscription payload. Per-user seed values are still visible through regular `PointsSeeded(user, amount)` EVM logs and through the initialized `points(user)` contract state.

## Operation Receipts

Point mutations after deployment emit:

```solidity
event ethscriptions_protocol_CreateEthscription(
    address indexed initialOwner,
    string contentURI
);
```

The `contentURI` is a base64 JSON data URI:

```text
data:application/json;rule=esip6;base64,...
```

Every `contentURI` decodes into one of the JSON shapes below.

### PointsSeeded

Emitted once from the constructor when seed arrays are non-empty. `initialOwner` is the deployer.

```json
{
  "p": "ethereumphunks.points.v2",
  "op": "PointsSeeded",
  "seedCount": "2",
  "seedTotal": "350",
  "seedHash": "0x4c9b7f9f0c1e2a3b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4"
}
```

### PointsAdded

Emitted by `addPoints(user, amount)`. `initialOwner` is `user`.

```json
{
  "p": "ethereumphunks.points.v2",
  "op": "PointsAdded",
  "from": "0x0000000000000000000000000000000000000000",
  "to": "0x1111111111111111111111111111111111111111",
  "amount": "100",
  "pointsChanged": "100",
  "multiplier": "1",
  "balanceAfter": "250"
}
```

### PointsRemoved

Emitted by `removePoints(user, amount)`. `initialOwner` is `user`.

```json
{
  "p": "ethereumphunks.points.v2",
  "op": "PointsRemoved",
  "from": "0x1111111111111111111111111111111111111111",
  "to": "0x0000000000000000000000000000000000000000",
  "amount": "25",
  "pointsChanged": "25",
  "multiplier": "1",
  "balanceAfter": "225"
}
```

### PointsTransferred

Emitted by `transferPoints(to, amount)`. `initialOwner` is `to`.

```json
{
  "p": "ethereumphunks.points.v2",
  "op": "PointsTransferred",
  "from": "0x1111111111111111111111111111111111111111",
  "to": "0x2222222222222222222222222222222222222222",
  "amount": "50",
  "pointsChanged": "50",
  "multiplier": "1",
  "balanceAfter": "150"
}
```

If `multiplier` is greater than `1`, `pointsChanged` is `amount * multiplier` because transferred points are credited through the same internal add path as awarded points.

### PointsDrained

Emitted by `drainPoints(user)`. `initialOwner` is `user`.

```json
{
  "p": "ethereumphunks.points.v2",
  "op": "PointsDrained",
  "from": "0x1111111111111111111111111111111111111111",
  "to": "0x0000000000000000000000000000000000000000",
  "amount": "225",
  "pointsChanged": "225",
  "multiplier": "1",
  "balanceAfter": "0"
}
```

`rule=esip6` is included so repeated point operations with identical payloads remain valid Ethscription creation attempts.

## Operation Semantics

`addPoints(user, amount)`:

- Requires `POINTS_MANAGER_ROLE`.
- Adds `amount * multiplier` to `points[user]`.
- Emits a `PointsAdded` event.
- Emits a `PointsAdded` Ethscription receipt with `from` as the zero address and `to` as `user`.

`removePoints(user, amount)`:

- Requires `DEFAULT_ADMIN_ROLE`.
- Subtracts `amount` from `points[user]`.
- Emits a `PointsRemoved` event.
- Emits a burn-like Ethscription receipt with `from` as `user` and `to` as the zero address.

`transferPoints(to, amount)`:

- Can be called by any unpaused account.
- Subtracts `amount` from `points[msg.sender]`.
- Adds `amount * multiplier` to `points[to]`.
- Emits a `PointsTransferred` event.
- Emits an Ethscription receipt with `from` as `msg.sender` and `to` as `to`.

`drainPoints(user)`:

- Requires `DEFAULT_ADMIN_ROLE`.
- Sets `points[user]` to zero.
- Emits a `PointsDrained` Ethscription receipt.
- Does not emit one of the original V1 compatibility events because V1 did not emit one for this function.

## Protocol Caveat

Ethscriptions allow only one created Ethscription per Ethereum transaction. If a marketplace or auction transaction calls `addPoints` multiple times, only the first protocol-valid creation log can become an Ethscription. The contract state and compatibility events still update normally for every call.
