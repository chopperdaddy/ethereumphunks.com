// SPDX-License-Identifier: MIT License
pragma solidity 0.8.17;

import "./EthscriptionsEscrower.sol";
// import "solady/src/utils/ERC1967FactoryConstants.sol";
import "@solidstate/contracts/security/reentrancy_guard/ReentrancyGuard.sol";

contract EtherPhunksMarket is ReentrancyGuard, EthscriptionsEscrower {

    struct Offer {
        bool isForSale;
        bytes32 phunkId;
        address seller;
        uint minValue;
        address onlySellTo;
    }

    struct Bid {
        bool hasBid;
        bytes32 phunkId;
        address bidder;
        uint value;
    }

    // A record of phunks that are offered for sale at a specific minimum value, and perhaps to a specific person
    mapping(bytes32 => Offer) public phunksOfferedForSale;

    // A record of the highest phunk bid
    mapping(bytes32 => Bid) public phunkBids;

    // A record of pending ETH withdrawls by address
    mapping(address => uint) public pendingWithdrawals;

    event PhunkOffered(
        bytes32 indexed phunkId,
        uint minValue,
        address indexed toAddress
    );
    event PhunkBidEntered(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress
    );
    event PhunkBidWithdrawn(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress
    );
    event PhunkBought(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress,
        address indexed toAddress
    );
    event PhunkNoLongerForSale(bytes32 indexed phunkId);

    /* Allows the owner of a EtherPhunk to stop offering it for sale */
    function phunkNoLongerForSale(bytes32 phunkId) public nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            "Sender is not depositor"
        );

        _invalidateListing(phunkId);
    }

    /* Allows an EtherPhunk owner to offer it for sale */
    function offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) public nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            "Sender is not depositor"
        );

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            address(0x0)
        );
        emit PhunkOffered(phunkId, minSalePriceInWei, address(0x0));
    }

    /* Allows an EtherPhunk owner to offer it for sale to a specific address */
    function offerPhunkForSaleToAddress(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address toAddress
    ) public nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            "Sender is not depositor"
        );

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            toAddress
        );
        emit PhunkOffered(phunkId, minSalePriceInWei, toAddress);
    }

    /* Allows users to buy an EtherPhunk offered for sale */
    function buyPhunk(bytes32 phunkId) public payable nonReentrant {
        // Get the offer (listing)
        Offer memory offer = phunksOfferedForSale[phunkId];

        // Check that the offer is valid
        if (!offer.isForSale) revert("Phunk is not for sale");

        // Check if the offer is private
        if (offer.onlySellTo != address(0x0) && offer.onlySellTo != msg.sender)
            revert();

        // Check if correct price
        if (msg.value != offer.minValue) revert("Not enough ether");

        address seller = offer.seller;

        // Check if the seller is not the buyer
        if (seller == msg.sender) revert("Seller is buyer");

        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            msg.sender,
            0,
            address(0x0)
        );

        pendingWithdrawals[seller] += msg.value;

        // Transfer th ethscription
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(phunkId, msg.value, seller, msg.sender);

        // Check for the case where there is a bid from the new owner and refund it.
        // Any other bid can stay in place.
        Bid memory bid = phunkBids[phunkId];
        if (bid.bidder == msg.sender) {
            // Kill bid and refund value
            pendingWithdrawals[msg.sender] += bid.value;
            phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
        }
    }

    /* Allows users to enter bids for any EtherPhunk */
    function enterBidForPhunk(bytes32 phunkId) public payable nonReentrant {
        // if (phunksContract.ownerOf(phunkId) == msg.sender) revert("you already own this phunk");
        if (msg.value == 0) revert("cannot enter bid of zero");
        Bid memory existing = phunkBids[phunkId];
        if (msg.value <= existing.value) revert("your bid is too low");
        if (existing.value > 0) {
            // Refund the failing bid
            pendingWithdrawals[existing.bidder] += existing.value;
        }
        phunkBids[phunkId] = Bid(true, phunkId, msg.sender, msg.value);
        emit PhunkBidEntered(phunkId, msg.value, msg.sender);
    }

    /* Allows EtherPhunk owners to accept bids for their Phunks */
    function acceptBidForPhunk(
        bytes32 phunkId,
        uint minPrice
    ) public nonReentrant {

        address seller = msg.sender;

        require(
            !userEthscriptionDefinitelyNotStored(seller, phunkId),
            "Sender is not depositor"
        );

        Bid memory bid = phunkBids[phunkId];
        if (bid.value == 0) revert("cannot enter bid of zero");
        if (bid.value < minPrice) revert("your bid is too low");

        address bidder = bid.bidder;
        if (seller == bidder) revert("you already own this token");
        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            bidder,
            0,
            address(0x0)
        );

        uint amount = bid.value;
        pendingWithdrawals[seller] += amount;

        // Transfer the ethscription
        _transferEthscription(seller, bidder, phunkId);
        emit PhunkBought(phunkId, amount, seller, bidder);

        phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
    }

    /* Allows bidders to withdraw their bids */
    function withdrawBidForPhunk(bytes32 phunkId) public nonReentrant {
        Bid memory bid = phunkBids[phunkId];
        if (bid.bidder != msg.sender)
            revert("the bidder is not message sender");
        emit PhunkBidWithdrawn(phunkId, bid.value, msg.sender);
        uint amount = bid.value;
        phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);

        // Refund the bid money
        payable(msg.sender).transfer(amount);
    }

    /* Invalidate a listing by phunkId */
    function _invalidateListing(bytes32 phunkId) internal {
        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            msg.sender,
            0,
            address(0x0)
        );
        emit PhunkNoLongerForSale(phunkId);
    }

    /* Allows users to retrieve ETH from sales */
    function withdraw() public nonReentrant {
        if (pendingWithdrawals[msg.sender] == 0)
            revert("no pending withdrawals");
        uint amount = pendingWithdrawals[msg.sender];
        // Remember to zero the pending refund before
        // sending to prevent re-entrancy attacks
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    /* Allows EtherPhunk owners to withdraw their Phunks from escrow */
    function withdrawPhunk(bytes32 phunkId) public {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            "Sender is not depositor"
        );

        // Withdraw ethscription
        super.withdrawEthscription(phunkId);

        Offer memory offer = phunksOfferedForSale[phunkId];
        // Check that the offer is valid
        if (offer.isForSale) {
          // Invalidate listing
          _invalidateListing(phunkId);
        }
    }

    function withdrawBatchPhunks(bytes32[] memory phunkIds) public {
        for (uint i = 0; i < phunkIds.length; i++) {
            withdrawPhunk(phunkIds[i]);
        }
    }

    fallback() external {
        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }
}
