import { MerkleTree } from 'merkletreejs'

import { ethers } from 'hardhat'
import { decodeBytes32String, keccak256, toUtf8Bytes } from 'ethers';
import sha256 from 'crypto-js/sha256';

import hashIds from './hashIds.json';

export async function getMerkleRoot() {

  const leaves = hashIds.map(x => keccak256(toUtf8Bytes(x)));
  const tree = new MerkleTree(leaves, sha256);

  const root = '0x' + tree.getRoot().toString('hex');
  return root;

  const leaf = keccak256(toUtf8Bytes('0xc07042bbcf43932935335c945b5e430deb788b02ae1a61556b4e3f1e8132ec33'));
  const proof = tree.getProof(leaf);
  const formattedProof = proof.map(x => `0x${x.data.toString('hex')}`);

  console.log({ root, leaf, proof: formattedProof });

  console.log(tree.verify(proof, leaf, root));
}

getMerkleRoot();
