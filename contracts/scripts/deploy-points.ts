import hre from 'hardhat';

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
  console.log(`npx hardhat verify --network goerli ${contractAddress}`);
  console.log('=====================================================================');
  console.log(`\n`);

  return contractAddress;
}

deployPoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
