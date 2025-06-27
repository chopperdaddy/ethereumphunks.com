// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./interfaces/IPoints.sol";

contract MockPoints is IPoints {
    event PointsAdded(address indexed user, uint256 amount);

    mapping(address => uint256) public points;

    function addPoints(address user, uint256 amount) external override {
        points[user] += amount;
        emit PointsAdded(user, amount);
    }

    function getPoints(address user) external view returns (uint256) {
        return points[user];
    }
}
