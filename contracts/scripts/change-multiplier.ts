import hre from 'hardhat';

import abi from '../artifacts/contracts/EtherPhunksMarket.sol/EtherPhunksMarket.json';
const contractName = 'EtherPhunksMarket';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();

  const contract = new hre.ethers.Contract(
    '0xCED69d8e170EA4859ac005c6646Ad9B768232cf9',
    abi.abi,
    signer
  );

  await contract['changeMultiplier'](2);
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
