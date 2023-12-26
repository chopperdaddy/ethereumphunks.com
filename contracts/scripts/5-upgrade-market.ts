// https://forum.openzeppelin.com/t/openzeppelin-upgrades-step-by-step-tutorial-for-hardhat/3580

import { ethers } from 'hardhat';
import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarketV3';

const _proxyAddress = '0x6f67A6F9a1d334CD105170bCd685C518D5610601';

export async function upgradeMarket() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Upgrading to ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args: any[] = [];

  // Deploy upgradeable contract
  const contract = await upgrades.upgradeProxy(
    _proxyAddress,
    ContractFactory
  );

  await contract.waitForDeployment();
  const upgraded = await contract.getAddress();

  console.log('\n\n=====================================================================');
  console.log(`${contractName} Upgraded`, upgraded);
  console.log('=====================================================================');

  console.log('\n\n=====================================================================');
  console.log(`Verify with: npx hardhat verify --network goerli ${upgraded}`);
  console.log('=====================================================================');
}

upgradeMarket().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
