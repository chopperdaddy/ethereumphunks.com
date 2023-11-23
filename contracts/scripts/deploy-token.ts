import hre from 'hardhat';
import abi from '../artifacts/contracts/TokenContract.sol/TokenContract.json';

const contractName = 'TokenContract';

async function deploy() {

  const tokenName = 'clkqer';
  const tokenTotalSupply = 1000000;

  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with the account:', signer.address);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(tokenName, tokenTotalSupply);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  const deployedContract = new hre.ethers.Contract(contractAddress, abi.abi, signer);

  for (let index = 0; index < (tokenTotalSupply / 2); index++) {
    const tx = await deployedContract.mint();
    const receipt = await tx.wait();
    console.log('receipt', tx, receipt);
  }

  console.log(`${contractName} deployed to:`, contractAddress);

  // const tx = await contract.testEmitEvent(1);
  // const receipt = await tx.getTransaction();
  // console.log('receipt', receipt);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// async function deploy() {
//   const [signer] = await hre.ethers.getSigners();
//   console.log('Deploying contracts with the account:', signer.address);

//   const ContractFactory = await hre.ethers.getContractFactory(contractName);
//   const contract = await ContractFactory.deploy(signer.address);

//   await contract.waitForDeployment();
//   console.log('Contract deployed to:', contract.target);
// }
