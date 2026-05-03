// SPDX-License-Identifier: PHUNKY
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PointsV2 is Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant POINTS_MANAGER_ROLE = keccak256("POINTS_MANAGER_ROLE");
    string public constant POINTS_ETHSCRIPTION_SCHEMA = "ethereumphunks.points.v2";

    uint256 public multiplier;

    mapping(address => uint256) public points;

    event PointsAdded(address indexed user, uint256 amount);
    event PointsRemoved(address indexed user, uint256 amount);
    event PointsTransferred(address indexed from, address indexed to, uint256 amount);
    event PointsSeeded(address indexed user, uint256 amount);
    event ethscriptions_protocol_CreateEthscription(
        address indexed initialOwner,
        string contentURI
    );

    constructor(address[] memory seedUsers, uint256[] memory seedAmounts) {
        require(seedUsers.length == seedAmounts.length, "Seed length mismatch");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POINTS_MANAGER_ROLE, msg.sender);

        multiplier = 1;

        uint256 seedTotal = 0;
        for (uint256 i = 0; i < seedUsers.length; i++) {
            require(seedUsers[i] != address(0), "Invalid seed user");
            points[seedUsers[i]] = seedAmounts[i];
            seedTotal += seedAmounts[i];
            emit PointsSeeded(seedUsers[i], seedAmounts[i]);
        }

        if (seedUsers.length > 0) {
            _createSeedEthscription(
                msg.sender,
                seedUsers.length,
                seedTotal,
                keccak256(abi.encode(seedUsers, seedAmounts))
            );
        }
    }

    function addPoints(address user, uint256 amount) external onlyRole(POINTS_MANAGER_ROLE) whenNotPaused {
        uint256 pointsAwarded = _addPoints(user, amount);
        _createPointsEthscription(user, "PointsAdded", address(0), user, amount, pointsAwarded);
        emit PointsAdded(user, amount);
    }

    function removePoints(address user, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        require(points[user] >= amount, "Insufficient points");
        points[user] -= amount;
        _createPointsEthscription(user, "PointsRemoved", user, address(0), amount, amount);
        emit PointsRemoved(user, amount);
    }

    function transferPoints(address to, uint256 amount) external whenNotPaused nonReentrant {
        require(points[msg.sender] >= amount, "Insufficient points");
        points[msg.sender] -= amount;
        uint256 pointsAwarded = _addPoints(to, amount);
        _createPointsEthscription(to, "PointsTransferred", msg.sender, to, amount, pointsAwarded);
        emit PointsTransferred(msg.sender, to, amount);
    }

    function drainPoints(address user) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        uint256 amount = points[user];
        points[user] = 0;
        _createPointsEthscription(user, "PointsDrained", user, address(0), amount, amount);
    }

    function changeMultiplier(uint newMultiplier) public onlyRole(DEFAULT_ADMIN_ROLE) {
        multiplier = newMultiplier;
    }

    function grantManager(address manager) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(POINTS_MANAGER_ROLE, manager);
    }

    function revokeManager(address manager) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(POINTS_MANAGER_ROLE, manager);
    }

    function _addPoints(address user, uint256 amount) internal returns (uint256 pointsAwarded) {
        pointsAwarded = amount * multiplier;
        points[user] += pointsAwarded;
    }

    function _createPointsEthscription(
        address initialOwner,
        string memory eventName,
        address from,
        address to,
        uint256 amount,
        uint256 pointsChanged
    ) internal {
        string memory accountJson = string.concat(
            '","from":"',
            Strings.toHexString(from),
            '","to":"',
            Strings.toHexString(to)
        );
        string memory pointsJson = string.concat(
            '","amount":"',
            Strings.toString(amount),
            '","pointsChanged":"',
            Strings.toString(pointsChanged)
        );
        string memory stateJson = string.concat(
            '","multiplier":"',
            Strings.toString(multiplier),
            '","balanceAfter":"',
            Strings.toString(points[initialOwner]),
            '"}'
        );
        string memory json = string.concat(
            '{"p":"',
            POINTS_ETHSCRIPTION_SCHEMA,
            '","op":"',
            eventName,
            accountJson,
            pointsJson,
            stateJson
        );

        emit ethscriptions_protocol_CreateEthscription(
            initialOwner,
            string.concat("data:application/json;rule=esip6;base64,", Base64.encode(bytes(json)))
        );
    }

    function _createSeedEthscription(
        address initialOwner,
        uint256 seedCount,
        uint256 seedTotal,
        bytes32 seedHash
    ) internal {
        string memory json = string.concat(
            '{"p":"',
            POINTS_ETHSCRIPTION_SCHEMA,
            '","op":"PointsSeeded","seedCount":"',
            Strings.toString(seedCount),
            '","seedTotal":"',
            Strings.toString(seedTotal),
            '","seedHash":"',
            Strings.toHexString(uint256(seedHash), 32),
            '"}'
        );

        emit ethscriptions_protocol_CreateEthscription(
            initialOwner,
            string.concat("data:application/json;rule=esip6;base64,", Base64.encode(bytes(json)))
        );
    }
}
