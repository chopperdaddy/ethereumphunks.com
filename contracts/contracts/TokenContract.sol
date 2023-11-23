// SPDX-License-Identifier: PHUNKY
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenContract is Ownable, Pausable {

    using Strings for uint256;

    string public ticker;
    uint256 public totalSupply;
    uint256 private mintId;
    bytes32[] public contractOwnedHashIds;

    mapping(address => uint256) public balances;
    mapping(bytes32 => uint256) public tokensOwned;

    event ethscriptions_protocol_CreateEthscription(
        address indexed initialOwner,
        string contentURI
    );

    constructor(
        address initialOwner,
        string memory tick,
        uint256 max
    ) Ownable(initialOwner) {
        ticker = tick;
        totalSupply = max;
        mintId = 1;

        _createToken();
    }

    function _createToken() internal {
        string memory token = string(
            abi.encodePacked(
                'data:,{"p":"erc-20","op":"deploy","tick":"',
                ticker,
                '","max":"',
                totalSupply.toString(),
                '","lim":"10000", "dlim":"1"}'
            )
        );

        emit ethscriptions_protocol_CreateEthscription(msg.sender, token);
    }

    function mint() public onlyOwner {
        balances[address(this)] += 10000;

        string memory token = string(
            abi.encodePacked(
                'data:,{"p":"erc-20","op":"mint","tick":"',
                ticker,
                '","id":"',
                mintId.toString(),
                '","amt":"10000"}'
            )
        );

        mintId++;
        emit ethscriptions_protocol_CreateEthscription(msg.sender, token);
    }

    function storeHashIds(bytes32[] memory hashIds) public onlyOwner {
        contractOwnedHashIds = hashIds;

        for (uint256 i = 0; i < hashIds.length; i++) {
            tokensOwned[hashIds[i]] = 10000;
        }
    }

    function transferTokens(uint256 amount) public onlyOwner {
        balances[address(this)] -= amount;
        balances[msg.sender] += amount;
    }
}
