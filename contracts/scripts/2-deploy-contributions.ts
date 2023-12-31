import { ethers } from 'hardhat';
import hre from 'hardhat';

const contractName = 'Contributions';

const _beneficiary = '0x3d5eEB0046C1B6C7A1DF6EA4eEb02967de4fe087';
const _pointsAddress = '0x24d667C5195a767819C9313D6ceEC09D0Dc06Cfd';

export async function deployDonations() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args: string[] = [
    _beneficiary, // Beneficiary
    _pointsAddress,  // Points
  ];

  // Simulate deployment to estimate gas
  const deploymentTransaction = await ContractFactory.getDeployTransaction(args[0], args[1]);
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

  // Wait 10 seconds in case we want to cancel the deployment
  await delay(10000);

  // Deploy the contract
  const contract = await ContractFactory.deploy(args[0], args[1]);
  const contractAddress = await contract.getAddress();

  // Wait for the contract to be deployed
  await contract.waitForDeployment();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  console.log(`npx hardhat verify --network goerli ${contractAddress}`, args.map((arg) => `${arg}`).join(' '));
  console.log('=====================================================================');
  console.log(`\n`);
}

// Points Address
deployDonations().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

