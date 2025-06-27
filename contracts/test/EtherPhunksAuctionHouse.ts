import { ethers } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('EtherPhunksAuctionHouse', function () {
  let auctionHouse: any;
  let pointsContract: any;
  let owner: HardhatEthersSigner;
  let bidder1: HardhatEthersSigner;
  let bidder2: HardhatEthersSigner;
  let seller: HardhatEthersSigner;

  const testHashId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
  const defaultDuration = 7 * 24 * 60 * 60; // 7 days
  const defaultMinBidIncrement = 5; // 5%
  const defaultTimeBuffer = 15 * 60; // 15 minutes

  beforeEach(async function () {
    [owner, bidder1, bidder2, seller] = await ethers.getSigners();

    // Deploy mock Points contract
    const MockPoints = await ethers.getContractFactory('MockPoints');
    pointsContract = await MockPoints.deploy();
    await pointsContract.waitForDeployment();

    // Deploy AuctionHouse
    const AuctionHouse = await ethers.getContractFactory('EtherPhunksAuctionHouse');
    auctionHouse = await AuctionHouse.deploy(await pointsContract.getAddress());
    await auctionHouse.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should set the correct points address', async function () {
      expect(await auctionHouse.pointsAddress()).to.equal(await pointsContract.getAddress());
    });

    it('Should set the correct owner', async function () {
      expect(await auctionHouse.owner()).to.equal(owner.address);
    });

    it('Should start with auction ID 0', async function () {
      expect(await auctionHouse.auctionId()).to.equal(0);
    });

    it('Should revert with invalid points address', async function () {
      const AuctionHouse = await ethers.getContractFactory('EtherPhunksAuctionHouse');
      await expect(
        AuctionHouse.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith('Invalid points address');
    });
  });

  describe('Auction Creation via Fallback', function () {
    it('Should create an auction with valid parameters', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.emit(auctionHouse, 'AuctionCreated');

      const auction = await auctionHouse.auctions(seller.address, testHashId);
      expect(auction.hashId).to.equal(testHashId);
      expect(auction.owner).to.equal(seller.address);
      expect(auction.duration).to.equal(defaultDuration);
      expect(auction.minBidIncrementPercentage).to.equal(defaultMinBidIncrement);
      expect(auction.timeBuffer).to.equal(defaultTimeBuffer);
      expect(auction.settled).to.be.false;
      expect(auction.amount).to.equal(0);
      expect(auction.bidder).to.equal(ethers.ZeroAddress);
    });

    it('Should increment auction ID', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });

      expect(await auctionHouse.auctionId()).to.equal(1);
    });

    it('Should revert with insufficient data length', async function () {
      // Create data with correct signature but insufficient length (less than 160 bytes)
      const hashIdPadded = testHashId.slice(2).padStart(64, '0');
      const signature = ethers.keccak256(ethers.toUtf8Bytes("DEPOSIT_AND_AUCTION_SIGNATURE")).slice(2);
      const shortData = '0x' + hashIdPadded + signature + '00'.repeat(32); // Only 96 bytes total

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: shortData
        })
      ).to.be.revertedWith('Data too short');
    });

    it('Should revert with invalid data length (not multiple of 32)', async function () {
      // Create data with correct signature but invalid length (not divisible by 32)
      const hashIdPadded = testHashId.slice(2).padStart(64, '0');
      const signature = ethers.keccak256(ethers.toUtf8Bytes("DEPOSIT_AND_AUCTION_SIGNATURE")).slice(2);
      const durationHex = defaultDuration.toString(16).padStart(64, '0');
      const minBidIncrementHex = defaultMinBidIncrement.toString(16).padStart(64, '0');
      const timeBufferHex = defaultTimeBuffer.toString(16).padStart(64, '0');

      // Add one extra byte to make it not divisible by 32
      const invalidData = '0x' + hashIdPadded + signature + durationHex + minBidIncrementHex + timeBufferHex + '00';

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: invalidData
        })
      ).to.be.revertedWith('Invalid data length');
    });

    it('Should revert with invalid hashId', async function () {
      const data = encodeAuctionData('0x' + '00'.repeat(32), defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Invalid hashId');
    });

    it('Should revert with invalid duration (too short)', async function () {
      const data = encodeAuctionData(testHashId, 30 * 60, defaultMinBidIncrement, defaultTimeBuffer); // 30 minutes

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Invalid duration');
    });

    it('Should revert with invalid duration (too long)', async function () {
      const data = encodeAuctionData(testHashId, 31 * 24 * 60 * 60, defaultMinBidIncrement, defaultTimeBuffer); // 31 days

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Invalid duration');
    });

    it('Should revert with invalid bid increment percentage', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, 0, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Invalid bid increment');
    });

    it('Should revert with invalid time buffer (too short)', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, 4 * 60); // 4 minutes

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Invalid time buffer');
    });

    it('Should revert when contract is paused', async function () {
      await auctionHouse.pause();
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Contract is paused');
    });

    it('Should revert when auction already exists', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      // Create first auction
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });

      // Try to create second auction with same hashId
      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWith('Auction already exists');
    });

    it('Should ignore calls without proper signature', async function () {
      // Create data without the proper signature
      const hashIdPadded = testHashId.slice(2).padStart(64, '0');
      const wrongSignature = ethers.keccak256(ethers.toUtf8Bytes("WRONG_SIGNATURE")).slice(2);
      const durationHex = defaultDuration.toString(16).padStart(64, '0');
      const minBidIncrementHex = defaultMinBidIncrement.toString(16).padStart(64, '0');
      const timeBufferHex = defaultTimeBuffer.toString(16).padStart(64, '0');

      const dataWithWrongSignature = '0x' + hashIdPadded + wrongSignature + durationHex + minBidIncrementHex + timeBufferHex;

      // This should not create an auction - fallback should ignore it
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: dataWithWrongSignature
      });

      // Verify no auction was created
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      expect(auction.startTime).to.equal(0); // No auction should exist
    });
  });

  describe('Bidding', function () {
    beforeEach(async function () {
      // Create an auction
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });
    });

    it('Should allow valid bid', async function () {
      const bidAmount = ethers.parseEther('1');

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.emit(auctionHouse, 'AuctionBid')
        .withArgs(testHashId, 1, bidder1.address, bidAmount, false);

      const auction = await auctionHouse.auctions(seller.address, testHashId);
      expect(auction.amount).to.equal(bidAmount);
      expect(auction.bidder).to.equal(bidder1.address);
    });

    it('Should require minimum bid increment', async function () {
      const firstBid = ethers.parseEther('1');
      const insufficientBid = ethers.parseEther('1.04'); // Less than 5% increase

      // Place first bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: firstBid });

      // Try insufficient second bid
      await expect(
        auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: insufficientBid })
      ).to.be.revertedWith('Must send more than last bid by minBidIncrementPercentage amount');
    });

    it('Should refund previous bidder', async function () {
      const firstBid = ethers.parseEther('1');
      const secondBid = ethers.parseEther('1.1');

      const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);

      // Place first bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: firstBid });

      const bidder1BalanceAfterBid = await ethers.provider.getBalance(bidder1.address);

      // Place second bid (should refund first bidder)
      await auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: secondBid });

      const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);

      // Bidder1 should have been refunded the first bid amount
      expect(bidder1FinalBalance).to.be.gt(bidder1BalanceAfterBid);
    });

    it('Should extend auction if bid is within time buffer', async function () {
      const bidAmount = ethers.parseEther('1');

      // Fast forward to near the end of auction
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      const timeToForward = Number(auction.endTime) - defaultTimeBuffer + 60; // Within time buffer
      await time.increaseTo(timeToForward);

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.emit(auctionHouse, 'AuctionExtended');
    });

    it('Should award points to bidder', async function () {
      const bidAmount = ethers.parseEther('1');

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.emit(pointsContract, 'PointsAdded')
        .withArgs(bidder1.address, 42);
    });

    it('Should revert for non-existent auction', async function () {
      const invalidHashId = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const bidAmount = ethers.parseEther('1');

      await expect(
        auctionHouse.connect(bidder1).createBid(invalidHashId, seller.address, { value: bidAmount })
      ).to.be.revertedWith("Auction does not exist");
    });

    it('Should revert for expired auction', async function () {
      const bidAmount = ethers.parseEther('1');

      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.be.revertedWith('Auction expired');
    });
  });

  describe('Auction Settlement', function () {
    beforeEach(async function () {
      // Create an auction
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });
    });

    it('Should settle auction with winning bid', async function () {
      const bidAmount = ethers.parseEther('1');

      // Place bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount });

      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      // Mine blocks to satisfy cooldown period
      await mineCooldownBlocks();

      // Settle auction
      await expect(
        auctionHouse.settleAuction(testHashId, seller.address)
      ).to.emit(auctionHouse, 'AuctionSettled')
        .withArgs(testHashId, 1, bidder1.address, bidAmount);

      const settledAuction = await auctionHouse.auctions(seller.address, testHashId);
      expect(settledAuction.settled).to.be.true;
    });

    it('Should settle auction with no bids (NFT goes back to owner)', async function () {
      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      // Mine blocks to satisfy cooldown period
      await mineCooldownBlocks();

      // Settle auction
      await expect(
        auctionHouse.settleAuction(testHashId, seller.address)
      ).to.emit(auctionHouse, 'AuctionSettled')
        .withArgs(testHashId, 1, ethers.ZeroAddress, 0);
    });

    it('Should transfer ETH to seller on settlement', async function () {
      const bidAmount = ethers.parseEther('1');
      const sellerInitialBalance = await ethers.provider.getBalance(seller.address);

      // Place bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount });

      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      // Mine blocks to satisfy cooldown period
      await mineCooldownBlocks();

      // Settle auction
      await auctionHouse.settleAuction(testHashId, seller.address);

      const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
      expect(sellerFinalBalance).to.be.gt(sellerInitialBalance);
    });

    it('Should revert settlement of non-existent auction', async function () {
      const invalidHashId = '0x1234567890123456789012345678901234567890123456789012345678901234';

      await expect(
        auctionHouse.settleAuction(invalidHashId, seller.address)
      ).to.be.revertedWith("Auction does not exist");
    });

    it('Should revert settlement before auction end', async function () {
      await expect(
        auctionHouse.settleAuction(testHashId, seller.address)
      ).to.be.revertedWith("Auction has not completed");
    });

    it('Should revert double settlement', async function () {
      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      // Mine blocks to satisfy cooldown period
      await mineCooldownBlocks();

      // Settle auction once
      await auctionHouse.settleAuction(testHashId, seller.address);

      // Try to settle again
      await expect(
        auctionHouse.settleAuction(testHashId, seller.address)
      ).to.be.revertedWith('Auction has already been settled');
    });
  });

  describe('Pause/Unpause', function () {
    it('Should allow owner to pause', async function () {
      await expect(auctionHouse.pause())
        .to.emit(auctionHouse, 'Paused')
        .withArgs(owner.address);

      expect(await auctionHouse.paused()).to.be.true;
    });

    it('Should allow owner to unpause', async function () {
      await auctionHouse.pause();

      await expect(auctionHouse.unpause())
        .to.emit(auctionHouse, 'Unpaused')
        .withArgs(owner.address);

      expect(await auctionHouse.paused()).to.be.false;
    });

    it('Should revert when non-owner tries to pause', async function () {
      await expect(
        auctionHouse.connect(bidder1).pause()
      ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
    });

    it('Should revert when non-owner tries to unpause', async function () {
      await auctionHouse.pause();

      await expect(
        auctionHouse.connect(bidder1).unpause()
      ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
    });

    it('Should allow settlement when paused', async function () {
      // Create auction
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });

      // Place bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: ethers.parseEther('1') });

      // Pause contract
      await auctionHouse.pause();

      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      // Mine blocks to satisfy cooldown period
      await mineCooldownBlocks();

      // Should still be able to settle
      await expect(
        auctionHouse.settleAuction(testHashId, seller.address)
      ).to.not.be.reverted;
    });
  });

  describe('Ethscription Escrow Tests', function () {
    beforeEach(async function () {
      // Create an auction
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });
    });

    it('Should track ethscription deposit', async function () {
      const isStored = await auctionHouse.userEthscriptionPossiblyStored(seller.address, testHashId);
      expect(isStored).to.be.true;
    });

    it('Should have cooldown period for transfers', async function () {
      const blocksRemaining = await auctionHouse.blocksRemainingUntilValidTransfer(seller.address, testHashId);
      expect(blocksRemaining).to.be.gt(0);
    });
  });

  describe('Edge Cases', function () {
    it('Should handle failed ETH transfers gracefully', async function () {
      // This would need a more complex setup to test failed transfers
      // For now, we test the basic case
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });

      const bidAmount = ethers.parseEther('1');
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount });

      // Second bid should refund the first bidder
      const secondBid = ethers.parseEther('1.1');
      await expect(
        auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: secondBid })
      ).to.not.be.reverted;
    });

    it('Should allow creating new auction after previous one ends', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      // Create first auction
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });

      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      // Mine blocks to satisfy cooldown period
      await mineCooldownBlocks();

      // Settle the auction
      await auctionHouse.settleAuction(testHashId, seller.address);

      // Should be able to create a new auction with the same hashId
      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.not.be.reverted;
    });
  });

  // Helper function to mine blocks to satisfy cooldown period
  async function mineCooldownBlocks() {
    await ethers.provider.send("hardhat_mine", ["0x10"]); // Mine 16 blocks
  }

  // Helper function to encode auction data for fallback function
  function encodeAuctionData(hashId: string, duration: number, minBidIncrement: number, timeBuffer: number): string {
    // Remove '0x' prefix if present and ensure we have a clean 32-byte hash
    const cleanHashId = hashId.startsWith('0x') ? hashId.slice(2) : hashId;
    const hashIdPadded = cleanHashId.padStart(64, '0'); // 32 bytes = 64 hex chars

    // Create the signature hash that the contract expects
    const signature = ethers.keccak256(ethers.toUtf8Bytes("DEPOSIT_AND_AUCTION_SIGNATURE"));
    const signatureHex = signature.slice(2); // Remove '0x' prefix

    const durationHex = duration.toString(16).padStart(64, '0');
    const minBidIncrementHex = minBidIncrement.toString(16).padStart(64, '0');
    const timeBufferHex = timeBuffer.toString(16).padStart(64, '0');

    // Layout: hashId (32 bytes) + signature (32 bytes) + duration (32 bytes) + minBidIncrement (32 bytes) + timeBuffer (32 bytes)
    return '0x' + hashIdPadded + signatureHex + durationHex + minBidIncrementHex + timeBufferHex;
  }
});
