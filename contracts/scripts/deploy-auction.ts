import hre from 'hardhat';

const contractName = 'EtherPhunksAuctionHouse';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with the account:', signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(
    signer.address,
    '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7',
    '0xaa0b9369a797e6e5e6c541e07851b7fc405bd651b7ad929b0d5ee4880bb3c80f',
    '200',
    '10',
    '600'
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('Verify with:');
  console.log(`npx hardhat verify --network goerli ${contractAddress} ${signer.address}`);
}

deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
