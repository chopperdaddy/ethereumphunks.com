// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./interfaces/IAuctionHouse.sol";

/**
 * @title FailingReceiver
 * @dev A contract that fails when receiving ETH due to excessive gas consumption.
 * Used for testing the hybrid refund pattern in the auction house.
 */
contract FailingReceiver {
    IAuctionHouse public auctionHouse;
    // Storage variable to consume gas
    uint256[] private data;

    constructor(address _auctionHouse) {
        auctionHouse = IAuctionHouse(_auctionHouse);
    }

    /**
     * @dev Receive function that consumes more than 30,000 gas
     * This will cause push refunds to fail, triggering the fallback to pending withdrawals
     */
    receive() external payable {
        // Consume gas by writing to storage multiple times
        // This will exceed the 30,000 gas limit in _safeTransferETH
        for (uint256 i = 0; i < 100; i++) {
            data.push(i);
        }
    }

    /**
     * @dev Function to place bids on auctions
     * This allows the contract to participate in auctions
     */
    function bid(bytes32 hashId, address owner) external payable {
        auctionHouse.createBid{value: msg.value}(hashId, owner);
    }
}

contract ConstructingAuctionSeller {
    IAuctionHouse public auctionHouse;
    uint256[] private data;

    constructor(address _auctionHouse, bytes memory auctionData) {
        auctionHouse = IAuctionHouse(_auctionHouse);

        (bool success, ) = _auctionHouse.call(auctionData);
        require(success, "auction create failed");
    }

    receive() external payable {
        for (uint256 i = 0; i < 100; i++) {
            data.push(i);
        }
    }

    function withdraw() external {
        auctionHouse.withdraw();
    }
}
