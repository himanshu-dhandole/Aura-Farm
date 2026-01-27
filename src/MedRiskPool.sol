// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BasePool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MedRiskPool
 * @notice Medium risk pool with ~12% APY (Solana, Alt coins)
 * @dev ERC4626 vault for moderate yield strategies
 */
contract MedRiskPool is BasePool {
    constructor(IERC20 asset_)
        BasePool(
            asset_,
            "Aura Medium Risk Shares",
            "aMED",
            1200 // 12% APY in basis points
        )
    {}

    /**
     * @notice Returns the risk category of this pool
     * @return Risk category name
     */
    function getRiskCategory() external pure override returns (string memory) {
        return "Medium Risk";
    }
}
