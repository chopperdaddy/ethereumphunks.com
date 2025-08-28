// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV2SepoliaUpgrade.sol *
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

/* ****************************************** */
/*   CHANGELOG:                               */
/* *************************************(V2_3) */
/* - Added V2 security-enhanced mapping       */
/* - Added V2 listing/buying functions        */
/* - Fixed withdrawal function compatibility  */
/* - Enhanced fallback to use V2 system       */
/* - Maintained storage layout compatibility  */
/* ****************************************** */

pragma solidity 0.8.20;

import "./EtherPhunksMarketV2SepoliaDowngrade.sol";

contract EtherPhunksMarketV2SepoliaUpgrade is EtherPhunksMarketV2SepoliaDowngrade {

    /**
     * @dev V2 Security-enhanced listing mapping: claimer => phunkId => Offer
     * Makes manipulation attempts visible where bad actors claim ownership of same ethscription.
     * Off-chain indexer consensus validates true ownership and filters malicious listings.
     * Runs in parallel with legacy phunksOfferedForSale for graceful transition.
     */
    mapping(address => mapping(bytes32 => Offer)) public phunksOfferedForSaleV2;

    /**
     * @dev Initializes the new version of the contract.
     * @param _newVersion The new version number.
     */
    function initializeV2SepoliaUpgrade(uint256 _newVersion) public reinitializer(3) {
        contractVersion = _newVersion;
    }

    /**
     * @dev Fixed withdraw function that only uses the main pendingWithdrawals mapping
     */
    function withdraw() public override nonReentrant {
        require(
            pendingWithdrawals[msg.sender] != 0,
            "No pending withdrawals"
        );

        uint amount = pendingWithdrawals[msg.sender];
        uint amountV2 = pendingWithdrawalsV2[msg.sender];
        pendingWithdrawals[msg.sender] = 0;
        pendingWithdrawalsV2[msg.sender] = 0;

        (bool sent,) = payable(msg.sender).call{value: amount + amountV2}("");
        require(sent, "Failed to send Ether");
    }

    /**
     * @dev Allows the owner of an item to offer it for sale using the V2 system.
     * @param phunkId The hashId of the item being offered for sale.
     * @param minSalePriceInWei The minimum sale price for the item, in Wei.
     */
    function offerPhunkForSaleV2(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) external nonReentrant {
        _offerPhunkForSaleV2(phunkId, minSalePriceInWei);
    }

    /**
     * @dev Allows batch offering of multiple items for sale using the V2 system.
     * @param phunkIds An array of item hashIds to be offered for sale.
     * @param minSalePricesInWei An array of minimum sale prices (in Wei) for each item.
     */
    function batchOfferPhunkForSaleV2(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external nonReentrant {
        require(
            phunkIds.length == minSalePricesInWei.length,
            "Lengths mismatch"
        );
        for (uint i = 0; i < phunkIds.length; i++) {
             _offerPhunkForSaleV2(phunkIds[i], minSalePricesInWei[i]);
        }
    }

    /**
     * @dev Offers a Phunk for sale to a specific address using the V2 system.
     * @param phunkId The hashId of the Phunk being offered for sale.
     * @param minSalePriceInWei The minimum sale price for the Phunk in Wei.
     * @param toAddress The address to which the Phunk will be sold.
     */
    function offerPhunkForSaleToAddressV2(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address toAddress
    ) public nonReentrant {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSaleV2[msg.sender][phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            toAddress,
            0 // revSharePercentage set to 0 for compatibility
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, toAddress);
    }

    /**
     * @dev Internal function to offer an item for sale using the V2 system.
     * @param phunkId The hashId of the item being offered for sale.
     * @param minSalePriceInWei The minimum sale price for the item in Wei.
     */
    function _offerPhunkForSaleV2(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSaleV2[msg.sender][phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            address(0x0),
            0 // revSharePercentage set to 0 for compatibility
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, address(0x0));
    }

    /**
     * @dev Marks an item as no longer for sale using the V2 system.
     * @param phunkId The hashId of the item to mark as not for sale.
     */
    function phunkNoLongerForSaleV2(bytes32 phunkId) external {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        _invalidateListingV2(msg.sender, phunkId);
        emit PhunkNoLongerForSale(phunkId);
    }

    /**
     * @dev Buy a phunk from a specific owner using the V2 system.
     * @param owner The address of the owner selling the phunk.
     * @param phunkId The hashId of the item to buy.
     * @param minSalePriceInWei The minimum sale price in Wei.
     */
    function buyPhunkV2(
        address owner,
        bytes32 phunkId,
        uint minSalePriceInWei
    ) external payable whenNotPaused nonReentrant {
        _buyPhunkV2(owner, phunkId, minSalePriceInWei);
        require(msg.value == minSalePriceInWei, "Incorrect Ether amount");
    }

    /**
     * @dev Allows batch purchase of items from specific owners using V2 system.
     * @param owners Array of owner addresses.
     * @param phunkIds Array of item hashIds to be purchased.
     * @param minSalePricesInWei Array of minimum sale prices (in Wei) for each item.
     */
    function batchBuyPhunksV2(
        address[] calldata owners,
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external payable whenNotPaused nonReentrant {
        require(
            owners.length == phunkIds.length &&
            phunkIds.length == minSalePricesInWei.length,
            "Lengths mismatch"
        );

        uint totalSalePrice = 0;
        for (uint i = 0; i < phunkIds.length; i++) {
            _buyPhunkV2(owners[i], phunkIds[i], minSalePricesInWei[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        require(msg.value == totalSalePrice, "Incorrect Ether amount");
    }

    /**
     * @dev Internal function to buy an item from a specific owner using V2 system.
     * @param owner The address of the owner selling the phunk.
     * @param phunkId The hashId of the item to buy.
     * @param minSalePriceInWei The minimum sale price in Wei.
     */
    function _buyPhunkV2(
        address owner,
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        Offer memory offer = phunksOfferedForSaleV2[owner][phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender &&
            offer.seller == owner, // Ensure consistency
            "Invalid sale conditions"
        );

        uint sellerAmount = minSalePriceInWei;

        _invalidateListingV2(owner, phunkId);

        pendingWithdrawals[owner] += sellerAmount;

        _addPoints(owner, 100);
        _transferEthscription(owner, msg.sender, phunkId);

        emit PhunkBought(
            phunkId,
            minSalePriceInWei,
            owner,
            msg.sender
        );
    }

    /**
     * @dev Allows a user to withdraw their item with V2 system cleanup.
     * @param phunkId The hashId of the item to be withdrawn.
     */
    function withdrawPhunkV2(bytes32 phunkId) public {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        super.withdrawEthscription(phunkId);

        Offer memory offer = phunksOfferedForSaleV2[msg.sender][phunkId];
        if (offer.isForSale) {
            _invalidateListingV2(msg.sender, phunkId);
            emit PhunkNoLongerForSale(phunkId);
        }
    }

    /**
     * @dev Withdraws multiple items from the market using V2 system.
     * @param phunkIds The array of item hashIds to be withdrawn.
     */
    function withdrawBatchPhunksV2(bytes32[] calldata phunkIds) external {
        for (uint i = 0; i < phunkIds.length; i++) {
            withdrawPhunkV2(phunkIds[i]);
        }
    }

    /**
     * @dev Invalidates a V2 listing for a specific owner and phunk ID.
     * @param owner The owner address.
     * @param phunkId The hashId of the item to invalidate the listing for.
     */
    function _invalidateListingV2(address owner, bytes32 phunkId) internal {
        delete phunksOfferedForSaleV2[owner][phunkId];
    }

    /**
     * @dev Enhanced fallback to handle deposit and list with V2 system
     */
    fallback() external override {
        require(!paused(), "Contract is paused");

        bytes32 signature;
        assembly {
            signature := calldataload(32)
        }

        if (signature == DEPOSIT_AND_LIST_SIGNATURE) {
            require(msg.data.length % 32 == 0, "InvalidEthscriptionLength");

            bytes32 phunkId;
            bytes32 listingPrice;
            bytes32 toAddress;

            assembly {
                phunkId := calldataload(0)
                listingPrice := calldataload(64)
                toAddress := calldataload(96)
            }

            if (toAddress != 0x0) {
                address addrToAddress = address(uint160(uint256(toAddress)));

                _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
                offerPhunkForSaleToAddressV2(phunkId, uint256(listingPrice), addrToAddress);
                return;
            }

            _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
            _offerPhunkForSaleV2(phunkId, uint256(listingPrice));
            return;
        }

        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }
}
