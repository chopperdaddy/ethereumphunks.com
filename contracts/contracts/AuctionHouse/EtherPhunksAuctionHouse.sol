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
    bytes32 constant DEPOSIT_AND_AUCTION_SIGNATURE = keccak256("DEPOSIT_AND_AUCTION_SIGNATURE");
    // Address of the Points contract
    address public pointsAddress;

    // The current auction ID
    uint256 public auctionId;

    mapping(address => mapping(bytes32 => IAuctionHouse.Auction)) public auctions;

    constructor(
        address _initialPointsAddress
    ) Ownable(msg.sender) {
        require(_initialPointsAddress != address(0), "Invalid points address");
        pointsAddress = _initialPointsAddress;
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
        IAuctionHouse.Auction memory _auction = auctions[owner][hashId];

        require(
            _auction.startTime == 0 ||
            block.timestamp >= _auction.endTime,
            "Auction already exists"
        );

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

        require(_auction.startTime != 0, "Auction does not exist");
        require(!_auction.settled, "Auction has already been settled");
        require(
            block.timestamp >= _auction.endTime,
            "Auction has not completed"
        );

        auctions[owner][hashId].settled = true;

        address dest = _auction.bidder == address(0)
            ? _auction.owner
            : _auction.bidder;

        _transferEthscription(_auction.owner, dest, _auction.hashId);

        if (_auction.amount > 0) {
            require(_safeTransferETH(_auction.owner, _auction.amount), "Failed to pay auction winner");
        }

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
    function createBid(bytes32 hashId, address owner) external payable override nonReentrant {
        IAuctionHouse.Auction storage _auction = auctions[owner][hashId];

        require(_auction.startTime != 0, "Auction does not exist");
        require(block.timestamp < _auction.endTime, "Auction expired");
        require(
            msg.value >=
                _auction.amount +
                    ((_auction.amount * _auction.minBidIncrementPercentage) / 100),
            "Must send more than last bid by minBidIncrementPercentage amount"
        );

        address payable lastBidder = _auction.bidder;

        // Refund the last bidder, if applicable
        if (lastBidder != address(0)) {
            require(_safeTransferETH(lastBidder, _auction.amount), "Failed to refund previous bidder");
        }

        // FIX: Update storage directly
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
        require(_pointsAddress != address(0), "Invalid points address");
        pointsAddress = _pointsAddress;
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
        require(!paused(), "Contract is paused");

        bytes32 signature;
        assembly {
            signature := calldataload(32)
        }

        if (signature == DEPOSIT_AND_AUCTION_SIGNATURE) {
            require(msg.data.length >= 160, "Data too short"); // At least 4 * 32 bytes needed
            require(msg.data.length % 32 == 0, "Invalid data length");

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
            require(hashId != bytes32(0), "Invalid hashId");
            require(duration >= 1 hours && duration <= 30 days, "Invalid duration");
            require(minBidIncrementPercentage > 0 && minBidIncrementPercentage <= 100, "Invalid bid increment");
            require(timeBuffer >= 5 minutes && timeBuffer <= 1 hours, "Invalid time buffer");

            // Create a new auction
            _createAuction(hashId, msg.sender, duration, minBidIncrementPercentage, timeBuffer);
            // Escrow the ethscription
            _onPotentialDeposit(msg.sender, hashId);
        }
    }
}
