import hre from 'hardhat';

const contractName = 'Contributions';

const _beneficiary = '0x3d5eEB0046C1B6C7A1DF6EA4eEb02967de4fe087';
const _pointsAddress = '0x117A605D32ca32972487971Dc166C6b4723142Fb';

export async function deployDonations() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args = [
    _beneficiary, // Beneficiary
    _pointsAddress,  // Points
  ];

  const contract = await ContractFactory.deploy(args[0], args[1]);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

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
