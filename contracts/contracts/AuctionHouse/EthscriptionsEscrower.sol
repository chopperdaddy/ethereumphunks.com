// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library EthscriptionsEscrowerStorage {
    struct Layout {
        mapping(address => mapping(bytes32 => uint256)) ethscriptionReceivedOnBlockNumber;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256(
            "ethscriptions.contracts.storage.EthscriptionsEscrowerStorage"
        );

    function s() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract EthscriptionsEscrower {
    error EthscriptionNotDeposited();
    error EthscriptionAlreadyReceivedFromSender();
    error InvalidEthscriptionLength();
    error AdditionalCooldownRequired(uint256 additionalBlocksNeeded);

    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed id
    );

    event PotentialEthscriptionDeposited(
        address indexed owner,
        bytes32 indexed potentialEthscriptionId
    );

    event PotentialEthscriptionWithdrawn(
        address indexed owner,
        bytes32 indexed potentialEthscriptionId
    );

    uint256 public constant ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS = 5;

    function _transferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal virtual {
        _validateTransferEthscription(previousOwner, to, ethscriptionId);

        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            previousOwner,
            to,
            ethscriptionId
        );

        _afterTransferEthscription(previousOwner, to, ethscriptionId);
    }

    function withdrawEthscription(bytes32 ethscriptionId) internal virtual {
        _transferEthscription(msg.sender, msg.sender, ethscriptionId);

        // emit PotentialEthscriptionWithdrawn(msg.sender, ethscriptionId);
    }

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal virtual {
        if (userCalldata.length != 32) revert InvalidEthscriptionLength();

        bytes32 potentialEthscriptionId = abi.decode(userCalldata, (bytes32));

        if (
            userEthscriptionPossiblyStored(
                previousOwner,
                potentialEthscriptionId
            )
        ) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][potentialEthscriptionId] = block.number;

        // emit PotentialEthscriptionDeposited(previousOwner, potentialEthscriptionId);
    }

    function _validateTransferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal view virtual {
        if (
            userEthscriptionDefinitelyNotStored(previousOwner, ethscriptionId)
        ) {
            revert EthscriptionNotDeposited();
        }

        uint256 blocksRemaining = blocksRemainingUntilValidTransfer(
            previousOwner,
            ethscriptionId
        );

        if (blocksRemaining != 0) {
            revert AdditionalCooldownRequired(blocksRemaining);
        }
    }

    function _afterTransferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal virtual {
        delete EthscriptionsEscrowerStorage
            .s()
            .ethscriptionReceivedOnBlockNumber[previousOwner][ethscriptionId];
    }

    function blocksRemainingUntilValidTransfer(
        address previousOwner,
        bytes32 ethscriptionId
    ) public view virtual returns (uint256) {
        uint256 receivedBlockNumber = EthscriptionsEscrowerStorage
            .s()
            .ethscriptionReceivedOnBlockNumber[previousOwner][ethscriptionId];

        if (receivedBlockNumber == 0) {
            revert EthscriptionNotDeposited();
        }

        uint256 blocksPassed = block.number - receivedBlockNumber;

        return
            blocksPassed < ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS
                ? ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS - blocksPassed
                : 0;
    }

    function userEthscriptionDefinitelyNotStored(
        address owner,
        bytes32 ethscriptionId
    ) public view virtual returns (bool) {
        return
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                owner
            ][ethscriptionId] == 0;
    }

    function userEthscriptionPossiblyStored(
        address owner,
        bytes32 ethscriptionId
    ) public view virtual returns (bool) {
        return !userEthscriptionDefinitelyNotStored(owner, ethscriptionId);
    }
}
