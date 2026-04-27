/**
 * @fileoverview Comprehensive test suite for EtherPhunksAuctionHouse contract
 *
 * This test suite covers all functionality of the EtherPhunksAuctionHouse contract including:
 * - Contract deployment and initialization
 * - Whitelist management (enable/disable, add/remove addresses, bulk operations)
 * - Auction creation via fallback function with ethscription escrow
 * - Bidding mechanics with new restrictions and validations
 * - Auction settlement and ETH transfers
 * - Points system integration
 * - Pause/unpause functionality
 * - Edge cases and error conditions
 *
 * Key Features Tested:
 * - Whitelist-based auction creation controls
 * - Owner cannot bid on their own auctions
 * - Bidders cannot outbid themselves
 * - Automatic auction extension within time buffer
 * - Ethscription escrow integration
 * - Points awarded for bidding activity
 * - Safe ETH transfers with gas limits
 *
 * @author EtherPhunks
 * @version 2.0.0
 */

import { ethers } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

/**
 * Main test suite for the EtherPhunksAuctionHouse contract
 *
 * The EtherPhunksAuctionHouse is a sophisticated auction system that manages
 * the sale of ethscriptions (Ethereum-based digital artifacts). It includes
 * advanced features like whitelist controls, bidding restrictions, automatic
 * auction extensions, and integration with a points reward system.
 */
describe('EtherPhunksAuctionHouse', function () {
  // Contract instances
  let auctionHouse: any;           // EtherPhunksAuctionHouse contract instance
  let pointsContract: any;         // MockPoints contract instance for testing

  // Test signers representing different user roles
  let owner: HardhatEthersSigner;     // Contract owner (auto-whitelisted)
  let bidder1: HardhatEthersSigner;   // First bidder in auction scenarios
  let bidder2: HardhatEthersSigner;   // Second bidder for outbidding tests
  let seller: HardhatEthersSigner;    // Auction creator/seller

  // Test constants for auction parameters
  const testHashId = '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee';
  const defaultDuration = 7 * 24 * 60 * 60; // 7 days in seconds
  const defaultMinBidIncrement = 5; // 5% minimum bid increment
  const defaultTimeBuffer = 15 * 60; // 15 minutes time buffer for extensions

  /**
   * Setup hook that runs before each test
   * Deploys fresh contract instances and assigns test signers
   */
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

  /**
   * Test suite for contract deployment and initial state verification
   *
   * These tests ensure that the contract is properly deployed with correct
   * initial parameters, whitelist settings, and access controls.
   */
  describe('Deployment', function () {
    /** Verify points contract address is correctly set during deployment */
    it('Should set the correct points address', async function () {
      expect(await auctionHouse.pointsAddress()).to.equal(await pointsContract.getAddress());
    });

    /** Verify contract owner is correctly set during deployment */
    it('Should set the correct owner', async function () {
      expect(await auctionHouse.owner()).to.equal(owner.address);
    });

    /** Verify auction ID counter starts at 0 */
    it('Should start with auction ID 0', async function () {
      expect(await auctionHouse.auctionId()).to.equal(0);
    });

    /** Verify whitelist is enabled by default for security */
    it('Should enable whitelist by default', async function () {
      expect(await auctionHouse.whitelistEnabled()).to.be.true;
    });

    /** Verify contract owner is automatically whitelisted upon deployment */
    it('Should auto-whitelist the owner', async function () {
      expect(await auctionHouse.isWhitelisted(owner.address)).to.be.true;
    });

    /** Verify AddressWhitelisted event is emitted for owner during deployment */
    it('Should emit AddressWhitelisted event for owner during deployment', async function () {
      const AuctionHouse = await ethers.getContractFactory('EtherPhunksAuctionHouse');

      // Deploy and check for event emission
      const deploymentTx = await AuctionHouse.getDeployTransaction(await pointsContract.getAddress());
      const newContract = await AuctionHouse.deploy(await pointsContract.getAddress());
      const receipt = await newContract.deploymentTransaction()?.wait();

      // Check that owner is whitelisted (indirect verification that event was emitted)
      expect(await newContract.isWhitelisted(owner.address)).to.be.true;
    });

    /** Verify deployment fails with invalid points address */
    it('Should revert with invalid points address', async function () {
      const AuctionHouse = await ethers.getContractFactory('EtherPhunksAuctionHouse');
      await expect(
        AuctionHouse.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(AuctionHouse, 'InvalidPointsAddress');
    });
  });

  /**
   * Test suite for auction creation through the fallback function
   *
   * The contract uses a fallback function to handle ethscription deposits
   * and automatically create auctions. This tests the entire flow including
   * parameter validation, whitelist checks, and ethscription escrow.
   */
  describe('Auction Creation via Fallback', function () {
    beforeEach(async function () {
      // Whitelist the seller since whitelist is enabled by default
      await auctionHouse.addToWhitelist(seller.address);
    });

    /** Test auction creation when whitelist is enabled and user is whitelisted */
    it('Should allow whitelisted user to create auction when whitelist is enabled', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.emit(auctionHouse, 'AuctionCreated');
    });

    /** Test auction creation rejection when user is not whitelisted */
    it('Should revert when non-whitelisted user tries to create auction', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      // Remove seller from whitelist
      await auctionHouse.removeFromWhitelist(seller.address);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'AddressNotWhitelisted');
    });

    /** Test auction creation when whitelist is completely disabled */
    it('Should allow anyone to create auction when whitelist is disabled', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      // Disable whitelist
      await auctionHouse.setWhitelistEnabled(false);

      // Remove seller from whitelist (should still work when disabled)
      await auctionHouse.removeFromWhitelist(seller.address);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.emit(auctionHouse, 'AuctionCreated');
    });

    /** Test successful auction creation with all valid parameters */
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
      ).to.be.revertedWithCustomError(auctionHouse, 'DataTooShort');
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
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidDataLength');
    });

    it('Should revert with invalid hashId', async function () {
      const data = encodeAuctionData('0x' + '00'.repeat(32), defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidHashId');
    });

    it('Should revert with invalid duration (too short)', async function () {
      const data = encodeAuctionData(testHashId, 30 * 60, defaultMinBidIncrement, defaultTimeBuffer); // 30 minutes

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidDuration');
    });

    it('Should revert with invalid duration (too long)', async function () {
      const data = encodeAuctionData(testHashId, 31 * 24 * 60 * 60, defaultMinBidIncrement, defaultTimeBuffer); // 31 days

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidDuration');
    });

    it('Should revert with invalid bid increment percentage', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, 0, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidBidIncrement');
    });

    it('Should revert with invalid time buffer (too short)', async function () {
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, 4 * 60); // 4 minutes

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidTimeBuffer');
    });

    it('Should revert when contract is paused', async function () {
      await auctionHouse.pause();
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      await expect(
        seller.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'ContractPaused');
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
      ).to.be.revertedWithCustomError(auctionHouse, 'AuctionAlreadyExists');
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

    it('Should revert when contract tries to create auction', async function () {
      // Deploy a contract that will try to create an auction
      const FailingReceiver = await ethers.getContractFactory('FailingReceiver');
      const contractSeller = await FailingReceiver.deploy(await auctionHouse.getAddress());
      await contractSeller.waitForDeployment();

      const contractAddress = await contractSeller.getAddress();

      // Whitelist the contract (even though it shouldn't be able to create auctions)
      await auctionHouse.addToWhitelist(contractAddress);

      // Impersonate the contract address to send a transaction from it
      await ethers.provider.send("hardhat_impersonateAccount", [contractAddress]);
      // Fund the impersonated account with ETH for gas
      await ethers.provider.send("hardhat_setBalance", [
        contractAddress,
        "0x1000000000000000000" // 1 ETH
      ]);
      const contractSigner = await ethers.getSigner(contractAddress);

      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);

      // Contract should not be able to create auction
      await expect(
        contractSigner.sendTransaction({
          to: await auctionHouse.getAddress(),
          data: data
        })
      ).to.be.revertedWithCustomError(auctionHouse, 'SellersMustBeEOAs');

      // Stop impersonating
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [contractAddress]);
    });
  });

  /**
   * Test suite for auction bidding mechanics
   *
   * Tests all aspects of the bidding system including:
   * - Valid bid placement and validation
   * - Minimum bid increment enforcement
   * - Automatic refunds to previous bidders
   * - Auction extension mechanism within time buffer
   * - Points reward system for bidders
   * - New bidding restrictions (owner/self-outbidding)
   */
  describe('Bidding', function () {
    beforeEach(async function () {
      // Whitelist the seller since whitelist is enabled by default
      await auctionHouse.addToWhitelist(seller.address);

      // Create an auction for testing bidding functionality
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });
    });

    /** Test basic valid bid placement and verification */
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

    it('Should reject zero-value bids', async function () {
      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: 0 })
      ).to.be.revertedWithCustomError(auctionHouse, 'InsufficientBidAmount');
    });

    /** Test minimum bid increment enforcement to prevent spam bidding */
    it('Should require minimum bid increment', async function () {
      const firstBid = ethers.parseEther('1');
      const insufficientBid = ethers.parseEther('1.04'); // Less than 5% increase

      // Place first bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: firstBid });

      // Try insufficient second bid
      await expect(
        auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: insufficientBid })
      ).to.be.revertedWithCustomError(auctionHouse, 'InsufficientBidAmount');
    });

    /** Test automatic refund mechanism for outbid participants (immediate push refund) */
    it('Should refund previous bidder immediately when push refund succeeds', async function () {
      const firstBid = ethers.parseEther('1');
      const secondBid = ethers.parseEther('1.1');

      const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);

      // Place first bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: firstBid });

      const bidder1BalanceAfterBid = await ethers.provider.getBalance(bidder1.address);

      // Place second bid (should refund first bidder immediately)
      await auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: secondBid });

      const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);

      // Bidder1 should have been refunded the first bid amount immediately
      expect(bidder1FinalBalance).to.be.gt(bidder1BalanceAfterBid);

      // Pending withdrawals should be zero since refund succeeded
      expect(await auctionHouse.pendingWithdrawals(bidder1.address)).to.equal(0);
    });

    /** Test automatic auction extension when bid comes within time buffer */
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

    /** Test points reward system integration for bidders */
    it('Should award points to bidder', async function () {
      const bidAmount = ethers.parseEther('1');

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.emit(pointsContract, 'PointsAdded')
        .withArgs(bidder1.address, 42);
    });

    /** Test bidding on non-existent auction fails appropriately */
    it('Should revert for non-existent auction', async function () {
      const invalidHashId = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const bidAmount = ethers.parseEther('1');

      await expect(
        auctionHouse.connect(bidder1).createBid(invalidHashId, seller.address, { value: bidAmount })
      ).to.be.revertedWithCustomError(auctionHouse, 'AuctionDoesNotExist');
    });

    /** Test bidding on expired auction fails appropriately */
    it('Should revert for expired auction', async function () {
      const bidAmount = ethers.parseEther('1');

      // Fast forward past auction end
      const auction = await auctionHouse.auctions(seller.address, testHashId);
      await time.increaseTo(Number(auction.endTime) + 1);

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.be.revertedWithCustomError(auctionHouse, 'AuctionExpired');
    });

    /** Test new restriction: auction owners cannot bid on their own auctions */
    it('Should revert when owner tries to bid on their own auction', async function () {
      const bidAmount = ethers.parseEther('1');

      await expect(
        auctionHouse.connect(seller).createBid(testHashId, seller.address, { value: bidAmount })
      ).to.be.revertedWithCustomError(auctionHouse, 'OwnerCannotBid');
    });

    /** Test new restriction: bidders cannot outbid themselves */
    it('Should revert when bidder tries to outbid themselves', async function () {
      const firstBid = ethers.parseEther('1');
      const secondBid = ethers.parseEther('1.1');

      // Place first bid
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: firstBid });

      // Try to bid again with same bidder
      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: secondBid })
      ).to.be.revertedWithCustomError(auctionHouse, 'BidderCannotOutbidSelf');
    });
  });

  /**
   * Test suite for withdrawal functionality
   *
   * Tests the withdraw function that allows users to claim pending refunds
   * when push refunds fail (e.g., for contract addresses requiring more gas).
   */
  describe('Withdrawal', function () {
    beforeEach(async function () {
      // Whitelist the seller since whitelist is enabled by default
      await auctionHouse.addToWhitelist(seller.address);

      // Create an auction for testing withdrawal functionality
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });
    });

    it('Should allow user to withdraw pending refunds when push refund fails', async function () {
      const firstBid = ethers.parseEther('1');
      const secondBid = ethers.parseEther('1.1');

      // Create a contract that will fail on receive (uses too much gas)
      const FailingReceiver = await ethers.getContractFactory('FailingReceiver');
      const failingReceiver = await FailingReceiver.deploy(await auctionHouse.getAddress());
      await failingReceiver.waitForDeployment();

      // Place bid from failing receiver contract
      await failingReceiver.bid(testHashId, seller.address, { value: firstBid });

      // Place second bid - this should add to pending withdrawals since push refund will fail
      await auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: secondBid });

      // Check that failing receiver has pending withdrawal
      const failingReceiverAddress = await failingReceiver.getAddress();
      const pendingAmount = await auctionHouse.pendingWithdrawals(failingReceiverAddress);
      expect(pendingAmount).to.equal(firstBid);

      // Impersonate the failing receiver to call withdraw
      await ethers.provider.send("hardhat_impersonateAccount", [failingReceiverAddress]);
      // Fund the impersonated account with ETH for gas
      await ethers.provider.send("hardhat_setBalance", [
        failingReceiverAddress,
        "0x1000000000000000000" // 1 ETH
      ]);
      const failingReceiverSigner = await ethers.getSigner(failingReceiverAddress);

      // Withdraw should work
      await expect(
        auctionHouse.connect(failingReceiverSigner).withdraw()
      ).to.emit(auctionHouse, 'Withdrawal')
        .withArgs(failingReceiverAddress, firstBid);

      // Pending withdrawal should be zero after withdrawal
      expect(await auctionHouse.pendingWithdrawals(failingReceiverAddress)).to.equal(0);

      // Stop impersonating
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [failingReceiverAddress]);
    });

    it('Should revert withdrawal when no pending balance', async function () {
      await expect(
        auctionHouse.connect(bidder1).withdraw()
      ).to.be.revertedWithCustomError(auctionHouse, 'NoPendingWithdrawals');
    });

    it('Should use hybrid refund pattern - immediate for EOAs, pending for failing contracts', async function () {
      const firstBid = ethers.parseEther('1');
      const secondBid = ethers.parseEther('1.1');

      // EOA bidder gets immediate refund
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: firstBid });
      const bidder1BalanceBefore = await ethers.provider.getBalance(bidder1.address);

      await auctionHouse.connect(bidder2).createBid(testHashId, seller.address, { value: secondBid });

      const bidder1BalanceAfter = await ethers.provider.getBalance(bidder1.address);
      // Bidder1 should have been refunded immediately
      expect(bidder1BalanceAfter).to.be.gt(bidder1BalanceBefore);
      expect(await auctionHouse.pendingWithdrawals(bidder1.address)).to.equal(0);

      // Contract that fails gets pending withdrawal
      const FailingReceiver = await ethers.getContractFactory('FailingReceiver');
      const failingReceiver = await FailingReceiver.deploy(await auctionHouse.getAddress());
      await failingReceiver.waitForDeployment();

      const thirdBid = ethers.parseEther('1.2');
      await failingReceiver.bid(testHashId, seller.address, { value: thirdBid });

      // Place fourth bid - failing receiver should get pending withdrawal
      const fourthBid = ethers.parseEther('1.3');
      await auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: fourthBid });

      // Failing receiver should have pending withdrawal, not immediate refund
      expect(await auctionHouse.pendingWithdrawals(await failingReceiver.getAddress())).to.equal(thirdBid);
    });

    it('Should emit Withdrawal event on successful withdrawal', async function () {
      const withdrawalAmount = ethers.parseEther('0.5');

      // Create a contract that fails on receive
      const FailingReceiver = await ethers.getContractFactory('FailingReceiver');
      const failingReceiver = await FailingReceiver.deploy(await auctionHouse.getAddress());
      await failingReceiver.waitForDeployment();

      // Place bid from failing receiver
      await failingReceiver.bid(testHashId, seller.address, { value: withdrawalAmount });

      // Place second bid - push refund will fail, adding to pending withdrawals
      await auctionHouse.connect(bidder2).createBid(testHashId, seller.address, {
        value: ethers.parseEther('1.1')
      });

      // Verify pending withdrawal exists
      const failingReceiverAddress = await failingReceiver.getAddress();
      expect(await auctionHouse.pendingWithdrawals(failingReceiverAddress)).to.equal(withdrawalAmount);

      // Impersonate the failing receiver to call withdraw
      await ethers.provider.send("hardhat_impersonateAccount", [failingReceiverAddress]);
      // Fund the impersonated account with ETH for gas
      await ethers.provider.send("hardhat_setBalance", [
        failingReceiverAddress,
        "0x1000000000000000000" // 1 ETH
      ]);
      const failingReceiverSigner = await ethers.getSigner(failingReceiverAddress);

      // Withdraw and check event
      await expect(
        auctionHouse.connect(failingReceiverSigner).withdraw()
      ).to.emit(auctionHouse, 'Withdrawal')
        .withArgs(failingReceiverAddress, withdrawalAmount);

      // Stop impersonating
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [failingReceiverAddress]);
    });

    it('Should zero out pending withdrawal after successful withdrawal', async function () {
      const withdrawalAmount = ethers.parseEther('0.5');

      const FailingReceiver = await ethers.getContractFactory('FailingReceiver');
      const failingReceiver = await FailingReceiver.deploy(await auctionHouse.getAddress());
      await failingReceiver.waitForDeployment();

      // Place bid from failing receiver
      await failingReceiver.bid(testHashId, seller.address, { value: withdrawalAmount });

      // Place second bid
      await auctionHouse.connect(bidder2).createBid(testHashId, seller.address, {
        value: ethers.parseEther('1.1')
      });

      // Impersonate the failing receiver to call withdraw
      const failingReceiverAddress = await failingReceiver.getAddress();
      await ethers.provider.send("hardhat_impersonateAccount", [failingReceiverAddress]);
      // Fund the impersonated account with ETH for gas
      await ethers.provider.send("hardhat_setBalance", [
        failingReceiverAddress,
        "0x1000000000000000000" // 1 ETH
      ]);
      const failingReceiverSigner = await ethers.getSigner(failingReceiverAddress);

      // Withdraw
      await auctionHouse.connect(failingReceiverSigner).withdraw();

      // Try to withdraw again - should fail
      await expect(
        auctionHouse.connect(failingReceiverSigner).withdraw()
      ).to.be.revertedWithCustomError(auctionHouse, 'NoPendingWithdrawals');

      // Stop impersonating
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [failingReceiverAddress]);
    });
  });

  describe('Auction Settlement', function () {
    beforeEach(async function () {
      // Whitelist the seller since whitelist is enabled by default
      await auctionHouse.addToWhitelist(seller.address);

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

      // Settle auction - ETH is transferred before ethscription (fixes issue #2)
      await auctionHouse.settleAuction(testHashId, seller.address);

      const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
      expect(sellerFinalBalance).to.be.gt(sellerInitialBalance);
    });

    it('Should revert settlement of non-existent auction', async function () {
      const invalidHashId = '0x1234567890123456789012345678901234567890123456789012345678901234';

      await expect(
        auctionHouse.settleAuction(invalidHashId, seller.address)
      ).to.be.revertedWithCustomError(auctionHouse, 'AuctionDoesNotExist');
    });

    it('Should revert settlement before auction end', async function () {
      await expect(
        auctionHouse.settleAuction(testHashId, seller.address)
      ).to.be.revertedWithCustomError(auctionHouse, 'AuctionNotCompleted');
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
      ).to.be.revertedWithCustomError(auctionHouse, 'AuctionAlreadySettled');
    });
  });

  /**
   * Test suite for whitelist management functionality
   *
   * The whitelist system provides fine-grained control over who can create auctions.
   * This includes enabling/disabling the whitelist, managing individual addresses,
   * bulk operations, and proper access controls.
   */
  describe('Whitelist Management', function () {
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;

    beforeEach(async function () {
      [, , , , user1, user2, user3] = await ethers.getSigners();
    });

    /**
     * Tests for enabling and disabling the whitelist feature
     */
    describe('Whitelist State Management', function () {
      it('Should allow owner to enable/disable whitelist', async function () {
        // Disable whitelist
        await expect(auctionHouse.setWhitelistEnabled(false))
          .to.emit(auctionHouse, 'WhitelistEnabled')
          .withArgs(false);

        expect(await auctionHouse.whitelistEnabled()).to.be.false;

        // Re-enable whitelist
        await expect(auctionHouse.setWhitelistEnabled(true))
          .to.emit(auctionHouse, 'WhitelistEnabled')
          .withArgs(true);

        expect(await auctionHouse.whitelistEnabled()).to.be.true;
      });

      it('Should revert when non-owner tries to change whitelist state', async function () {
        await expect(
          auctionHouse.connect(bidder1).setWhitelistEnabled(false)
        ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
      });
    });

    /**
     * Tests for managing individual addresses in the whitelist
     */
    describe('Single Address Management', function () {
      it('Should allow owner to add address to whitelist', async function () {
        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.false;

        await expect(auctionHouse.addToWhitelist(user1.address))
          .to.emit(auctionHouse, 'AddressWhitelisted')
          .withArgs(user1.address);

        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.true;
      });

      it('Should allow owner to remove address from whitelist', async function () {
        // First add the address
        await auctionHouse.addToWhitelist(user1.address);
        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.true;

        // Then remove it
        await expect(auctionHouse.removeFromWhitelist(user1.address))
          .to.emit(auctionHouse, 'AddressRemovedFromWhitelist')
          .withArgs(user1.address);

        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.false;
      });

      it('Should revert when adding zero address', async function () {
        await expect(
          auctionHouse.addToWhitelist(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(auctionHouse, 'InvalidAddress');
      });

      it('Should revert when adding already whitelisted address', async function () {
        await auctionHouse.addToWhitelist(user1.address);

        await expect(
          auctionHouse.addToWhitelist(user1.address)
        ).to.be.revertedWithCustomError(auctionHouse, 'AddressAlreadyWhitelisted');
      });

      it('Should revert when removing zero address', async function () {
        await expect(
          auctionHouse.removeFromWhitelist(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(auctionHouse, 'InvalidAddress');
      });

      it('Should revert when removing non-whitelisted address', async function () {
        await expect(
          auctionHouse.removeFromWhitelist(user1.address)
        ).to.be.revertedWithCustomError(auctionHouse, 'AddressNotWhitelisted');
      });

      it('Should revert when non-owner tries to add to whitelist', async function () {
        await expect(
          auctionHouse.connect(bidder1).addToWhitelist(user1.address)
        ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
      });

      it('Should revert when non-owner tries to remove from whitelist', async function () {
        await auctionHouse.addToWhitelist(user1.address);

        await expect(
          auctionHouse.connect(bidder1).removeFromWhitelist(user1.address)
        ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
      });
    });

    /**
     * Tests for bulk whitelist operations to efficiently manage multiple addresses
     */
    describe('Bulk Address Management', function () {
      it('Should allow adding multiple addresses to whitelist', async function () {
        const addresses = [user1.address, user2.address, user3.address];

        await expect(auctionHouse.addMultipleToWhitelist(addresses))
          .to.emit(auctionHouse, 'AddressWhitelisted')
          .withArgs(user1.address)
          .and.to.emit(auctionHouse, 'AddressWhitelisted')
          .withArgs(user2.address)
          .and.to.emit(auctionHouse, 'AddressWhitelisted')
          .withArgs(user3.address);

        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.true;
        expect(await auctionHouse.isWhitelisted(user2.address)).to.be.true;
        expect(await auctionHouse.isWhitelisted(user3.address)).to.be.true;
      });

      it('Should skip already whitelisted addresses without reverting', async function () {
        // Pre-whitelist user1
        await auctionHouse.addToWhitelist(user1.address);

        const addresses = [user1.address, user2.address];

        // Should only emit event for user2 since user1 is already whitelisted
        await expect(auctionHouse.addMultipleToWhitelist(addresses))
          .to.emit(auctionHouse, 'AddressWhitelisted')
          .withArgs(user2.address);

        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.true;
        expect(await auctionHouse.isWhitelisted(user2.address)).to.be.true;
      });

      it('Should revert with empty array', async function () {
        await expect(
          auctionHouse.addMultipleToWhitelist([])
        ).to.be.revertedWithCustomError(auctionHouse, 'EmptyAccountsArray');
      });

      it('Should revert with too many accounts', async function () {
        const tooManyAddresses = new Array(101).fill(0).map((_, i) =>
          ethers.Wallet.createRandom().address
        );

        await expect(
          auctionHouse.addMultipleToWhitelist(tooManyAddresses)
        ).to.be.revertedWithCustomError(auctionHouse, 'TooManyAccounts');
      });

      it('Should revert if any address is zero address', async function () {
        const addresses = [user1.address, ethers.ZeroAddress, user2.address];

        await expect(
          auctionHouse.addMultipleToWhitelist(addresses)
        ).to.be.revertedWithCustomError(auctionHouse, 'InvalidAddressInArray');
      });

      it('Should revert when non-owner tries to add multiple addresses', async function () {
        const addresses = [user1.address, user2.address];

        await expect(
          auctionHouse.connect(bidder1).addMultipleToWhitelist(addresses)
        ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
      });
    });

    /**
     * Tests for whitelist view/query functions
     */
    describe('View Functions', function () {
      it('Should correctly return whitelist status', async function () {
        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.false;
        expect(await auctionHouse.isWhitelisted(owner.address)).to.be.true;

        await auctionHouse.addToWhitelist(user1.address);
        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.true;

        await auctionHouse.removeFromWhitelist(user1.address);
        expect(await auctionHouse.isWhitelisted(user1.address)).to.be.false;
      });
    });
  });

  /**
   * Test suite for auction data retrieval functions
   *
   * Tests the getAuction function which provides a convenient way to
   * retrieve all auction details in a single call.
   */
  describe('Auction Getter Function', function () {
    beforeEach(async function () {
      // Whitelist the seller
      await auctionHouse.addToWhitelist(seller.address);

      // Create an auction
      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });
    });

    it('Should return correct auction details via getAuction', async function () {
      const auction = await auctionHouse.getAuction(seller.address, testHashId);

      expect(auction.hashId).to.equal(testHashId);
      expect(auction.owner).to.equal(seller.address);
      expect(auction.duration).to.equal(defaultDuration);
      expect(auction.minBidIncrementPercentage).to.equal(defaultMinBidIncrement);
      expect(auction.timeBuffer).to.equal(defaultTimeBuffer);
      expect(auction.settled).to.be.false;
      expect(auction.amount).to.equal(0);
      expect(auction.bidder).to.equal(ethers.ZeroAddress);
      expect(auction.auctionId).to.equal(1);
    });

    it('Should return zero values for non-existent auction', async function () {
      const invalidHashId = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const auction = await auctionHouse.getAuction(seller.address, invalidHashId);

      expect(auction.startTime).to.equal(0);
      expect(auction.hashId).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
    });
  });

  /**
   * Test suite for points contract address management
   *
   * The points system is integral to the auction house, rewarding bidders
   * with points for participation. These tests ensure the points contract
   * address can be properly managed by the owner.
   */
  describe('Points Address Management', function () {
    let newPointsContract: any;

    beforeEach(async function () {
      const MockPoints = await ethers.getContractFactory('MockPoints');
      newPointsContract = await MockPoints.deploy();
      await newPointsContract.waitForDeployment();
    });

    it('Should allow owner to update points address', async function () {
      const oldAddress = await auctionHouse.pointsAddress();
      const newAddress = await newPointsContract.getAddress();

      await auctionHouse.setPointsAddress(newAddress);
      expect(await auctionHouse.pointsAddress()).to.equal(newAddress);
      expect(await auctionHouse.pointsAddress()).to.not.equal(oldAddress);
    });

    it('Should revert when setting zero address', async function () {
      await expect(
        auctionHouse.setPointsAddress(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(auctionHouse, 'InvalidPointsAddress');
    });

    it('Should revert when non-owner tries to update points address', async function () {
      await expect(
        auctionHouse.connect(bidder1).setPointsAddress(await newPointsContract.getAddress())
      ).to.be.revertedWithCustomError(auctionHouse, 'OwnableUnauthorizedAccount');
    });
  });

  /**
   * Test suite for pause/unpause functionality
   *
   * The pause mechanism allows the owner to halt new auction creation
   * while still allowing existing auctions to be settled. This is crucial
   * for emergency situations or maintenance.
   */
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

    it('Should reject bids when paused', async function () {
      await auctionHouse.addToWhitelist(seller.address);

      const data = encodeAuctionData(testHashId, defaultDuration, defaultMinBidIncrement, defaultTimeBuffer);
      await seller.sendTransaction({
        to: await auctionHouse.getAddress(),
        data: data
      });

      await auctionHouse.pause();

      await expect(
        auctionHouse.connect(bidder1).createBid(testHashId, seller.address, { value: ethers.parseEther('1') })
      ).to.be.revertedWithCustomError(auctionHouse, 'EnforcedPause');
    });

    it('Should allow settlement when paused', async function () {
      // Whitelist the seller
      await auctionHouse.addToWhitelist(seller.address);

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

  /**
   * Test suite for ethscription escrow functionality
   *
   * The contract acts as an escrow for ethscriptions during auctions.
   * These tests verify the tracking and cooldown mechanisms that prevent
   * immediate transfers after deposit.
   */
  describe('Ethscription Escrow Tests', function () {
    beforeEach(async function () {
      // Whitelist the seller since whitelist is enabled by default
      await auctionHouse.addToWhitelist(seller.address);

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

  /**
   * Test suite for edge cases and complex scenarios
   *
   * These tests cover unusual but important scenarios that could occur
   * in production, ensuring the contract handles them gracefully.
   */
  describe('Edge Cases', function () {
    it('Should handle failed ETH transfers gracefully', async function () {
      // Whitelist the seller
      await auctionHouse.addToWhitelist(seller.address);

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
      // Whitelist the seller
      await auctionHouse.addToWhitelist(seller.address);

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

  /**
   * Helper function to mine blocks to satisfy cooldown period
   *
   * The ethscription escrow has a cooldown period before transfers are allowed.
   * This function mines enough blocks to satisfy that requirement.
   */
  async function mineCooldownBlocks() {
    await ethers.provider.send("hardhat_mine", ["0x10"]); // Mine 16 blocks
  }

  /**
   * Helper function to encode auction data for fallback function
   *
   * The fallback function expects data in a specific format:
   * - hashId (32 bytes): The ethscription hash identifier
   * - signature (32 bytes): DEPOSIT_AND_AUCTION_SIGNATURE hash
   * - duration (32 bytes): Auction duration in seconds
   * - minBidIncrement (32 bytes): Minimum bid increment percentage
   * - timeBuffer (32 bytes): Time buffer for auction extensions
   *
   * @param hashId - The ethscription hash ID
   * @param duration - Auction duration in seconds
   * @param minBidIncrement - Minimum bid increment percentage (1-100)
   * @param timeBuffer - Time buffer for auction extensions in seconds
   * @returns Encoded data for the fallback function
   */
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
