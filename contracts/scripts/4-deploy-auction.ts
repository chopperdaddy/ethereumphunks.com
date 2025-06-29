import hre from 'hardhat';

const contractName = 'EtherPhunksAuctionHouse';
const pointsAddress = '0x2a953aa14e986b0595a0c5201dd267391bf7d39d';

export async function deployAuctionHouse(pointsAddress: string) {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args = [pointsAddress];

  const contract = await ContractFactory.deploy(args[0]);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  console.log(`npx hardhat verify --network sepolia ${contractAddress}`, args.map((arg) => `"${arg}"`).join(' '));
}

deployAuctionHouse(pointsAddress).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error({error});
  process.exit(1);
});
