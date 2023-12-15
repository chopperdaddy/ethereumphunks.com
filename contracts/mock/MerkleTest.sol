// SPDX-License-Identifier: PHUNKY
pragma solidity 0.8.20;

import "solady/src/utils/MerkleProofLib.sol";

contract MerkleTest {

    bytes32 public merkleRoot = 0xaa0b9369a797e6e5e6c541e07851b7fc405bd651b7ad929b0d5ee4880bb3c80f;

    event TestMerkle (
        address sender,
        bytes32 hashId,
        bytes32[] proof,
        bytes32 root,
        bool verified
    );

    function fallbackAlt(bytes32 hashId, bytes32[] memory proof) external {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(hashId))));
        emit TestMerkle(
            msg.sender,
            hashId,
            proof,
            merkleRoot,
            MerkleProofLib.verify(proof, merkleRoot, leaf)
        );
    }

    fallback() external {
        require(msg.data.length >= 64, "Data too short"); // At least 2 * 32 bytes needed
        require(msg.data.length % 32 == 0, "Invalid data length");

        // Extract the hashId (leaf)
        bytes32 hashId;
        assembly {
            hashId := calldataload(0)
        }

        // Extract the Merkle proof
        bytes32[] memory proof = new bytes32[]((msg.data.length - 32) / 32);
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement;
            assembly {
                proofElement := calldataload(add(32, mul(32, i)))
            }
            proof[i] = proofElement;
        }

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(hashId))));
        emit TestMerkle(
            msg.sender,
            hashId,
            proof,
            merkleRoot,
            MerkleProofLib.verify(proof, merkleRoot, leaf)
        );
    }
}
