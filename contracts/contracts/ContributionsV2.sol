// SPDX-License-Identifier: PHUNKY

/****** ContributionsV2.sol *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░████░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░██░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
****************************/

pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IPoints.sol";

contract ContributionsV2 is Ownable, Pausable {

    // Beneficiary address
    address payable public beneficiary;
    // Points per ETH
    uint256 public pointsPerEther;
    // Address of the Points contract
    address public pointsAddress;
    // State variable to store total contributions
    uint256 public totalContributions;

    // Mapping to keep track of contributions per address
    mapping(address => uint256) public contributions;

    // Event to be emitted on contribution
    event ContributionReceived(address indexed contributor, uint256 amount);
    // Event to be emitted when beneficiary is changed
    event BeneficiaryChanged(address indexed newBeneficiary);
    // Event to be emitted when points per ETH is changed
    event PointsPerEtherChanged(uint256 indexed newPointsPerEther);
    // Event to be emitted when withdrawAllToBeneficiary is called
    event WithdrawAllToBeneficiary(address indexed beneficiary, uint256 amount);

    // Constructor to set the initial owner and beneficiary
    constructor(
        address payable _beneficiary,
        uint256 _initialPointsPerEther,
        address _pointsAddress
    ) Ownable(msg.sender) {
        beneficiary = _beneficiary;
        pointsPerEther = _initialPointsPerEther;
        pointsAddress = _pointsAddress;
    }

    // Function to allow withdrawal of all funds to the beneficiary
    function withdrawAllToBeneficiary() public whenNotPaused {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");

        // Reset total contributions since the entire balance is being withdrawn
        totalContributions = 0;

        // Transfer all funds to the beneficiary
        (bool sent, ) = beneficiary.call{value: amount}("");
        require(sent, "Failed to send Ether");

        emit WithdrawAllToBeneficiary(beneficiary, amount);
    }

    // Function for the owner to change the beneficiary address
    function setBeneficiary(address payable _newBeneficiary) public onlyOwner {
        beneficiary = _newBeneficiary;
        emit BeneficiaryChanged(_newBeneficiary);
    }

    function _addPoints(address phunk, uint256 amount) internal {
        IPoints pointsContract = IPoints(pointsAddress);
        pointsContract.addPoints(phunk, amount);
    }

    // Function to set the address of the Points contract
    function setPointsAddress(address _pointsAddress) public onlyOwner {
        pointsAddress = _pointsAddress;
    }

    // Function to set the points per ETH
    function setPointsPerEther(uint256 _pointsPerEther) public onlyOwner {
        require(_pointsPerEther > 0, "Points per Ether must be positive");
        pointsPerEther = _pointsPerEther;

        emit PointsPerEtherChanged(_pointsPerEther);
    }

    // The receive function that gets called when the contract receives Ether
    receive() external payable whenNotPaused {
        require(msg.value > 0, "Contribution must be more than 0");

        // Update total contributions and individual contributions
        totalContributions += msg.value;
        contributions[msg.sender] += msg.value;

        // The minimum ETH amount required to earn points
        uint256 minEthForPoints = 0.0001 ether;

        // Check if the sent amount is at least the minimum required for points
        if (msg.value >= minEthForPoints) {
            // Calculate the points
            uint256 points = (msg.value * pointsPerEther) / (1 ether);
            _addPoints(msg.sender, points);
        }

        // Emit the event
        emit ContributionReceived(msg.sender, msg.value);
    }
}
