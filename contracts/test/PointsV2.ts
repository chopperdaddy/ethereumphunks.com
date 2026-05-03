import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('PointsV2', function () {
  let pointsContract: any;
  let owner: any;
  let manager: any;
  let user: any;
  let recipient: any;

  const dataUriPrefix = 'data:application/json;rule=esip6;base64,';

  beforeEach(async function () {
    [owner, manager, user, recipient] = await ethers.getSigners();

    const PointsV2 = await ethers.getContractFactory('PointsV2');
    pointsContract = await PointsV2.deploy([], []);
    await pointsContract.waitForDeployment();
  });

  it('seeds initial balances during deployment', async function () {
    const PointsV2 = await ethers.getContractFactory('PointsV2');
    const seedUsers = [user.address, recipient.address];
    const seedAmounts = [123, 456];
    const seededPoints = await PointsV2.deploy(seedUsers, seedAmounts);
    await seededPoints.waitForDeployment();
    const deploymentTx = seededPoints.deploymentTransaction();
    if (!deploymentTx) throw new Error('Missing deployment transaction');
    const receipt = await deploymentTx.wait();
    const ethscription = await getEthscriptionPayload(receipt, seededPoints);

    expect(await seededPoints.points(user.address)).to.equal(123);
    expect(await seededPoints.points(recipient.address)).to.equal(456);
    await expect(deploymentTx)
      .to.emit(seededPoints, 'PointsSeeded')
      .withArgs(user.address, 123)
      .and.to.emit(seededPoints, 'PointsSeeded')
      .withArgs(recipient.address, 456);
    expect(ethscription.initialOwner).to.equal(owner.address);
    expect(ethscription.payload).to.deep.equal({
      p: 'ethereumphunks.points.v2',
      op: 'PointsSeeded',
      seedCount: '2',
      seedTotal: '579',
      seedHash: ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['address[]', 'uint256[]'], [seedUsers, seedAmounts])
      ),
    });
  });

  it('reverts when seed arrays have different lengths', async function () {
    const PointsV2 = await ethers.getContractFactory('PointsV2');

    await expect(PointsV2.deploy([user.address], [])).to.be.revertedWith('Seed length mismatch');
  });

  it('keeps the original addPoints function and emits an Ethscription creation', async function () {
    await pointsContract.grantManager(manager.address);

    const tx = await pointsContract.connect(manager).addPoints(user.address, 100);
    const receipt = await tx.wait();
    const ethscription = await getEthscriptionPayload(receipt, pointsContract);

    expect(await pointsContract.points(user.address)).to.equal(100);
    await expect(tx).to.emit(pointsContract, 'PointsAdded').withArgs(user.address, 100);
    expect(ethscription.initialOwner).to.equal(user.address);
    expect(ethscription.contentURI.startsWith(dataUriPrefix)).to.equal(true);
    expect(ethscription.payload).to.deep.equal({
      p: 'ethereumphunks.points.v2',
      op: 'PointsAdded',
      from: ethers.ZeroAddress,
      to: user.address.toLowerCase(),
      amount: '100',
      pointsChanged: '100',
      multiplier: '1',
      balanceAfter: '100',
    });
  });

  it('keeps removePoints, transferPoints, drainPoints, and multiplier behavior compatible', async function () {
    await pointsContract.changeMultiplier(2);
    await pointsContract.addPoints(user.address, 10);

    expect(await pointsContract.points(user.address)).to.equal(20);

    await expect(pointsContract.removePoints(user.address, 3))
      .to.emit(pointsContract, 'PointsRemoved')
      .withArgs(user.address, 3);
    expect(await pointsContract.points(user.address)).to.equal(17);

    const transferTx = await pointsContract.connect(user).transferPoints(recipient.address, 5);
    const transferReceipt = await transferTx.wait();
    const transferEthscription = await getEthscriptionPayload(transferReceipt, pointsContract);

    await expect(transferTx)
      .to.emit(pointsContract, 'PointsTransferred')
      .withArgs(user.address, recipient.address, 5);
    expect(await pointsContract.points(user.address)).to.equal(12);
    expect(await pointsContract.points(recipient.address)).to.equal(10);
    expect(transferEthscription.initialOwner).to.equal(recipient.address);
    expect(transferEthscription.payload.op).to.equal('PointsTransferred');
    expect(transferEthscription.payload.pointsChanged).to.equal('10');
    expect(transferEthscription.payload.balanceAfter).to.equal('10');

    const drainTx = await pointsContract.drainPoints(user.address);
    const drainReceipt = await drainTx.wait();
    const drainEthscription = await getEthscriptionPayload(drainReceipt, pointsContract);

    expect(await pointsContract.points(user.address)).to.equal(0);
    expect(drainEthscription.initialOwner).to.equal(user.address);
    expect(drainEthscription.payload.op).to.equal('PointsDrained');
    expect(drainEthscription.payload.amount).to.equal('12');
  });

  it('keeps manager role functions compatible', async function () {
    await pointsContract.grantManager(manager.address);
    expect(await pointsContract.hasRole(await pointsContract.POINTS_MANAGER_ROLE(), manager.address)).to.equal(true);

    await pointsContract.revokeManager(manager.address);
    expect(await pointsContract.hasRole(await pointsContract.POINTS_MANAGER_ROLE(), manager.address)).to.equal(false);
  });

  async function getEthscriptionPayload(receipt: any, contract: any) {
    const contractAddress = (await contract.getAddress()).toLowerCase();
    const log = receipt.logs
      .filter((receiptLog: any) => receiptLog.address.toLowerCase() === contractAddress)
      .map((receiptLog: any) => {
        try {
          return contract.interface.parseLog(receiptLog);
        } catch {
          return null;
        }
      })
      .find((parsedLog: any) => parsedLog?.name === 'ethscriptions_protocol_CreateEthscription');

    expect(log).to.not.equal(undefined);

    const contentURI = log.args.contentURI;
    const encodedPayload = contentURI.slice(dataUriPrefix.length);

    return {
      initialOwner: log.args.initialOwner,
      contentURI,
      payload: JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8')),
    };
  }
});
