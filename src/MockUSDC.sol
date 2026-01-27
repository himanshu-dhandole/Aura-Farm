// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Mock ERC20 token for testing purposes
 * @dev Simulates USDC with 6 decimals
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}

    /**
     * @notice Returns the number of decimals
     * @return Number of decimals (6 for USDC)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens to an address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from an address (for testing)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
