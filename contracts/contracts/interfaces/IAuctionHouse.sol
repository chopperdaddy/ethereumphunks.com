// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.20;

interface IAuctionHouse {
    struct Auction {
        // ID for the Phunk (ERC721 token ID)
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
    }

    event AuctionCreated(bytes32 indexed hashId, address owner, uint256 auctionId, uint256 startTime, uint256 endTime);

    event AuctionBid(bytes32 indexed hashId, uint256 auctionId, address sender, uint256 value, bool extended);

    event AuctionExtended(bytes32 indexed hashId, uint256 auctionId, uint256 endTime);

    event AuctionSettled(bytes32 indexed hashId, uint256 auctionId, address winner, uint256 amount);

    event AuctionTimeBufferUpdated(uint256 timeBuffer);

    event AuctionDurationUpdated(uint256 duration);

    event AuctionReservePriceUpdated(uint256 reservePrice);

    event AuctionMinBidIncrementPercentageUpdated(uint256 minBidIncrementPercentage);

    function createBid(bytes32 hashId, address owner) external payable;

    function pause() external;

    function unpause() external;

    function setTimeBuffer(uint256 timeBuffer) external;

    function setDuration(uint256 duration) external;

    function setMinBidIncrementPercentage(uint8 minBidIncrementPercentage) external;
}
