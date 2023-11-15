// SPDX-License-Identifier: MIT License
pragma solidity 0.8.20;

import "@solidstate/contracts/security/reentrancy_guard/ReentrancyGuard.sol";

contract DonationContract is ReentrancyGuard {
    // State variable to store total donations
    uint256 public totalDonations;

    // Mapping to keep track of donations per address
    mapping(address => uint256) public donations;

    // State variable to store the paused status
    bool public paused = false;

    // Owner of the contract
    address public owner;

    // Beneficiary address
    address payable public beneficiary;

    // Event to be emitted on donation
    event DonationReceived(address indexed donor, uint256 amount);

    // Event to be emitted when beneficiary is changed
    event BeneficiaryChanged(address indexed newBeneficiary);

    // Modifier to restrict access to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function.");
        _;
    }

    // Modifier to check if the contract is paused
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // Constructor to set the initial owner and beneficiary
    constructor(address payable _beneficiary) {
        owner = msg.sender;
        beneficiary = _beneficiary;
    }

    // The receive function that gets called when the contract receives Ether
    receive() external payable {
        require(msg.value > 0, "Donation must be more than 0");

        // Update total donations and individual donations
        totalDonations += msg.value;
        donations[msg.sender] += msg.value;

        // Emit the event
        emit DonationReceived(msg.sender, msg.value);
    }

    // Function to allow withdrawal of all funds to the beneficiary
    function withdrawAllToBeneficiary() public whenNotPaused nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");

        // Reset total donations since the entire balance is being withdrawn
        totalDonations = 0;

        // Transfer all funds to the beneficiary
        (bool sent, ) = beneficiary.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    // Function for the owner to change the beneficiary address
    function setBeneficiary(address payable _newBeneficiary) public onlyOwner {
        beneficiary = _newBeneficiary;
        emit BeneficiaryChanged(_newBeneficiary);
    }

    // Function to pause the contract
    function pause() public onlyOwner {
        paused = true;
    }

    // Function to unpause the contract
    function unpause() public onlyOwner {
        paused = false;
    }
}
