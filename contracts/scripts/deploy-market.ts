// https://forum.openzeppelin.com/t/openzeppelin-upgrades-step-by-step-tutorial-for-hardhat/3580

import { ethers } from 'hardhat';
import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarket';

export async function deployMarket(pointsAddress: string) {
  const [signer] = await hre.ethers.getSigners();
  console.log(`\n\nDeploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args = [ pointsAddress ];

  const deploymentTransaction = await ContractFactory.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas(deploymentTransaction);
  console.log(`Estimated gas cost for deployment: ${estimatedGas.toString()}`);

  // Deploy upgradeable contract
  const contract = await upgrades.deployProxy(
    ContractFactory,
    args,
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();

  console.log(`${contractName} Proxy deployed to:`, proxyAddress);

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`\n\n${contractName} Implementation deployed to:`, implAddress);

  // Get admin address
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
  console.log(`\n\n${contractName} Admin deployed to:`, adminAddress);

  console.log('\n\nVerify with: ======================================');
  console.log(`npx hardhat verify --network goerli ${proxyAddress}`);
}

deployMarket('0x7c40c393dc0f283f318791d746d894ddd3693572').then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
