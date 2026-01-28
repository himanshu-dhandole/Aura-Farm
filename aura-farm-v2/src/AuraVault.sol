// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRiskNFT {
    struct RiskProfile {
        uint8 lowPct;
        uint8 medPct;
        uint8 highPct;
    }
    function hasProfile(address user) external view returns (bool);
    function getRiskProfile(address user) external view returns (RiskProfile memory);
}

interface IStrategy {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 assetsReceived);
    function totalAssets() external view returns (uint256);
    function harvest() external returns (uint256 harvestedAmount);
    function withdrawAll() external returns (uint256 totalWithdrawn);
    function estimatedAPY() external view returns (uint256);
}

// Custom errors for gas optimization
error InvalidTier();
error InvalidParams();
error InvalidShares();
error InsufficientLiquidity();
error NoProfile();
error ZeroAmount();
error ZeroShares();
error AllocationExceeds100();
error AllocationMustBe100();
error FeeTooHigh();
error InvalidAddress();

/**
 * @title TierLogic
 * @notice Library to reduce contract size by extracting tier logic
 */
library TierLogic {
    using SafeERC20 for IERC20;

    struct StrategyAllocation {
        address strategy;
        uint8 allocationPct;
        bool active;
    }

    struct RiskTier {
        string name;
        StrategyAllocation[] strategies;
    }

    function allocateToTier(
        RiskTier storage tier,
        IERC20 token,
        uint256 amount
    ) internal {
        if (amount == 0) return;
        for (uint256 i = 0; i < tier.strategies.length; i++) {
            if (tier.strategies[i].active) {
                uint256 strategyAmount = (amount * tier.strategies[i].allocationPct) / 100;
                if (strategyAmount > 0) {
                    token.approve(tier.strategies[i].strategy, strategyAmount);
                    IStrategy(tier.strategies[i].strategy).deposit(strategyAmount, address(this));
                }
            }
        }
    }

    function withdrawFromTier(
        RiskTier storage tier,
        uint256 amount
    ) internal returns (uint256) {
        if (amount == 0) return 0;
        uint256 totalWithdrawn = 0;
        for (uint256 i = 0; i < tier.strategies.length; i++) {
            if (tier.strategies[i].active) {
                uint256 strategyAmount = (amount * tier.strategies[i].allocationPct) / 100;
                if (strategyAmount > 0) {
                    totalWithdrawn += IStrategy(tier.strategies[i].strategy).withdraw(
                        strategyAmount,
                        address(this),
                        address(this)
                    );
                }
            }
        }
        return totalWithdrawn;
    }

    function getTierAssets(RiskTier storage tier) internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < tier.strategies.length; i++) {
            if (tier.strategies[i].active) {
                total += IStrategy(tier.strategies[i].strategy).totalAssets();
            }
        }
        return total;
    }
}

/**
 * @title VaultStorage
 */
contract VaultStorage {
    using TierLogic for TierLogic.RiskTier;

    struct UserDeposit {
        uint256 totalDeposited;
        uint256 lowRiskAmount;
        uint256 medRiskAmount;
        uint256 highRiskAmount;
        uint256 depositTimestamp;
    }

    IERC20 public immutable depositToken;
    IRiskNFT public immutable riskNFT;
    TierLogic.RiskTier[3] public riskTiers;
    mapping(address => UserDeposit) public userDeposits;

    uint256 public totalHarvested;
    uint256 public lastHarvestTime;
    uint256 public performanceFeeBps = 1000;
    address public feeRecipient;

    constructor(address _depositToken, address _riskNFT, address _feeRecipient) {
        depositToken = IERC20(_depositToken);
        riskNFT = IRiskNFT(_riskNFT);
        feeRecipient = _feeRecipient;
        riskTiers[0].name = "Low Risk";
        riskTiers[1].name = "Medium Risk";
        riskTiers[2].name = "High Risk";
    }
}

/**
 * @title VaultViews
 */
contract VaultViews is VaultStorage {
    using SafeERC20 for IERC20;
    using TierLogic for TierLogic.RiskTier;

    constructor(
        address _depositToken,
        address _riskNFT,
        address _feeRecipient
    ) VaultStorage(_depositToken, _riskNFT, _feeRecipient) {}

    function _totalAssets() internal view returns (uint256) {
        uint256 total = depositToken.balanceOf(address(this));
        for (uint8 tier = 0; tier < 3; tier++) {
            total += riskTiers[tier].getTierAssets();
        }
        return total;
    }

    function totalAssets() external view returns (uint256) {
        return _totalAssets();
    }

    function getRiskTierStrategies(uint8 riskTier) external view returns (TierLogic.StrategyAllocation[] memory) {
        if (riskTier >= 3) revert InvalidTier();
        return riskTiers[riskTier].strategies;
    }

    function getRiskTierInfo(uint8 riskTier)
        external
        view
        returns (string memory name, uint256 totalAllocated, uint256 strategyCount)
    {
        if (riskTier >= 3) revert InvalidTier();
        return (riskTiers[riskTier].name, riskTiers[riskTier].getTierAssets(), riskTiers[riskTier].strategies.length);
    }

    function estimatedVaultAPY() external view returns (uint256) {
        uint256 totalWeightedAPY = 0;
        uint256 totalAssetValue = 0;

        for (uint8 tier = 0; tier < 3; tier++) {
            for (uint256 i = 0; i < riskTiers[tier].strategies.length; i++) {
                if (riskTiers[tier].strategies[i].active) {
                    uint256 strategyAssets = IStrategy(riskTiers[tier].strategies[i].strategy).totalAssets();
                    totalWeightedAPY += strategyAssets * IStrategy(riskTiers[tier].strategies[i].strategy).estimatedAPY();
                    totalAssetValue += strategyAssets;
                }
            }
        }
        return totalAssetValue == 0 ? 0 : totalWeightedAPY / totalAssetValue;
    }

    function isTierAllocationValid(uint8 riskTier) external view returns (bool isValid, uint256 totalAllocation) {
        if (riskTier >= 3) revert InvalidTier();
        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) {
                totalAllocation += riskTiers[riskTier].strategies[i].allocationPct;
            }
        }
        isValid = (totalAllocation == 100);
    }

    function getTierAllocationDetails(uint8 riskTier)
        external
        view
        returns (
            address[] memory strategyAddresses,
            uint8[] memory allocations,
            uint256[] memory currentAssets,
            uint256[] memory targetAssets
        )
    {
        if (riskTier >= 3) revert InvalidTier();

        uint256 activeCount = 0;
        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) activeCount++;
        }

        strategyAddresses = new address[](activeCount);
        allocations = new uint8[](activeCount);
        currentAssets = new uint256[](activeCount);
        targetAssets = new uint256[](activeCount);

        uint256 totalTierAssets = 0;
        uint256 index = 0;

        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) {
                strategyAddresses[index] = riskTiers[riskTier].strategies[i].strategy;
                allocations[index] = riskTiers[riskTier].strategies[i].allocationPct;
                currentAssets[index] = IStrategy(riskTiers[riskTier].strategies[i].strategy).totalAssets();
                totalTierAssets += currentAssets[index];
                index++;
            }
        }

        for (uint256 i = 0; i < activeCount; i++) {
            if (totalTierAssets > 0) {
                targetAssets[i] = (totalTierAssets * allocations[i]) / 100;
            }
        }
    }
}

/**
 * @title AuraVault
 */
contract AuraVault is ERC20, VaultViews, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using TierLogic for TierLogic.RiskTier;

    event StrategyAdded(uint8 indexed riskTier, address indexed strategy, uint8 allocationPct);
    event StrategyRemoved(uint8 indexed riskTier, uint256 indexed strategyIndex);
    event Deposited(address indexed user, uint256 amount, uint256 shares, uint256 low, uint256 med, uint256 high);
    event Withdrawn(address indexed user, uint256 shares, uint256 amount);
    event Harvested(uint256 totalHarvested, uint256 performanceFee, uint256 timestamp);
    event TierAllocationsUpdated(uint8 indexed riskTier, address[] strategies, uint8[] allocations);
    event TierRebalanced(uint8 indexed riskTier, uint256 timestamp, uint256 totalRebalanced);

    constructor(address _depositToken, address _riskNFT, address _feeRecipient)
        ERC20("Aura Vault Token", "AURA")
        VaultViews(_depositToken, _riskNFT, _feeRecipient)
        Ownable(msg.sender)
    {
        if (_depositToken == address(0) || _riskNFT == address(0) || _feeRecipient == address(0)) 
            revert InvalidAddress();
    }

    function addStrategy(uint8 riskTier, address strategy, uint8 allocationPct) external onlyOwner {
        if (riskTier >= 3 || strategy == address(0) || allocationPct == 0 || allocationPct > 100) 
            revert InvalidParams();

        uint256 totalAlloc = allocationPct;
        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) {
                totalAlloc += riskTiers[riskTier].strategies[i].allocationPct;
            }
        }
        if (totalAlloc > 100) revert AllocationExceeds100();

        riskTiers[riskTier].strategies.push(
            TierLogic.StrategyAllocation({strategy: strategy, allocationPct: allocationPct, active: true})
        );
        emit StrategyAdded(riskTier, strategy, allocationPct);
    }

    function removeStrategy(uint8 riskTier, uint256 strategyIndex) external onlyOwner {
        if (riskTier >= 3 || strategyIndex >= riskTiers[riskTier].strategies.length) revert InvalidParams();
        riskTiers[riskTier].strategies[strategyIndex].active = false;
        riskTiers[riskTier].strategies[strategyIndex].allocationPct = 0;
        emit StrategyRemoved(riskTier, strategyIndex);
    }

    function updateTierAllocations(uint8 riskTier, uint256[] calldata indices, uint8[] calldata allocations) external onlyOwner {
        if (riskTier >= 3 || indices.length != allocations.length || indices.length == 0) revert InvalidParams();

        uint256 totalAlloc = 0;
        address[] memory strategies = new address[](indices.length);

        for (uint256 i = 0; i < indices.length; i++) {
            if (indices[i] >= riskTiers[riskTier].strategies.length || 
                !riskTiers[riskTier].strategies[indices[i]].active || 
                allocations[i] == 0) revert InvalidParams();
            totalAlloc += allocations[i];
            strategies[i] = riskTiers[riskTier].strategies[indices[i]].strategy;
        }
        if (totalAlloc != 100) revert AllocationMustBe100();

        for (uint256 i = 0; i < indices.length; i++) {
            riskTiers[riskTier].strategies[indices[i]].allocationPct = allocations[i];
        }

        emit TierAllocationsUpdated(riskTier, strategies, allocations);
    }

    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (!riskNFT.hasProfile(msg.sender)) revert NoProfile();

        uint256 totalAssetsBefore = _totalAssets();
        uint256 supplyBefore = totalSupply();

        shares = supplyBefore == 0 ? assets : (assets * supplyBefore) / totalAssetsBefore;
        if (shares == 0) revert ZeroShares();
        depositToken.safeTransferFrom(msg.sender, address(this), assets);

        IRiskNFT.RiskProfile memory profile = riskNFT.getRiskProfile(msg.sender);
        uint256 lowAlloc = (assets * profile.lowPct) / 100;
        uint256 medAlloc = (assets * profile.medPct) / 100;
        uint256 highAlloc = assets - lowAlloc - medAlloc;

        if (lowAlloc > 0) riskTiers[0].allocateToTier(depositToken, lowAlloc);
        if (medAlloc > 0) riskTiers[1].allocateToTier(depositToken, medAlloc);
        if (highAlloc > 0) riskTiers[2].allocateToTier(depositToken, highAlloc);

        _mint(msg.sender, shares);

        UserDeposit storage dep = userDeposits[msg.sender];
        dep.totalDeposited += assets;
        dep.lowRiskAmount += lowAlloc;
        dep.medRiskAmount += medAlloc;
        dep.highRiskAmount += highAlloc;
        dep.depositTimestamp = block.timestamp;

        emit Deposited(msg.sender, assets, shares, lowAlloc, medAlloc, highAlloc);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0 || balanceOf(msg.sender) < shares) revert InvalidShares();

        uint256 totalAssetsNow = _totalAssets();
        uint256 supplyNow = totalSupply();
        uint256 assetsToReturn = (shares * totalAssetsNow) / supplyNow;

        uint256 tier0Assets = riskTiers[0].getTierAssets();
        uint256 tier1Assets = riskTiers[1].getTierAssets();
        uint256 tier2Assets = riskTiers[2].getTierAssets();
        uint256 totalTierAssets = tier0Assets + tier1Assets + tier2Assets;

        uint256 received = 0;

        if (totalTierAssets > 0) {
            if (tier0Assets > 0) received += riskTiers[0].withdrawFromTier((assetsToReturn * tier0Assets) / totalTierAssets);
            if (tier1Assets > 0) received += riskTiers[1].withdrawFromTier((assetsToReturn * tier1Assets) / totalTierAssets);
            if (tier2Assets > 0) received += riskTiers[2].withdrawFromTier((assetsToReturn * tier2Assets) / totalTierAssets);
        }

        uint256 idleBalance = depositToken.balanceOf(address(this));
        if (received < assetsToReturn && idleBalance > 0) {
            uint256 needed = assetsToReturn - received;
            received += (needed > idleBalance ? idleBalance : needed);
        }
        if (received < assetsToReturn) revert InsufficientLiquidity();

        _burn(msg.sender, shares);

        UserDeposit storage dep = userDeposits[msg.sender];
        if (dep.totalDeposited > 0) {
            uint256 supplyBefore = supplyNow + shares;
            uint256 ratio = (shares * 1e18) / supplyBefore;
            dep.totalDeposited = (dep.totalDeposited * (1e18 - ratio)) / 1e18;
            dep.lowRiskAmount = (dep.lowRiskAmount * (1e18 - ratio)) / 1e18;
            dep.medRiskAmount = (dep.medRiskAmount * (1e18 - ratio)) / 1e18;
            dep.highRiskAmount = (dep.highRiskAmount * (1e18 - ratio)) / 1e18;
        }

        depositToken.safeTransfer(msg.sender, received);
        emit Withdrawn(msg.sender, shares, received);
        return received;
    }

    function harvestAll() external nonReentrant onlyOwner returns (uint256) {
        uint256 balanceBefore = depositToken.balanceOf(address(this));

        for (uint8 tier = 0; tier < 3; tier++) {
            for (uint256 i = 0; i < riskTiers[tier].strategies.length; i++) {
                if (riskTiers[tier].strategies[i].active) {
                    IStrategy(riskTiers[tier].strategies[i].strategy).harvest();
                }
            }
        }

        uint256 balanceAfter = depositToken.balanceOf(address(this));
        uint256 liquidYield = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;

        uint256 performanceFee = 0;
        uint256 netHarvest = liquidYield;

        if (liquidYield > 0) {
            performanceFee = (liquidYield * performanceFeeBps) / 10000;
            netHarvest = liquidYield - performanceFee;
            if (performanceFee > 0) depositToken.safeTransfer(feeRecipient, performanceFee);
        }

        totalHarvested += netHarvest;
        lastHarvestTime = block.timestamp;
        emit Harvested(liquidYield, performanceFee, block.timestamp);
        return netHarvest;
    }

    function rebalanceTier(uint8 tier) public nonReentrant onlyOwner {
        if (tier >= 3) revert InvalidTier();
        TierLogic.StrategyAllocation[] storage strategies = riskTiers[tier].strategies;
        if (strategies.length == 0) revert InvalidParams();

        uint256 totalAllocation = 0;
        uint256 activeCount = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                totalAllocation += strategies[i].allocationPct;
                activeCount++;
            }
        }
        if (totalAllocation != 100 || activeCount == 0) revert InvalidParams();

        uint256 totalTierAssets = 0;
        uint256[] memory currentAssets = new uint256[](strategies.length);

        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                currentAssets[i] = IStrategy(strategies[i].strategy).totalAssets();
                totalTierAssets += currentAssets[i];
            }
        }

        if (totalTierAssets == 0) {
            emit TierRebalanced(tier, block.timestamp, 0);
            return;
        }

        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 targetAssets = (totalTierAssets * strategies[i].allocationPct) / 100;
                if (currentAssets[i] > targetAssets) {
                    IStrategy(strategies[i].strategy).withdraw(currentAssets[i] - targetAssets, address(this), address(this));
                }
            }
        }

        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 targetAssets = (totalTierAssets * strategies[i].allocationPct) / 100;
                if (targetAssets > currentAssets[i]) {
                    uint256 deficitAmount = targetAssets - currentAssets[i];
                    depositToken.approve(strategies[i].strategy, deficitAmount);
                    IStrategy(strategies[i].strategy).deposit(deficitAmount, address(this));
                }
            }
        }

        emit TierRebalanced(tier, block.timestamp, totalTierAssets);
    }

    function getUserValue(address user) external view returns (uint256) {
        uint256 userShares = balanceOf(user);
        uint256 supply = totalSupply();
        return supply == 0 ? 0 : (userShares * _totalAssets()) / supply;
    }

    function getUserDeposit(address user) external view returns (UserDeposit memory) {
        return userDeposits[user];
    }

    function setPerformanceFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 2000) revert FeeTooHigh();
        performanceFeeBps = _feeBps;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        feeRecipient = _feeRecipient;
    }

    function emergencyWithdrawStrategy(uint8 riskTier, uint256 strategyIndex) external onlyOwner nonReentrant {
        if (riskTier >= 3 || strategyIndex >= riskTiers[riskTier].strategies.length) revert InvalidParams();
        IStrategy(riskTiers[riskTier].strategies[strategyIndex].strategy).withdrawAll();
    }
}
