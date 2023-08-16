// ESIP-1 start block: 17672762
export const esip1Abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'ethscriptionId',
        type: 'bytes32',
      },
    ],
    name: 'ethscriptions_protocol_TransferEthscription',
    type: 'event',
  },
];

// ESIP-2 start block: 17764910
export const esip2Abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        name: 'recipient',
        type: 'address',
      },
      {
        indexed: true,
        name: 'ethscriptionId',
        type: 'bytes32',
      },
    ],
    name: 'ethscriptions_protocol_TransferEthscriptionForPreviousOwner',
    type: 'event',
  },
];
