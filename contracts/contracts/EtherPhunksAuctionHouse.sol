// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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
    // The active auction
    IAuctionHouse.Auction public auction;

    // Address of the Points contract
    address public pointsAddress;

    // Merkle root of the EtherPhunks hashIds
    bytes32 public merkleRoot;
    // The minimum amount of time left in an auction after a new bid is created
    uint256 public timeBuffer;
    // The minimum percentage difference between the last bid amount and the current bid
    uint8 public minBidIncrementPercentage;
    // The duration of a single auction
    uint256 public duration;
    // The curren auction ID number
    uint256 public auctionId = 0;
    // The Treasury wallet
    address payable public treasuryWallet;

    mapping(address => mapping(bytes32 => Auction)) public auctions;

    constructor(
        address _initialPointsAddress,
        address payable _treasuryWallet,
        bytes32 _merkleRoot,
        uint256 _timeBuffer,
        uint8 _minBidIncrementPercentage,
        uint256 _duration
    ) Ownable(msg.sender) {
        treasuryWallet = _treasuryWallet;
        merkleRoot = _merkleRoot;
        timeBuffer = _timeBuffer;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        duration = _duration;
        pointsAddress = _initialPointsAddress;
    }

    function _addPoints(address phunk, uint256 amount) internal {
        IPoints pointsContract = IPoints(pointsAddress);
        pointsContract.addPoints(phunk, amount);
    }

    /**
     * @notice Create an auction.
     * @dev Store the auction details in the `auction` state variable and emit an AuctionCreated event.
     * If the mint reverts, the minter was updated without pausing this contract first. To remedy this,
     * catch the revert and pause this contract.
     */
    function _createAuction(bytes32 hashId, address owner) internal {
        IAuctionHouse.Auction memory _auction = auctions[owner][hashId];

        require(
            _auction.startTime == 0 ||
            block.timestamp >= auction.endTime,
            "Auction already exists"
        );

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        auctionId++;

        auctions[owner][hashId] = Auction({
            hashId: hashId,
            owner: owner,
            amount: 0,
            startTime: startTime,
            endTime: endTime,
            bidder: payable(0),
            settled: false,
            auctionId: auctionId
        });

        emit AuctionCreated(hashId, owner, auctionId, startTime, endTime);
    }

    /**
     * @notice Settle an auction, finalizing the bid and paying out to the owner.
     * @dev If there are no bids, the Phunk is burned.
     */
    function _settleAuction(bytes32 hashId, address owner) internal {
        IAuctionHouse.Auction memory _auction = auctions[owner][hashId];

        require(_auction.startTime != 0, "Auction hasn't begun");
        require(!_auction.settled, "Auction has already been settled");
        require(
            block.timestamp >= _auction.endTime,
            "Auction hasn't completed"
        );

        auction.settled = true;

        address dest = _auction.bidder == address(0)
            ? _auction.owner
            : _auction.bidder;

        _transferEthscription(_auction.owner, dest, _auction.hashId);

        if (_auction.amount > 0) {
            _safeTransferETHWithFallback(treasuryWallet, _auction.amount);
        }

        emit AuctionSettled(
            _auction.hashId,
            auctionId,
            _auction.bidder,
            _auction.amount
        );
    }

    /**
     * @notice Create a bid for a Phunk, with a given amount.
     * @dev This contract only accepts payment in ETH.
     */
    function createBid(bytes32 hashId, address owner) external payable override nonReentrant {
        IAuctionHouse.Auction memory _auction = auctions[owner][hashId];

        require(block.timestamp < _auction.endTime, "Auction expired");
        require(
            msg.value >=
                _auction.amount +
                    ((_auction.amount * minBidIncrementPercentage) / 100),
            "Must send more than last bid by minBidIncrementPercentage amount"
        );

        address payable lastBidder = _auction.bidder;

        // Refund the last bidder, if applicable
        if (lastBidder != address(0)) {
            _safeTransferETHWithFallback(lastBidder, _auction.amount);
        }

        auction.amount = msg.value;
        auction.bidder = payable(msg.sender);

        // Extend the auction if the bid was received within `timeBuffer` of the auction end time
        bool extended = _auction.endTime - block.timestamp < timeBuffer;
        if (extended) {
            auction.endTime = _auction.endTime = block.timestamp + timeBuffer;
        }

        emit AuctionBid(
            _auction.hashId,
            auctionId,
            msg.sender,
            msg.value,
            extended
        );

        _addPoints(msg.sender, 42);

        if (extended) {
            emit AuctionExtended(_auction.hashId, auctionId, _auction.endTime);
        }
    }

    /**
     * @notice Set the treausury wallet address.
     * @dev Only callable by the owner.
     */
    function setTreasuryWallet(address payable _treasuryWallet) public onlyOwner {
        treasuryWallet = _treasuryWallet;
    }

    /**
     * @notice Set the duration of an auction
     * @dev Only callable by the owner.
     */
    function setDuration(uint256 _duration) external override onlyOwner {
        duration = _duration;
        emit AuctionDurationUpdated(_duration);
    }

    /**
     * @notice Set the auction time buffer.
     * @dev Only callable by the owner.
     */
    function setTimeBuffer(uint256 _timeBuffer) external override onlyOwner {
        timeBuffer = _timeBuffer;
        emit AuctionTimeBufferUpdated(_timeBuffer);
    }

    /**
     * @notice Set the auction minimum bid increment percentage.
     * @dev Only callable by the owner.
     */
    function setMinBidIncrementPercentage(
        uint8 _minBidIncrementPercentage
    ) external override onlyOwner {
        minBidIncrementPercentage = _minBidIncrementPercentage;
        emit AuctionMinBidIncrementPercentageUpdated(
            _minBidIncrementPercentage
        );
    }

    /**
     * @notice Transfer ETH. If the ETH transfer fails, wrap the ETH and try send it as WETH.
     */
    function _safeTransferETHWithFallback(address to, uint256 amount) internal {
        _safeTransferETH(to, amount);
        // if (!_safeTransferETH(to, amount)) {
        //     // IWETH(weth).deposit{ value: amount }();
        //     // IERC20(weth).transfer(to, amount);
        // }
    }

    /**
     * @notice Transfer ETH and return the success status.
     * @dev This function only forwards 30,000 gas to the callee.
     */
    function _safeTransferETH(
        address to,
        uint256 value
    ) internal returns (bool) {
        (bool success, ) = to.call{value: value, gas: 30_000}(new bytes(0));
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
     * @notice Replacement escrower function that takes bytes32 rather than calldata (bytes)
     */
    function _onPotentialPhunkDeposit(
      address previousOwner,
      bytes32 hashId
    ) internal {
        if (hashId.length != 32) revert InvalidEthscriptionLength();

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
        require(msg.data.length >= 64, "Data too short"); // At least 2 * 32 bytes needed
        require(msg.data.length % 32 == 0, "Invalid data length");

        // Extract the hashId (leaf)
        bytes32 hashId;
        assembly {
            hashId := calldataload(0)
        }

        // Extract the Merkle proof
        bytes32[] memory proof = new bytes32[]((msg.data.length - 32) / 32);
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement;
            assembly {
                proofElement := calldataload(add(32, mul(32, i)))
            }
            proof[i] = proofElement;
        }

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(hashId))));

        require(MerkleProof.verify(proof, merkleRoot, leaf), "MerkleDistributor: Invalid proof.");

        // Create a new auction
        _createAuction(hashId, msg.sender);
        // Escrow the ethscription
        _onPotentialPhunkDeposit(msg.sender, hashId);
    }
}
