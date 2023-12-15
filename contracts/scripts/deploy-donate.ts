import hre from 'hardhat';

const contractName = 'Donations';
const _beneficiary = '0x51A83198deC9EfF470492AE5765aE907dB94F769';

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
