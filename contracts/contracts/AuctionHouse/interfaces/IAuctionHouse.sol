// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.20;

interface IAuctionHouse {
    struct Auction {
        // ID for the inscription
        bytes32 hashId;
        // Owner of the Phunk
        address owner;
        // The current highest bid amount
        uint256 amount;
        // The time that the auction started
        uint256 startTime;
        // The time that the auction is scheduled to end
        uint256 endTime;
        // The address of the current highest bid
        address payable bidder;
        // Whether or not the auction has been settled
        bool settled;
        // Auction ID number
        uint256 auctionId;
        // Duration of this specific auction
        uint256 duration;
        // Minimum bid increment percentage
        uint8 minBidIncrementPercentage;
        // The minimum amount of time left in an auction after a new bid is created
        uint256 timeBuffer;
    }

    event AuctionCreated(bytes32 indexed hashId, address owner, uint256 auctionId, uint256 startTime, uint256 endTime);

    event AuctionBid(bytes32 indexed hashId, uint256 auctionId, address sender, uint256 value, bool extended);

    event AuctionExtended(bytes32 indexed hashId, uint256 auctionId, uint256 endTime);

    event AuctionSettled(bytes32 indexed hashId, uint256 auctionId, address winner, uint256 amount);

    event AddressWhitelisted(address indexed account);

    event AddressRemovedFromWhitelist(address indexed account);

    event WhitelistEnabled(bool enabled);

    event Withdrawal(address indexed account, uint256 amount);

    function settleAuction(bytes32 hashId, address owner) external;

    function createBid(bytes32 hashId, address owner) external payable;

    function pause() external;

    function unpause() external;

    function addToWhitelist(address account) external;

    function removeFromWhitelist(address account) external;

    function addMultipleToWhitelist(address[] calldata accounts) external;

    function isWhitelisted(address account) external view returns (bool);

    function setWhitelistEnabled(bool _whitelistEnabled) external;

    function setPointsAddress(address _pointsAddress) external;

    function getAuction(address owner, bytes32 hashId) external view returns (Auction memory);

    function withdraw() external;
}
