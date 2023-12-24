import hre from 'hardhat';

const contractName = 'Contributions';
const _beneficiary = '0x3d5eEB0046C1B6C7A1DF6EA4eEb02967de4fe087';

export async function deployDonations(pointsAddress: string) {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const args = [
    _beneficiary, // Beneficiary
    pointsAddress,  // Points
  ];

  const contract = await ContractFactory.deploy(args[0], args[1]);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log(`\n\n${contractName} deployed to:`, contractAddress);
  console.log('\n\nVerify with:');
  console.log(`npx hardhat verify --network goerli ${contractAddress}`, args.map((arg) => `${arg}`).join(' '));
}

deployDonations('0x005918E10Ed039807a62c564C72D527BaB15c987').then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
