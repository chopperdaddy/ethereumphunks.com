import { ethers, upgrades } from 'hardhat';
import hre from 'hardhat';

import { expect } from 'chai';
import { Contract, encodeBytes32String } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

const contractName = 'EtherPhunksMarket';
const _version = 1;
const _pointsAddress = '0x24d667C5195a767819C9313D6ceEC09D0Dc06Cfd';

describe('EtherPhunksMarket', function () {

  let market: Contract;
  let owner: HardhatEthersSigner;
  let otherAccount: HardhatEthersSigner;

  beforeEach(async () => {
    // Deploy a fresh instance before each test
    const deployment = await deployEtherPhunksMarketFixture();
    market = deployment.market;
    owner = deployment.owner;
    otherAccount = deployment.otherAccount;
  });

  describe('Deployment', () => {
    it('Should initialize with the correct contract version and points address', async () => {
      // const { market, owner } = await deployEtherPhunksMarketFixture();

      const version = await market.contractVersion();
      const pointsAddress = await market.pointsAddress();

      expect(version).to.equal(hre.ethers.getBigInt(_version));
      expect(pointsAddress).to.equal(_pointsAddress);
    });
  });

  describe('Escrow Phunk', () => {
    it('Should allow a user to escrow a phunk', async () => {

      const marketAddress = await market.getAddress();
      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';

      await escrowPhunk(marketAddress, owner, phunkId);

      const escrowedPhunk = await market.userEthscriptionPossiblyStored(owner, phunkId);
      expect(escrowedPhunk).to.equal(true);
    });
  });

  describe('Offer Phunk for Sale', () => {
    it('Should allow a user to offer a phunk for sale', async () => {

      const marketAddress = await market.getAddress();
      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
      const minSalePriceInWei = hre.ethers.formatUnits('1000000000000000000', 'wei');

      await escrowPhunk(marketAddress, owner, phunkId);

      await market.offerPhunkForSale(phunkId, minSalePriceInWei);
      const offer = await market.phunksOfferedForSale(phunkId);

      expect(offer.isForSale).to.be.true;
      expect(offer.minValue).to.equal(minSalePriceInWei);
    });
  });

  describe('Offer Non-Escrowed Phunk for Sale', () => {
    it('Should revert when a user tries to offer a phunk that is not in escrow', async () => {
      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
      const minSalePriceInWei = hre.ethers.formatUnits('1000000000000000000', 'wei');

      market.connect(owner);

      await expect(
        market.offerPhunkForSale(phunkId, minSalePriceInWei)
      ).to.be.revertedWith(`That's not your Phunk 🖕`);
    });
  });

  describe('Offer Phunk for Sale to Address', () => {
    it('Should allow a user to offer a phunk for sale to another address', async () => {
      const marketAddress = await market.getAddress();

      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
      const minSalePriceInWei = hre.ethers.formatUnits('1000000000000000000', 'wei');

      await escrowPhunk(marketAddress, owner, phunkId);

      await market.offerPhunkForSaleToAddress(phunkId, minSalePriceInWei, otherAccount.address);
      const offer = await market.phunksOfferedForSale(phunkId);

      expect(offer.isForSale).to.be.true;
      expect(offer.minValue).to.equal(minSalePriceInWei);
      expect(offer.onlySellTo).to.equal(otherAccount.address);
    });
  });

  describe('Offer Non-Escrowed Phunk for Sale to Address', () => {
    it('Should revert when a user tries to offer a phunk for sale, that is not in escrow, to another address', async () => {

      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
      const minSalePriceInWei = hre.ethers.formatUnits('1000000000000000000', 'wei');

      market.connect(owner);

      await expect(
        market.offerPhunkForSaleToAddress(phunkId, minSalePriceInWei, otherAccount.address)
      ).to.be.revertedWith(`That's not your Phunk 🖕`);
    });
  });

  describe('Escrow and list with fallback', () => {
    it('Should allow a user to escrow and list a phunk with fallback function and signature', async () => {
      const marketAddress = await market.getAddress();

      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
      const minSalePriceInWei = hre.ethers.formatUnits('1000000000000000000', 'wei');
      const depositAndListSignature = '0x4445504f5349545f414e445f4c4953545f5349474e4154555245000000000000';

      const priceInHex32 = hre.ethers.toBigInt(minSalePriceInWei).toString(16).padStart(64, '0');
      const data = phunkId + depositAndListSignature.slice(2) + priceInHex32;

      await escrowPhunk(marketAddress, owner, data);
      const offer = await market.phunksOfferedForSale(phunkId);
      const escrowedPhunk = await market.userEthscriptionPossiblyStored(owner, phunkId);

      expect(escrowedPhunk).to.equal(true);
      expect(offer.isForSale).to.be.true;
      expect(offer.minValue).to.equal(minSalePriceInWei);
      expect(Number(offer.onlySellTo)).to.equal(Number(0x0));
      expect(offer.seller).to.equal(owner.address);
    });
  });

  describe('Escrow and list to Address with fallback', () => {
    it('Should allow a user to escrow and list a phunk with fallback function and signature', async () => {
      const marketAddress = await market.getAddress();

      const phunkId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
      const minSalePriceInWei = hre.ethers.formatUnits('1000000000000000000', 'wei');
      const depositAndListSignature = '0x4445504f5349545f414e445f4c4953545f5349474e4154555245000000000000';

      const priceInHex32 = hre.ethers.toBigInt(minSalePriceInWei).toString(16).padStart(64, '0');
      const data = phunkId + depositAndListSignature.slice(2) + priceInHex32 + otherAccount.address.slice(2).padStart(64, '0');

      await escrowPhunk(marketAddress, owner, data);
      const offer = await market.phunksOfferedForSale(phunkId);
      const escrowedPhunk = await market.userEthscriptionPossiblyStored(owner, phunkId);

      expect(escrowedPhunk).to.equal(true);
      expect(offer.isForSale).to.be.true;
      expect(offer.minValue).to.equal(minSalePriceInWei);
      expect(offer.onlySellTo).to.equal(otherAccount.address);
      expect(offer.seller).to.equal(owner.address);
    });
  });

  async function deployEtherPhunksMarketFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const EtherPhunksMarket = await ethers.getContractFactory(contractName);

    // Deploy as upgradeable proxy
    const market = await upgrades.deployProxy(
      EtherPhunksMarket,
      [_version, _pointsAddress],
      { initializer: 'initialize' }
    );

    await market.waitForDeployment();

    return { market, owner, otherAccount };
  }

  async function escrowPhunk(
    marketAddress: string,
    owner: HardhatEthersSigner,
    phunkId: string
  ) {
    await owner.sendTransaction({
        to: marketAddress,
        value: 0,
        data: phunkId,
    });
  }
});
