import hre from 'hardhat';

const contractName = 'Contributions';
const _beneficiary = '0x051281d626b327638B916E1a52aF1495855016c1';

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

  console.log(`${contractName} deployed to:`, contractAddress);
  console.log('\nVerify with:');
  console.log(`npx hardhat verify --network goerli ${contractAddress} ${_beneficiary}`, args.map((arg) => `"${arg}"`).join(' '));
}

deployDonations('0x2A953aA14e986b0595A0c5201dD267391BF7d39d').then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
