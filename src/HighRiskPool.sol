// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BasePool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HighRiskPool
 * @notice High risk pool with ~20% APY (MEME coins, Shit coins)
 * @dev ERC4626 vault for aggressive yield strategies
 */
contract HighRiskPool is BasePool {
    constructor(IERC20 asset_)
        BasePool(
            asset_,
            "Aura High Risk Shares",
            "aHIGH",
            2000 // 20% APY in basis points
        )
    {}

    /**
     * @notice Returns the risk category of this pool
     * @return Risk category name
     */
    function getRiskCategory() external pure override returns (string memory) {
        return "High Risk";
    }
}
