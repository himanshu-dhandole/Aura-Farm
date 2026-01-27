// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BasePool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title LowRiskPool
 * @notice Low risk pool with ~7% APY (BTC, ETH, BTC Cash)
 * @dev ERC4626 vault for conservative yield strategies
 */
contract LowRiskPool is BasePool {
    constructor(IERC20 asset_)
        BasePool(
            asset_,
            "Aura Low Risk Shares",
            "aLOW",
            700 // 7% APY in basis points
        )
    {}

    /**
     * @notice Returns the risk category of this pool
     * @return Risk category name
     */
    function getRiskCategory() external pure override returns (string memory) {
        return "Low Risk";
    }
}
