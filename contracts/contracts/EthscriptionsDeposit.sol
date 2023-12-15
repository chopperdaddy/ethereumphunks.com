// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./EthscriptionsEscrower.sol";

contract EthscriptionsDepositooor is EthscriptionsEscrower, Ownable, Pausable {

    bytes32 public merkleRoot;

    constructor(
        address _initialOwner,
        bytes32 _merkleRoot
    ) Ownable(_initialOwner) {
        merkleRoot = _merkleRoot;
    }

    /**
     * @dev Sets the merkle root.
     * @param _merkleRoot The new merkle root.
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    /**
     * @dev Withdraws an ethscription form escrow.
     * @param hashId The hashId of the ethscription.
     */
    function withdraw(bytes32 hashId) external {
        super.withdrawEthscription(hashId);
    }

    /**
     * @dev Called when a potential ethscription deposit is received.
     * This is a revision to the protocol deposit function.
     * @param previousOwner The previous owner of the ethscription.
     * @param hashId The hashId of the ethscription.
     */
    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes32 hashId
    ) internal {
        if (
            userEthscriptionPossiblyStored(previousOwner, hashId)
        ) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][hashId] = block.number;

        // This event is redundant imo. Indexer will pick up transfer event
        emit PotentialEthscriptionDeposited(previousOwner, hashId);
    }

    /**
     * @dev Called when a potential ethscription deposit is received.
     * Fist 32 verifies the hashId, the rest is the merkle proof.
     */
    function _verifyDeposit()
        internal
        view
        returns (bytes32)
    {
        // At least 2 * 32 bytes needed
        require(msg.data.length >= 64, "Data too short");
        // Data length must be a multiple of 32 bytes
        require(msg.data.length % 32 == 0, "Invalid data length");

        // Extract the "hashId" (leaf)
        bytes32 hashId;
        assembly { hashId := calldataload(0) }

        // Extract the merkle proof
        bytes32[] memory proof = new bytes32[]((msg.data.length - 32) / 32);
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement;
            assembly { proofElement := calldataload(add(32, mul(32, i))) }
            proof[i] = proofElement;
        }

        // Hash the hashId
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(hashId))));
        // Verify the proof
        require(MerkleProof.verify(proof, merkleRoot, leaf), "MerkleDistributor: Invalid proof.");
        // Return the hashId
        return hashId;
    }

    fallback() external whenNotPaused {
        bytes32 hashId = _verifyDeposit();
        _onPotentialEthscriptionDeposit(msg.sender, hashId);
    }
}
