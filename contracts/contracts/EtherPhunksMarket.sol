// SPDX-License-Identifier: PHUNKY

/**** EtherPhunksMarket.sol *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░████░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░██░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
****************************/

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";

import "./interfaces/IPoints.sol";
import "./EthscriptionsEscrower.sol";

contract EtherPhunksMarketV3 is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    MulticallUpgradeable,
    EthscriptionsEscrower
{
    uint256 public constant contractVersion = 1;
    address public pointsAddress;

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

    // A record of phunks that are offered for sale at a specific
    // minimum value, and perhaps to a specific person
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
    event PhunkNoLongerForSale(
      bytes32 indexed phunkId
    );

    function initialize(
        address _initialPointsAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        pointsAddress = _initialPointsAddress;
    }

    // Allows the owner of a EtherPhunk to stop offering it for sale
    function phunkNoLongerForSale(bytes32 phunkId) public nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            "Sender is not depositor"
        );

        _invalidateListing(phunkId);
    }

    // Allows an EtherPhunk owner to offer it for sale
    function offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) public nonReentrant {
        _offerPhunkForSale(phunkId, minSalePriceInWei);
    }

    // Allows an EtherPhunk owner to offer multiple for sale
    function batchOfferPhunkForSale(
        bytes32[] memory phunkIds,
        uint[] memory minSalePricesInWei
    ) public nonReentrant {
        require(
            phunkIds.length == minSalePricesInWei.length,
            "Array lengths do not match"
        );

        for (uint i = 0; i < phunkIds.length; i++) {
            _offerPhunkForSale(phunkIds[i], minSalePricesInWei[i]);
        }
    }

    // Allows an EtherPhunk owner to offer it for sale to a specific address
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

    // Allows users to buy an EtherPhunk offered for sale
    function _buyPhunk(
      bytes32 phunkId,
      uint minSalePriceInWei
    ) internal {
        // Get the offer (listing)
        Offer memory offer = phunksOfferedForSale[phunkId];

        // Check that the offer is valid
        if (!offer.isForSale) revert("Not for sale");
        // Check if the offer is private
        if (offer.onlySellTo != address(0x0) && offer.onlySellTo != msg.sender) revert();
        // Check if correct price
        if (minSalePriceInWei != offer.minValue) revert("Not enough ether");
        // Check if the seller is not the buyer
        if (offer.seller == msg.sender) revert("Seller is buyer");

        address seller = offer.seller;

        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            msg.sender,
            0,
            address(0x0)
        );

        pendingWithdrawals[seller] += minSalePriceInWei;

        // Add points to seller
        _addPoints(seller, 100);

        // Transfer ethscription
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(phunkId, minSalePriceInWei, seller, msg.sender);

        // Check for the case where there is a bid from the new owner and refund it.
        // Any other bid can stay in place.
        Bid memory bid = phunkBids[phunkId];
        if (bid.bidder == msg.sender) {
            // Kill bid and refund value
            pendingWithdrawals[msg.sender] += bid.value;
            phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
        }
    }

    function buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) public payable whenNotPaused nonReentrant {
        _buyPhunk(phunkId, minSalePriceInWei);
    }

    function batchBuyPhunk(
        bytes32[] memory phunkIds,
        uint[] memory minSalePricesInWei
    ) public payable whenNotPaused nonReentrant {
        require(phunkIds.length == minSalePricesInWei.length, "Array lengths do not match");

        uint totalSalePrice = 0;
        for (uint i = 0; i < phunkIds.length; i++) {
            _buyPhunk(phunkIds[i], minSalePricesInWei[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        // Ensure the total sent Ether matches the total sale price
        require(msg.value == totalSalePrice, "Incorrect total Ether sent");
    }

    // Allows users to enter bids for any EtherPhunk
    function enterBidForPhunk(bytes32 phunkId) public payable whenNotPaused nonReentrant {
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

    // Allows EtherPhunk owners to accept bids for their Phunks
    function acceptBidForPhunk(
        bytes32 phunkId,
        uint minPrice
    ) public whenNotPaused nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            "Sender is not depositor"
        );

        address seller = msg.sender;
        Bid memory bid = phunkBids[phunkId];

        // Gas efficient way to check if bid is valid
        require(bid.value != 0 && bid.value >= minPrice && seller != bid.bidder);
        // if (bid.value == 0) revert("cannot enter bid of zero");
        // if (bid.value < minPrice) revert("your bid is too low");
        // if (seller == bidder) revert("you already own this token");

        address bidder = bid.bidder;
        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            bidder,
            0,
            address(0x0)
        );

        uint amount = bid.value;
        pendingWithdrawals[seller] += amount;

        _addPoints(seller, 100);

        // Transfer the ethscription
        _transferEthscription(seller, bidder, phunkId);
        emit PhunkBought(phunkId, amount, seller, bidder);

        phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
    }

    // Allows bidders to withdraw their bids
    function withdrawBidForPhunk(bytes32 phunkId) public nonReentrant {
        Bid memory bid = phunkBids[phunkId];
        if (bid.bidder != msg.sender)
            revert("the bidder is not message sender");
        emit PhunkBidWithdrawn(phunkId, bid.value, msg.sender);
        uint amount = bid.value;
        phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);

        // Refund the bid moneys
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    // Allows users to retrieve ETH from sales
    function withdraw() public nonReentrant {
        if (pendingWithdrawals[msg.sender] == 0)
            revert("no pending withdrawals");
        uint amount = pendingWithdrawals[msg.sender];

        // Remember to zero the pending refund before
        // sending to prevent re-entrancy attacks
        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    // Allows EtherPhunk owners to withdraw their Phunks from escrow
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

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal virtual override {
        // Ensure calldata length is a multiple of 32 bytes (64 characters)
        require(userCalldata.length % 32 == 0, "InvalidEthscriptionLength");

        // Process each ethscriptionId
        for (uint256 i = 0; i < userCalldata.length / 32; i++) {
            bytes32 potentialEthscriptionId = abi.decode(slice(userCalldata, i * 32, 32), (bytes32));

            if (userEthscriptionPossiblyStored(previousOwner, potentialEthscriptionId)) {
                revert EthscriptionAlreadyReceivedFromSender();
            }

            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                previousOwner
            ][potentialEthscriptionId] = block.number;
        }
    }

    // This internal function does the actual work without reentrancy checks.
    function _offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
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

    // Invalidate a listing by phunkId
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

    function _addPoints(address phunk, uint256 amount) internal {
        IPoints pointsContract = IPoints(pointsAddress);
        pointsContract.addPoints(phunk, amount);
    }

    function setPointsAddress(address _newPointsAddress) public onlyOwner {
        pointsAddress = _newPointsAddress;
    }

    // Pause the contract
    function pause() public onlyOwner {
        _pause();
    }

    // Unpause the contract
    function unpause() public onlyOwner {
        _unpause();
    }

    // Helper function to slice bytes
    function slice(bytes memory data, uint256 start, uint256 len) internal pure returns (bytes memory) {
        bytes memory b = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            b[i] = data[i + start];
        }
        return b;
    }

    fallback() external {
        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }
}
