// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "solady/src/utils/SafeTransferLib.sol";
import "solady/src/utils/ECDSA.sol";
import "solady/src/utils/EIP712.sol";
import "solady/src/utils/ERC1967FactoryConstants.sol";
import "@solidstate/contracts/security/reentrancy_guard/ReentrancyGuard.sol";
import "./EthscriptionsEscrower.sol";

contract EthscriptionsMarketV3 is
    ReentrancyGuard,
    EIP712,
    EthscriptionsEscrower
{
    using SafeTransferLib for address;
    using ECDSA for bytes32;

    error NotAdmin();
    error InvalidSignature();
    error AlreadyInitialized();
    error NotFactory();
    error ZeroBalance();
    error ZeroPaymentAddress();
    error ZeroAdminAddress();
    error FeatureDisabled();

    event EthscriptionPurchased(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed ethscriptionId,
        uint256 price,
        bytes32 listingId
    );

    event ListingCancelled(address indexed seller, bytes32 indexed listingId);

    event AllListingsOfEthscriptionCancelledForUser(
        address indexed seller,
        bytes32 indexed ethscriptionId
    );

    event AllListingsCancelledForUser(address indexed seller);

    event AllListingsCancelled();

    event AdminAddressChanged(
        address indexed oldAdminAddress,
        address indexed newAdminAddress
    );
    event PaymentAddressChanged(
        address indexed oldPaymentAddress,
        address indexed newPaymentAddress
    );
    event FeeBpsChanged(uint96 oldFeeBps, uint96 newFeeBps);

    event FeesWithdrawn(address indexed recipient, uint256 amount);

    struct MarketStorage {
        mapping(address => mapping(bytes32 => bool)) storedEthscriptions;
        mapping(address => mapping(bytes32 => bool)) userListingCancellations;
        mapping(address => mapping(bytes32 => uint256)) userListingsOfEthscriptionValidAfterTime;
        mapping(address => uint256) userListingsValidAfterTime;
        address adminAddress;
        address paymentAddress;
        uint96 feeBps;
        mapping(string => bool) featureIsEnabled;
    }

    function s() internal pure returns (MarketStorage storage cs) {
        bytes32 position = keccak256("MarketStorage.contract.storage.v1");
        assembly {
            cs.slot := position
        }
    }

    function initialize(
        address adminAddress,
        address paymentAddress,
        uint96 feeBps,
        address[] calldata importOwners,
        bytes32[] calldata importHashes
    ) external {
        if (msg.sender != ERC1967FactoryConstants.ADDRESS) revert NotFactory();
        if (paymentAddress == address(0)) revert ZeroPaymentAddress();
        if (adminAddress == address(0)) revert ZeroAdminAddress();

        s().adminAddress = adminAddress;
        s().paymentAddress = paymentAddress;

        s().featureIsEnabled["withdraw"] = true;

        s().feeBps = feeBps;

        uint256 length = importOwners.length;
        for (uint256 i; i < length; ) {
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                importOwners[i]
            ][importHashes[i]] = block.number;
            unchecked {
                i++;
            }
        }
    }

    function buyWithSignature(
        bytes32 listingId,
        address seller,
        bytes32 ethscriptionId,
        uint256 price,
        uint256 startTime,
        uint256 endTime,
        bytes calldata signature
    ) external payable nonReentrant {
        if (!s().featureIsEnabled["buy"]) revert FeatureDisabled();

        bytes32 hashedMessage = _hashTypedData(
            keccak256(
                abi.encode(
                    keccak256(
                        "Listing(bytes32 listingId,address seller,bytes32 ethscriptionId,"
                        "uint256 price,uint256 startTime,uint256 endTime)"
                    ),
                    listingId,
                    seller,
                    ethscriptionId,
                    price,
                    startTime,
                    endTime
                )
            )
        );

        address signer = hashedMessage.recoverCalldata(signature);

        if (
            signer != seller ||
            block.timestamp < startTime ||
            block.timestamp > endTime ||
            msg.value != price ||
            s().userListingCancellations[seller][listingId] ||
            startTime <=
            s().userListingsOfEthscriptionValidAfterTime[seller][
                ethscriptionId
            ] ||
            startTime <= s().userListingsValidAfterTime[seller]
        ) {
            revert InvalidSignature();
        }

        seller.forceSafeTransferETH(price - computeFee(price));

        _transferEthscription(seller, msg.sender, ethscriptionId);

        emit EthscriptionPurchased(
            seller,
            msg.sender,
            ethscriptionId,
            price,
            listingId
        );
    }

    function withdrawEthscription(bytes32 ethscriptionId) public override {
        if (!s().featureIsEnabled["withdraw"]) revert FeatureDisabled();

        super.withdrawEthscription(ethscriptionId);
    }

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal override {
        if (!s().featureIsEnabled["deposit"]) revert FeatureDisabled();

        super._onPotentialEthscriptionDeposit(previousOwner, userCalldata);
    }

    function _afterTransferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal override {
        s().userListingsOfEthscriptionValidAfterTime[previousOwner][
            ethscriptionId
        ] = block.timestamp;

        super._afterTransferEthscription(previousOwner, to, ethscriptionId);
    }

    function cancelListing(bytes32 listingId) external {
        s().userListingCancellations[msg.sender][listingId] = true;
        emit ListingCancelled(msg.sender, listingId);
    }

    function cancelAllListingsForEthscription(bytes32 ethscriptionId) external {
        s().userListingsOfEthscriptionValidAfterTime[msg.sender][
            ethscriptionId
        ] = block.timestamp;
        emit AllListingsOfEthscriptionCancelledForUser(
            msg.sender,
            ethscriptionId
        );
    }

    function cancelAllListingsOfUser() external {
        s().userListingsValidAfterTime[msg.sender] = block.timestamp;
        emit AllListingsCancelledForUser(msg.sender);
    }

    function setAdminAddress(address adminAddress) external {
        if (msg.sender != s().adminAddress) revert NotAdmin();
        if (adminAddress == address(0)) revert ZeroAdminAddress();

        emit AdminAddressChanged(s().adminAddress, adminAddress);

        s().adminAddress = adminAddress;
    }

    function setPaymentAddress(address paymentAddress) external {
        if (msg.sender != s().adminAddress) revert NotAdmin();
        if (paymentAddress == address(0)) revert ZeroPaymentAddress();

        emit PaymentAddressChanged(s().paymentAddress, paymentAddress);

        s().paymentAddress = paymentAddress;
    }

    function setFeeBps(uint96 feeBps) external {
        if (msg.sender != s().adminAddress) revert NotAdmin();

        emit FeeBpsChanged(s().feeBps, feeBps);

        s().feeBps = feeBps;
    }

    function sendFeesToPaymentAddress() external {
        if (msg.sender != s().adminAddress) revert NotAdmin();
        if (address(this).balance == 0) revert ZeroBalance();
        if (s().paymentAddress == address(0)) revert ZeroPaymentAddress();

        emit FeesWithdrawn(s().paymentAddress, address(this).balance);

        s().paymentAddress.forceSafeTransferETH(address(this).balance);
    }

    function setFeatureStatus(string memory feature, bool enabled) internal {
        if (msg.sender != s().adminAddress) revert NotAdmin();

        s().featureIsEnabled[feature] = enabled;
    }

    function enableFeature(string memory feature) public {
        if (msg.sender != s().adminAddress) revert NotAdmin();

        setFeatureStatus(feature, true);
    }

    function disableFeature(string memory feature) public {
        if (msg.sender != s().adminAddress) revert NotAdmin();

        setFeatureStatus(feature, false);
    }

    function enableAllFeatures() external {
        if (msg.sender != s().adminAddress) revert NotAdmin();

        enableFeature("buy");
        enableFeature("deposit");
        enableFeature("withdraw");
    }

    function disableAllFeatures() external {
        if (msg.sender != s().adminAddress) revert NotAdmin();

        disableFeature("buy");
        disableFeature("deposit");
        disableFeature("withdraw");
    }

    function featureIsEnabled(
        string calldata feature
    ) external view returns (bool) {
        return s().featureIsEnabled[feature];
    }

    function computeFee(uint256 amount) public view returns (uint256) {
        return (amount * s().feeBps) / 10000;
    }

    function getFeeBps() external view returns (uint256) {
        return s().feeBps;
    }

    function userListingCancellations(
        address owner,
        bytes32 listingId
    ) external view returns (bool) {
        return s().userListingCancellations[owner][listingId];
    }

    function userListingsOfEthscriptionValidAfterTime(
        address owner,
        bytes32 ethscriptionId
    ) external view returns (uint256) {
        return
            s().userListingsOfEthscriptionValidAfterTime[owner][ethscriptionId];
    }

    function userListingsValidAfterTime(
        address owner
    ) external view returns (uint256) {
        return s().userListingsValidAfterTime[owner];
    }

    fallback() external {
        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }

    function _domainNameAndVersion()
        internal
        pure
        override
        returns (string memory name, string memory version)
    {
        name = "Ethscriptions Market";
        version = "3";
    }
}
