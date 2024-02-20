// https://forum.openzeppelin.com/t/openzeppelin-upgrades-step-by-step-tutorial-for-hardhat/3580
import { ethers } from 'hardhat';
import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarket';

const _version = 1;
const _pointsAddress = '0x2A953aA14e986b0595A0c5201dD267391BF7d39d';

export async function deployMarket() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const args = [ _version, _pointsAddress ];

  // Deploy upgradeable contract
  const contract = await upgrades.deployProxy(
    ContractFactory,
    args,
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();

  console.log('\n\n=====================================================================');
  console.log(`${contractName} Proxy deployed to:`, proxyAddress);
  console.log('=====================================================================');

  console.log('\n\n=====================================================================');
  console.log(`Verify with: npx hardhat verify --network sepolia ${proxyAddress}`);
  console.log('=====================================================================');

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('\n\n=====================================================================');
  console.log(`${contractName} Implementation deployed to:`, implAddress);
  console.log('=====================================================================');

  // Get admin address
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
  console.log('\n\n=====================================================================');
  console.log(`${contractName} Admin deployed to:`, adminAddress);
  console.log('=====================================================================');
  console.log(`\n`);
}

deployMarket().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
