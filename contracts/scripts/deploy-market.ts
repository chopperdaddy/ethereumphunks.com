import hre from 'hardhat';

const contractName = 'EtherPhunksMarket';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with the account:', signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(signer.address);

  await contract.waitForDeployment();
  console.log('Contract deployed to:', contract.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
