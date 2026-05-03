import { ethers } from 'hardhat';
import hre from 'hardhat';
import fs from 'fs';

const contractName = 'PointsV2';
type SeedEntry = [string, string | number | bigint] | { address: string; value: string | number | bigint };

async function deployPointsV2() {
  const [signer] = await hre.ethers.getSigners();
  const { seedUsers, seedAmounts } = readSeedData();

  console.log('\n\n=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);
  console.log(`Seed entries: ${seedUsers.length}`);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const deploymentTransaction = await ContractFactory.getDeployTransaction(seedUsers, seedAmounts);
  const estimatedGas = await ethers.provider.estimateGas(deploymentTransaction);
  const feeData = await ethers.provider.getFeeData();

  console.log('\nDeployment costs:');
  console.log({
    estimatedGas: Number(estimatedGas),
    gasPrice: Number(feeData.gasPrice),
    total: Number(estimatedGas) * Number(feeData.gasPrice),
    eth: ethers.formatEther(BigInt(`${Number(estimatedGas) * Number(feeData.gasPrice)}`)),
  });
  console.log('=====================================================================');

  await delay(10000);

  const contract = await ContractFactory.deploy(seedUsers, seedAmounts);
  const contractAddress = await contract.getAddress();

  await contract.waitForDeployment();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  if (seedUsers.length) {
    console.log(`npx hardhat verify --network sepolia --constructor-args <args-file.ts> ${contractAddress}`);
  } else {
    console.log(`npx hardhat verify --network sepolia ${contractAddress} "[]" "[]"`);
  }
  console.log('=====================================================================');
  console.log(`\n`);

  return contractAddress;
}

function readSeedData(): { seedUsers: string[]; seedAmounts: bigint[] } {
  const seedFile = process.env.POINTS_V2_SEED_FILE;
  if (!seedFile) return { seedUsers: [], seedAmounts: [] };

  const parsed = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as SeedEntry[];
  const seedUsers: string[] = [];
  const seedAmounts: bigint[] = [];

  for (const entry of parsed) {
    if (Array.isArray(entry)) {
      seedUsers.push(entry[0]);
      seedAmounts.push(BigInt(entry[1]));
    } else {
      seedUsers.push(entry.address);
      seedAmounts.push(BigInt(entry.value));
    }
  }

  return { seedUsers, seedAmounts };
}

deployPointsV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
