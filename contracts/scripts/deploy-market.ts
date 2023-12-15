import hre from 'hardhat';

const contractName = 'EtherPhunksMarket';

export async function deployMarket(pointsAddress: string) {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args = [
    pointsAddress,  // Points
  ];

  const contract = await ContractFactory.deploy(args[0]);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  console.log(`npx hardhat verify --network goerli ${contractAddress} ${signer.address}`, args.map((arg) => `"${arg}"`).join(' '));
}
