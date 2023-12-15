import hre from 'hardhat';

import { deployMarket } from './deploy-market';
import { deployAuctionHouse } from './deploy-auction';
import { deployDonations } from './deploy-donate';

const contractName = 'Points';

async function deployPoints() {
  const [signer] = await hre.ethers.getSigners();

  console.log('=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy();

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  console.log(`npx hardhat verify --network goerli ${contractAddress} ${signer.address}`);
  console.log('=====================================================================');
  console.log(`\n`);

  return contractAddress;
}

deployPoints().then(async (pointsAddress) => {
  await deployMarket(pointsAddress);
  await deployAuctionHouse(pointsAddress);
  await deployDonations(pointsAddress);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// await hre.run('verify:verify', {
//   address: pointsAddress,
//   constructorArguments: [],
// });


// Points deployed to:              0x8974D44dAD885699155c17934E6d33135d85380F
// Market deployed to:              0x53A699992a217C6a802A8986634064De2E213E1C
// Auction House deployed to:       0xc6a824D8cce7c946A3F35879694b9261A36fc823
// Donations deployed to:           0x5795Af0D8eD22a8C013031B355b5F472867D345F
