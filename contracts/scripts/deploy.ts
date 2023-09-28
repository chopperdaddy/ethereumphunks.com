import hre from 'hardhat';

async function deploy() {

  const [signer] = await hre.ethers.getSigners();

  console.log('Deploying contracts with the account:', signer.address);

  const address = '0xc10e735b1959afbf7aeab871d00111c9ac4de203';
  const deploy = await hre.ethers.deployContract('EtherPhunksMarket', [address]);

  await deploy.waitForDeployment();
  // console.log('EtherPhunks deployed to:', deploy.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
