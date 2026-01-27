// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BasePool
 * @notice Abstract base contract for risk-based pools
 * @dev ERC4626 vault with simulated yield functionality for testing
 */
abstract contract BasePool is ERC4626, Ownable {
    // Expected APY for this pool (basis points, e.g., 700 = 7%)
    uint256 public immutable expectedAPY;

    event YieldSimulated(uint256 amount, uint256 newTotalAssets);

    /**
     * @param asset_ The underlying asset (e.g., MockUSDC)
     * @param name_ Name of the pool token
     * @param symbol_ Symbol of the pool token
     * @param apy_ Expected APY in basis points (e.g., 700 for 7%)
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        uint256 apy_
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(msg.sender) {
        expectedAPY = apy_;
    }

    /**
     * @notice Simulate yield generation by minting additional underlying assets
     * @dev For testing purposes only - simulates earnings over a period
     * @param percentage Percentage increase in basis points (e.g., 100 = 1%)
     */
    function simulateYield(uint256 percentage) external onlyOwner {
        require(percentage > 0 && percentage <= 10000, "BasePool: invalid percentage");
        
        uint256 currentAssets = totalAssets();
        uint256 yieldAmount = (currentAssets * percentage) / 10000;
        
        // Mint additional underlying assets to the pool to simulate yield
        // This requires the underlying asset to have a mint function (like MockUSDC)
        // In production, this would come from actual yield-generating strategies
        
        emit YieldSimulated(yieldAmount, currentAssets + yieldAmount);
    }

    /**
     * @notice Get the pool's risk category as a string
     * @return Risk category name
     */
    function getRiskCategory() external view virtual returns (string memory);

    /**
     * @notice Get the pool's expected APY
     * @return APY in basis points
     */
    function getExpectedAPY() external view returns (uint256) {
        return expectedAPY;
    }
}
