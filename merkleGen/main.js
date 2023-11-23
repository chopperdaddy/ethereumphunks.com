import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

import { readFile, writeFile } from 'fs/promises';

import hashIds from './hashes.json' assert {type: 'json'};

async function generateTree() {
  const hashs = hashIds.map((hash) => [hash]);
  const tree = StandardMerkleTree.of(hashs, ["bytes32"]);
  await writeFile('./tree.json', JSON.stringify(tree.dump()));

  console.log('\n');
  console.log('Root:', tree.root);
}

async function generateProof(hashId) {
  const treeString = await readFile('./tree.json', 'utf-8');
  const tree = StandardMerkleTree.load(JSON.parse(treeString));

  let proof;
  for (const [i, v] of tree.entries()) {
    if (v[0] === hashId) proof = tree.getProof(i);
  }

  console.log('\n');
  console.log('Proof:', proof);

  console.log('\n');
  const txData = hashId + proof.map(p => p.substring(2)).join('');
  console.log('Tx Data:', txData);

  console.log('\n');
  const verified = StandardMerkleTree.verify(tree.root, ['bytes32'], [hashId], proof);
  console.log('Verified:', verified);

  console.log('\n');
}

generateTree().then(() => {
  generateProof('0x210a6985f0ee939d6a9dcf53adfaa05e0e906582d3e0364b1286123a158b3da5');
});
