// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV2_1.sol *
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
/* **************************************(V4) */
/* - Removed MulticallUpgradeable             */
/* - Removed bidding functionality            */
/* - Removed single buyPhunk (dev method)     */
/* - Added setPointsAddress()                 */
/* - Removed pendingWithdrawalsV2 mapping       */
/* - Documentation updates                    */
/* - Gas efficiency updates                   */
/* - Removed rev share                        */
/* - Removed revshare to phunkBought event    */
/* ****************************************** */

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./interfaces/IPoints.sol";
import "./EthscriptionsEscrower.sol";

contract EtherPhunksMarketV2SepoliaDowngrade is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EthscriptionsEscrower
{
    bytes32 constant DEPOSIT_AND_LIST_SIGNATURE = keccak256("DEPOSIT_AND_LIST_SIGNATURE");

    uint256 public contractVersion;
    address public pointsAddress;

    /**
     * @dev Represents an offer to sell an item.
     */
    struct Offer {
        bool isForSale;
        bytes32 phunkId;
        address seller;
        uint minValue;
        address onlySellTo;
        // Deprecated. Maintained for storage layout compatibility.
        uint revSharePercentage;
    }

    /**
     * @dev: Deprecated. Maintained for storage layout compatibility.
     */
    struct Bid {
        bool hasBid;
        bytes32 phunkId;
        address bidder;
        uint value;
    }

    /**
     * @dev Mapping that stores the offers for EtherPhunks being offered for sale.
     */
    mapping(bytes32 => Offer) public phunksOfferedForSale;

    /**
     * Deprecated. Maintained for storage layout compatibility.
     */
    mapping(bytes32 => Bid) public phunkBids;

    /**
     * Deprecated. Maintained for storage layout compatibility.
     */
    mapping(address => uint) public pendingWithdrawals;

    /**
     * @dev Emitted when an item is offered for sale.
     * @param phunkId The hashId of the ethscription.
     * @param minValue The minimum value (in wei) at which the item is offered for sale.
     * @param toAddress The address to which the item is offered for sale.
     */
    event PhunkOffered(
      bytes32 indexed phunkId,
      uint minValue,
      address indexed toAddress
    );

    /**
     * @dev Emitted when a item is bought.
     * @param phunkId The hashId of the ethscription.
     * @param value The value of the transaction.
     * @param fromAddress The address of the seller.
     * @param toAddress The address of the buyer.
     */
    event PhunkBought(
      bytes32 indexed phunkId,
      uint value,
      address indexed fromAddress,
      address indexed toAddress
    );

    /**
     * @dev Emitted when an item is no longer for sale.
     * @param phunkId The hashId of the ethscription.
     */
    event PhunkNoLongerForSale(
      bytes32 indexed phunkId
    );

    /**
     * @dev Initializes the contract with the specified contract version and initial points address.
     * @param _contractVersion The version of the contract.
     * @param _initialPointsAddress The initial points address.
     */
    function initialize(
        uint256 _contractVersion,
        address _initialPointsAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        contractVersion = _contractVersion;
        pointsAddress = _initialPointsAddress;
    }

    /**
     * @dev Allows the owner of an item to offer it for sale.
     * @param phunkId The hashId of the item being offered for sale.
     * @param minSalePriceInWei The minimum sale price for the item, in Wei.
     */
    function offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) external nonReentrant {
        _offerPhunkForSale(phunkId, minSalePriceInWei);
    }

    /**
     * @dev Allows batch offering of multiple items for sale.
     * @param phunkIds An array of item hashIds to be offered for sale.
     * @param minSalePricesInWei An array of minimum sale prices (in Wei) for each item.
     * @notice The lengths of `phunkIds` and `minSalePricesInWei` arrays must match.
     */
    function batchOfferPhunkForSale(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external nonReentrant {
        require(
            phunkIds.length == minSalePricesInWei.length,
            "Lengths mismatch"
        );
        for (uint i = 0; i < phunkIds.length; i++) {
             _offerPhunkForSale(phunkIds[i], minSalePricesInWei[i]);
        }
    }

    /**
     * @dev Offers a Phunk for sale to a specific address.
     * @param phunkId The hashId of the Phunk being offered for sale.
     * @param minSalePriceInWei The minimum sale price for the Phunk in Wei.
     * @param toAddress The address to which the Phunk will be sold.
     */
    function offerPhunkForSaleToAddress(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address toAddress
    ) public nonReentrant {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            toAddress,
            0
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, toAddress);
    }

    /**
     * @dev Internal function to offer an item for sale.
     * @param phunkId The hashId of the item being offered for sale.
     * @param minSalePriceInWei The minimum sale price for the item in Wei.
     */
    function _offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            address(0x0),
            0
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, address(0x0));
    }

    /**
     * @dev Marks an item as no longer for sale.
     * @param phunkId The hashId of the item to mark as not for sale.
     */
    function phunkNoLongerForSale(bytes32 phunkId) external {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        _invalidateListing(phunkId);
        emit PhunkNoLongerForSale(phunkId);
    }

    /**
     * @dev Internal function to buy an item.
     * @param phunkId The hashId of the item to buy.
     * @param minSalePriceInWei The minimum sale price in Wei.
     */
    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        Offer memory offer = phunksOfferedForSale[phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender,
            "Invalid sale conditions"
        );

        uint sellerAmount = minSalePriceInWei;

        _invalidateListing(phunkId);

        address seller = offer.seller;

        pendingWithdrawals[seller] += sellerAmount;

        _addPoints(seller, 100);
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(
            phunkId,
            minSalePriceInWei,
            seller,
            msg.sender
        );
    }

    /**
     * @dev Allows batch purchase of items.
     * @param phunkIds An array of item hashIds to be purchased.
     * @param minSalePricesInWei An array of minimum sale prices (in Wei) for each item.
     * @notice The lengths of `phunkIds` and `minSalePricesInWei` arrays must match.
     * @notice The total Ether sent must be equal to the sum of `minSalePricesInWei`.
     */
    function batchBuyPhunk(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external payable whenNotPaused nonReentrant {
        require(
            phunkIds.length == minSalePricesInWei.length,
            "Lengths mismatch"
        );

        uint totalSalePrice = 0;
        for (uint i = 0; i < phunkIds.length; i++) {
            _buyPhunk(phunkIds[i], minSalePricesInWei[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        require(msg.value == totalSalePrice, "Incorrect Ether amount");
    }

    /**
     * @dev Allows a user to withdraw their pending withdrawals.
     * @notice The user must have pending withdrawals greater than 0.
     * @notice The function transfers the pending withdrawals to the user's address.
     * @notice If the transfer fails, an error message is thrown.
     */
    function withdraw() public virtual nonReentrant {
        require(
            (pendingWithdrawalsV2[msg.sender] + pendingWithdrawals[msg.sender]) != 0,
            "No pending withdrawals"
        );

        uint amount = pendingWithdrawalsV2[msg.sender] + pendingWithdrawals[msg.sender];

        pendingWithdrawalsV2[msg.sender] = 0;
        pendingWithdrawals[msg.sender] = 0;

        (bool sent,) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    /**
     * @dev Allows a user to withdraw their item by providing the hashId.
     * If the hashId is not deposited, the function reverts.
     * If the hashId has an active listing, the listing is invalidated.
     * @param phunkId The hashId of the item to be withdrawn.
     */
    function withdrawPhunk(bytes32 phunkId) public {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        super.withdrawEthscription(phunkId);

        Offer memory offer = phunksOfferedForSale[phunkId];
        if (offer.isForSale) {
            _invalidateListing(phunkId);
            emit PhunkNoLongerForSale(phunkId);
        }
    }

    /**
     * @dev Withdraws multiple items from the market.
     * @param phunkIds The array of item hashIds to be withdrawn.
     */
    function withdrawBatchPhunks(bytes32[] calldata phunkIds) external {
        for (uint i = 0; i < phunkIds.length; i++) {
            withdrawPhunk(phunkIds[i]);
        }
    }

    /**
     * @dev Internal function to handle potential ethscription deposits.
     * @param previousOwner The address of the previous owner.
     * @param userCalldata The calldata containing the potential ethscriptions.
     * @notice This function is called when a user deposits ethscriptions.
     * It verifies the validity of the ethscription length and stores the received ethscriptions in the storage.
     * If an ethscription has already been received from the sender, it reverts the transaction.
     */
    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal override {
        require(
            userCalldata.length % 32 == 0,
            "Invalid ethscription length"
        );

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

    /**
     * @dev Internal function to handle potential single Ethscription deposit.
     * @param previousOwner The address of the previous owner.
     * @param phunkId The hashId of the item.
     */
    function _onPotentialSingleEthscriptionDeposit(
        address previousOwner,
        bytes32 phunkId
    ) internal {
        if (userEthscriptionPossiblyStored(previousOwner, phunkId)) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][phunkId] = block.number;
    }

    /**
     * @dev Invalidates a listing for a specific item.
     * @param phunkId The hashId of the item to invalidate the listing for.
     */
    function _invalidateListing(bytes32 phunkId) internal {
        delete phunksOfferedForSale[phunkId];
    }

    /**
     * @dev Adds points to a specific address.
     * @param owner The address of the Phunk to add points to.
     * @param amount The amount of points to add.
     */
    function _addPoints(
        address owner,
        uint256 amount
    ) internal {
        IPoints pointsContract = IPoints(pointsAddress);
        pointsContract.addPoints(owner, amount);
    }

    /**
     * @dev Pauses all contract functions. Only the contract owner can call this function.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all contract functions. Only the contract owner can call this function.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Slices a portion of a bytes array and returns a new bytes array.
     * @param data The original bytes array.
     * @param start The starting index of the slice.
     * @param len The length of the slice.
     * @return The sliced bytes array.
     */
    function slice(
        bytes memory data,
        uint256 start,
        uint256 len
    ) internal pure returns (bytes memory) {
        bytes memory b = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            b[i] = data[i + start];
        }
        return b;
    }

    /**
     * @dev It handles the deposit and/or listing of single or multiple items (hashId).
     */
    fallback() external virtual {
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
                offerPhunkForSaleToAddress(phunkId, uint256(listingPrice), addrToAddress);
                return;
            }

            _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
            _offerPhunkForSale(phunkId, uint256(listingPrice));
            return;
        }

        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }

    /* ******************** */
    /* ******** V2 ******** */
    /* ******************** */

    /**
     * @dev A mapping that stores the pending withdrawals for each address.
     * The key is the address and the value is the amount of pending withdrawal.
     */
    mapping(address => uint) public pendingWithdrawalsV2;

    /**
     * @dev Initializes the contract with the specified contract version.
     * @param _contractVersion The version of the contract to be set.
     */
    function initializeV2(
        uint256 _contractVersion
    ) public initializer {
        contractVersion = _contractVersion;
    }

    /**
     * @dev Sets the address of the points contract.
     * Can only be called by the contract owner.
     * @param _pointsAddress The address of the points contract.
     */
    function setPointsAddress(address _pointsAddress) public onlyOwner {
      pointsAddress = _pointsAddress;
    }

    /* ********************** */
    /* ******** V2_1 ******** */
    /* ********************** */

    /**
     * @dev Deprecated. Maintained for storage layout compatibility.
     */
    address payable public revShareAddress;

    /**
     * @dev Initializes the contract with the specified contract version.
     * @param _contractVersion The version of the contract to be set.
     */
    function initializeV2SepoliaDowngrade(
      uint256 _contractVersion
    ) public reinitializer(2) {
      contractVersion = _contractVersion;
    }
}
