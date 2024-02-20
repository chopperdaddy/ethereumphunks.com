import hre from 'hardhat';

const contractName = 'EtherPhunksAuctionHouse';

export async function deployAuctionHouse(pointsAddress: string) {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args = [
    pointsAddress,  // Points
    '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7', // Treasury
    '0xaa0b9369a797e6e5e6c541e07851b7fc405bd651b7ad929b0d5ee4880bb3c80f', // MerkleRoot
    '200', // TimeBuffer
    '10', // MinBidIncrementPercentage
    '600', // Duration
  ];

  const contract = await ContractFactory.deploy(args[0], args[1], args[2], args[3], args[4], args[5]);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  console.log(`npx hardhat verify --network sepolia ${contractAddress}`, args.map((arg) => `"${arg}"`).join(' '));
}
