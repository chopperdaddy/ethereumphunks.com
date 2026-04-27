// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IAuctionHouse.sol";
import "./interfaces/IPoints.sol";

import "./EthscriptionsEscrower.sol";

contract EtherPhunksAuctionHouse is
    IAuctionHouse,
    EthscriptionsEscrower,
    Pausable,
    ReentrancyGuard,
    Ownable
{
    // Custom errors
    error InvalidPointsAddress();
    error InvalidAddress();
    error InvalidAddressInArray();
    error AddressNotWhitelisted();
    error AddressAlreadyWhitelisted();
    error SellersMustBeEOAs();
    error AuctionAlreadyExists();
    error AuctionDoesNotExist();
    error AuctionExpired();
    error AuctionNotCompleted();
    error AuctionAlreadySettled();
    error InvalidHashId();
    error InvalidDuration();
    error InvalidBidIncrement();
    error InvalidTimeBuffer();
    error InvalidAuctionSignature();
    error DataTooShort();
    error InvalidDataLength();
    error InsufficientBidAmount();
    error OwnerCannotBid();
    error BidderCannotOutbidSelf();
    error FailedToPayAuctionWinner();
    error NoPendingWithdrawals();
    error FailedToSendEther();
    error EmptyAccountsArray();
    error TooManyAccounts();
    error ContractPaused();

    bytes32 constant DEPOSIT_AND_AUCTION_SIGNATURE = keccak256("DEPOSIT_AND_AUCTION_SIGNATURE");

    // Address of the Points contract
    address public pointsAddress;

    // The current auction ID
    uint256 public auctionId;

    // State of whitelist
    bool public whitelistEnabled;

    // Whitelist for addresses that can create auctions
    mapping(address => bool) public whitelistedAddresses;

    mapping(address => mapping(bytes32 => IAuctionHouse.Auction)) public auctions;

    // Pending withdrawals for outbid bidders (fallback when push refund fails)
    mapping(address => uint256) public pendingWithdrawals;

    constructor(
        address _initialPointsAddress
    ) Ownable(msg.sender) {
        if (_initialPointsAddress == address(0)) revert InvalidPointsAddress();
        pointsAddress = _initialPointsAddress;
        // Owner is automatically whitelisted
        whitelistedAddresses[msg.sender] = true;
        whitelistEnabled = true;
        emit AddressWhitelisted(msg.sender);
    }

    function _addPoints(address phunk, uint256 amount) internal {
        IPoints pointsContract = IPoints(pointsAddress);
        pointsContract.addPoints(phunk, amount);
    }

    /**
     * @notice Create an auction with custom duration.
     * @dev Store the auction details and emit an AuctionCreated event.
     */
    function _createAuction(
        bytes32 hashId,
        address owner,
        uint256 auctionDuration,
        uint8 minBidIncrementPercentage,
        uint256 timeBuffer
    ) internal {
        if (whitelistEnabled) {
            if (!whitelistedAddresses[owner]) revert AddressNotWhitelisted();
        }

        // Prevent contracts from creating auctions (sellers must be EOAs)
        if (owner.code.length != 0) revert SellersMustBeEOAs();

        IAuctionHouse.Auction memory _auction = auctions[owner][hashId];

        if (_auction.startTime != 0 && block.timestamp < _auction.endTime) {
            revert AuctionAlreadyExists();
        }

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + auctionDuration;

        auctionId++;

        auctions[owner][hashId] = IAuctionHouse.Auction({
            hashId: hashId,
            owner: owner,
            amount: 0,
            startTime: startTime,
            endTime: endTime,
            bidder: payable(0),
            settled: false,
            auctionId: auctionId,
            duration: auctionDuration,
            minBidIncrementPercentage: minBidIncrementPercentage,
            timeBuffer: timeBuffer
        });

        emit AuctionCreated(hashId, owner, auctionId, startTime, endTime);
    }

    /**
     * @notice Settle an auction, finalizing the bid and paying out to the owner.
     */
    function settleAuction(bytes32 hashId, address owner) external nonReentrant {
        _settleAuction(hashId, owner);
    }

    /**
     * @notice Settle an auction, finalizing the bid and paying out to the owner.
     * @dev If there are no bids, the Phunk is burned.
     */
    function _settleAuction(bytes32 hashId, address owner) internal {
        IAuctionHouse.Auction memory _auction = auctions[owner][hashId];

        if (_auction.startTime == 0) revert AuctionDoesNotExist();
        if (_auction.settled) revert AuctionAlreadySettled();
        if (block.timestamp < _auction.endTime) revert AuctionNotCompleted();

        auctions[owner][hashId].settled = true;

        address dest = _auction.bidder == address(0)
            ? _auction.owner
            : _auction.bidder;

        if (_auction.amount > 0) {
            if (!_safeTransferETH(_auction.owner, _auction.amount)) {
                pendingWithdrawals[_auction.owner] += _auction.amount;
            }
        }

        _transferEthscription(_auction.owner, dest, _auction.hashId);

        emit AuctionSettled(
            _auction.hashId,
            _auction.auctionId,
            _auction.bidder,
            _auction.amount
        );
    }

    /**
     * @notice Create a bid for a Phunk, with a given amount.
     * @dev This contract only accepts payment in ETH.
     */
    function createBid(bytes32 hashId, address owner) external payable override nonReentrant whenNotPaused {
        IAuctionHouse.Auction storage _auction = auctions[owner][hashId];

        if (_auction.startTime == 0) revert AuctionDoesNotExist();
        if (block.timestamp >= _auction.endTime) revert AuctionExpired();
        if (
            msg.value == 0 ||
            msg.value <
                _auction.amount +
                    ((_auction.amount * _auction.minBidIncrementPercentage) / 100)
        ) {
            revert InsufficientBidAmount();
        }
        if (msg.sender == owner) revert OwnerCannotBid();
        if (msg.sender == _auction.bidder) revert BidderCannotOutbidSelf();

        address payable lastBidder = _auction.bidder;
        uint256 lastBidAmount = _auction.amount;

        // Try to refund immediately, fallback to pending withdrawals if it fails
        if (lastBidder != address(0)) {
            bool refundSuccess = _safeTransferETH(lastBidder, lastBidAmount);
            if (!refundSuccess) {
                // If push refund fails, add to pending withdrawals
                pendingWithdrawals[lastBidder] += lastBidAmount;
            }
        }

        // Update storage directly
        _auction.amount = msg.value;
        _auction.bidder = payable(msg.sender);

        // Extend the auction if the bid was received within `timeBuffer` of the auction end time
        bool extended = _auction.endTime - block.timestamp < _auction.timeBuffer;
        if (extended) {
            _auction.endTime = block.timestamp + _auction.timeBuffer;
        }

        emit AuctionBid(
            _auction.hashId,
            _auction.auctionId,
            msg.sender,
            msg.value,
            extended
        );

        _addPoints(msg.sender, 42);

        if (extended) {
            emit AuctionExtended(
                _auction.hashId,
                _auction.auctionId,
                _auction.endTime
            );
        }
    }

    /**
     * @notice Transfer ETH and return the success status.
     * @dev This function only forwards 30,000 gas to the callee.
     */
    function _safeTransferETH(
        address to,
        uint256 amount
    ) internal returns (bool) {
        (bool success, ) = to.call{value: amount, gas: 30_000}(new bytes(0));
        return success;
    }

    /**
     * @notice Withdraw pending refunds.
     * @dev Allows users to withdraw their pending refunds when push refund failed.
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoPendingWithdrawals();

        // Zero out the pending withdrawal before transfer
        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert FailedToSendEther();

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Pause the Phunks auction house.
     * @dev This function can only be called by the owner when the
     * contract is unpaused. While no new auctions can be started when paused,
     * anyone can settle an ongoing auction.
     */
    function pause() external override onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the Phunks auction house.
     * @dev This function can only be called by the owner when the
     * contract is paused. If required, this function will start a new auction.
     */
    function unpause() external override onlyOwner {
        _unpause();
    }

    /**
     * @notice Get auction details
     * @dev This function returns the auction details for a given owner and hashId
     */
    function getAuction(address owner, bytes32 hashId) external view returns (IAuctionHouse.Auction memory) {
        return auctions[owner][hashId];
    }

    /**
     * @notice Set the points address.
     * @dev This function can only be called by the owner.
     */
    function setPointsAddress(address _pointsAddress) external onlyOwner {
        if (_pointsAddress == address(0)) revert InvalidPointsAddress();
        pointsAddress = _pointsAddress;
    }

    /**
     * @notice Set the whitelist enabled.
     * @dev This function can only be called by the owner.
     */
    function setWhitelistEnabled(bool _whitelistEnabled) external onlyOwner {
        whitelistEnabled = _whitelistEnabled;
        emit WhitelistEnabled(_whitelistEnabled);
    }

    /**
     * @notice Add an address to the whitelist.
     * @dev This function can only be called by the owner.
     */
    function addToWhitelist(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (whitelistedAddresses[account]) revert AddressAlreadyWhitelisted();

        whitelistedAddresses[account] = true;
        emit AddressWhitelisted(account);
    }

    /**
     * @notice Remove an address from the whitelist.
     * @dev This function can only be called by the owner.
     */
    function removeFromWhitelist(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (!whitelistedAddresses[account]) revert AddressNotWhitelisted();

        whitelistedAddresses[account] = false;
        emit AddressRemovedFromWhitelist(account);
    }

    /**
     * @notice Add multiple addresses to the whitelist.
     * @dev This function can only be called by the owner.
     */
    function addMultipleToWhitelist(address[] calldata accounts) external onlyOwner {
        if (accounts.length == 0) revert EmptyAccountsArray();
        if (accounts.length > 100) revert TooManyAccounts(); // Gas limit protection

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            if (account == address(0)) revert InvalidAddressInArray();

            if (!whitelistedAddresses[account]) {
                whitelistedAddresses[account] = true;
                emit AddressWhitelisted(account);
            }
        }
    }

    /**
     * @notice Check if an address is whitelisted.
     * @dev This is a view function that returns the whitelist status.
     */
    function isWhitelisted(address account) external view returns (bool) {
        return whitelistedAddresses[account];
    }

    /**
     * @notice Replacement escrower function that takes bytes32 rather than calldata (bytes)
     */
    function _onPotentialDeposit(
      address previousOwner,
      bytes32 hashId
    ) internal {
        if (hashId == bytes32(0)) revert InvalidEthscriptionLength();

        if (
            userEthscriptionPossiblyStored(previousOwner, hashId)
        ) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][hashId] = block.number;
    }

    fallback() external {
        if (paused()) revert ContractPaused();

        bytes32 signature;
        assembly {
            signature := calldataload(32)
        }

        if (signature != DEPOSIT_AND_AUCTION_SIGNATURE) {
            revert InvalidAuctionSignature();
        }

        if (msg.data.length < 160) revert DataTooShort(); // At least 4 * 32 bytes needed
        if (msg.data.length % 32 != 0) revert InvalidDataLength();

        bytes32 hashId;
        uint256 duration;
        uint8 minBidIncrementPercentage;
        uint256 timeBuffer;

        assembly {
            hashId := calldataload(0)
            duration := calldataload(64)
            minBidIncrementPercentage := calldataload(96)
            timeBuffer := calldataload(128)
        }

        // Validate parameters
        if (hashId == bytes32(0)) revert InvalidHashId();
        if (duration < 1 hours || duration > 30 days) revert InvalidDuration();
        if (minBidIncrementPercentage == 0 || minBidIncrementPercentage > 100) revert InvalidBidIncrement();
        if (timeBuffer < 5 minutes || timeBuffer > 1 hours) revert InvalidTimeBuffer();

        // Create a new auction
        _createAuction(hashId, msg.sender, duration, minBidIncrementPercentage, timeBuffer);
        // Escrow the ethscription
        _onPotentialDeposit(msg.sender, hashId);
    }
}
