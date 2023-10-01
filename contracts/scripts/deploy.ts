import hre from 'hardhat';

import { getMerkleRoot } from './merkle';
import { encodeBytes32String } from 'ethers';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with the account:', signer.address);
  const deploy = await hre.ethers.deployContract('EtherPhunksMarket');

  await deploy.waitForDeployment();
  console.log('EtherPhunks deployed to:', deploy.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
