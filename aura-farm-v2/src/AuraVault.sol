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
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function totalAssets() external view returns (uint256);
    function balanceOf() external view returns (uint256);
    function harvest() external returns (uint256 harvestedAmount);
    function withdrawAll() external returns (uint256 totalWithdrawn);
    function estimatedAPY() external view returns (uint256);
}

/**
 * @title VaultStorage
 * @notice Separate contract for storage to reduce main contract size
 */
contract VaultStorage {
    struct StrategyAllocation {
        address strategy;
        uint8 allocationPct;
        bool active;
    }

    struct RiskTier {
        string name;
        StrategyAllocation[] strategies;
        uint256 totalAllocated;
    }

    struct UserDeposit {
        uint256 totalDeposited;
        uint256 lowRiskAmount;
        uint256 medRiskAmount;
        uint256 highRiskAmount;
        uint256 depositTimestamp;
    }

    IERC20 public immutable depositToken;
    IRiskNFT public immutable riskNFT;
    RiskTier[3] public riskTiers;
    mapping(address => UserDeposit) public userDeposits;
    uint256 public totalValueLocked;
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
 * @title VaultLogic
 * @notice Library containing core vault logic to reduce contract size
 */
library VaultLogic {
    using SafeERC20 for IERC20;

    event Deposited(address indexed user, uint256 amount, uint256 auraTokensMinted, uint256 lowRiskAlloc, uint256 medRiskAlloc, uint256 highRiskAlloc);
    event Withdrawn(address indexed user, uint256 auraTokensBurned, uint256 amountReceived);

    function allocateToStrategies(
        VaultStorage.StrategyAllocation[] storage strategies,
        IERC20 depositToken,
        uint256 amount
    ) internal {
        if (amount == 0) return;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 strategyAmount = (amount * strategies[i].allocationPct) / 100;
                if (strategyAmount > 0) {
                    depositToken.approve(strategies[i].strategy, strategyAmount);
                    IStrategy(strategies[i].strategy).deposit(strategyAmount, address(this));
                }
            }
        }
    }

    function withdrawFromStrategies(
        VaultStorage.StrategyAllocation[] storage strategies,
        uint256 amount
    ) internal returns (uint256) {
        if (amount == 0) return 0;

        uint256 totalWithdrawn = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 strategyAmount = (amount * strategies[i].allocationPct) / 100;
                if (strategyAmount > 0) {
                    uint256 withdrawn = IStrategy(strategies[i].strategy).withdraw(
                        strategyAmount, address(this), address(this)
                    );
                    totalWithdrawn += withdrawn;
                }
            }
        }
        return totalWithdrawn;
    }
}

/**
 * @title AuraVault
 * @notice Main vault - significantly reduced size through modularization
 */
contract AuraVault is ERC20, VaultStorage, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event StrategyAdded(uint8 indexed riskTier, address indexed strategy, uint8 allocationPct);
    event StrategyRemoved(uint8 indexed riskTier, uint256 indexed strategyIndex);
    event Harvested(uint256 totalHarvested, uint256 performanceFee, uint256 timestamp);
    event Rebalanced(uint256 timestamp);
    event TierAllocationsUpdated(uint8 indexed riskTier, address[] strategies, uint8[] allocations);
    event TierRebalanced(uint8 indexed riskTier, uint256 timestamp, uint256 totalRebalanced);

    constructor(address _depositToken, address _riskNFT, address _feeRecipient) 
        ERC20("Aura Vault Token", "AURA") 
        VaultStorage(_depositToken, _riskNFT, _feeRecipient)
        Ownable(msg.sender) 
    {
        require(_depositToken != address(0) && _riskNFT != address(0) && _feeRecipient != address(0), "Invalid addresses");
    }

    // ============ STRATEGY MANAGEMENT ============
    
    function addStrategy(uint8 riskTier, address strategy, uint8 allocationPct) external onlyOwner {
        require(riskTier < 3 && strategy != address(0) && allocationPct > 0 && allocationPct <= 100, "Invalid params");

        uint256 totalAlloc = allocationPct;
        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) {
                totalAlloc += riskTiers[riskTier].strategies[i].allocationPct;
            }
        }
        require(totalAlloc <= 100, "Total allocation exceeds 100%");

        riskTiers[riskTier].strategies.push(StrategyAllocation({
            strategy: strategy,
            allocationPct: allocationPct,
            active: true
        }));

        emit StrategyAdded(riskTier, strategy, allocationPct);
    }

    function removeStrategy(uint8 riskTier, uint256 strategyIndex) external onlyOwner {
        require(riskTier < 3 && strategyIndex < riskTiers[riskTier].strategies.length, "Invalid params");
        riskTiers[riskTier].strategies[strategyIndex].active = false;
        riskTiers[riskTier].strategies[strategyIndex].allocationPct = 0;
        emit StrategyRemoved(riskTier, strategyIndex);
    }

    function updateTierAllocations(uint8 riskTier, uint256[] calldata indices, uint8[] calldata allocations) external onlyOwner {
        require(riskTier < 3 && indices.length == allocations.length && indices.length > 0, "Invalid params");

        uint256 totalAlloc = 0;
        address[] memory strategies = new address[](indices.length);

        for (uint256 i = 0; i < indices.length; i++) {
            require(indices[i] < riskTiers[riskTier].strategies.length && 
                    riskTiers[riskTier].strategies[indices[i]].active && 
                    allocations[i] > 0, "Invalid strategy");
            totalAlloc += allocations[i];
            strategies[i] = riskTiers[riskTier].strategies[indices[i]].strategy;
        }
        require(totalAlloc == 100, "Must sum to 100%");

        for (uint256 i = 0; i < indices.length; i++) {
            riskTiers[riskTier].strategies[indices[i]].allocationPct = allocations[i];
        }

        emit TierAllocationsUpdated(riskTier, strategies, allocations);
    }

    // ============ DEPOSIT & WITHDRAW ============

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0 && riskNFT.hasProfile(msg.sender), "Invalid deposit");

        IRiskNFT.RiskProfile memory profile = riskNFT.getRiskProfile(msg.sender);
        depositToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 lowRiskAmount = (amount * profile.lowPct) / 100;
        uint256 medRiskAmount = (amount * profile.medPct) / 100;
        uint256 highRiskAmount = (amount * profile.highPct) / 100;

        VaultLogic.allocateToStrategies(riskTiers[0].strategies, depositToken, lowRiskAmount);
        VaultLogic.allocateToStrategies(riskTiers[1].strategies, depositToken, medRiskAmount);
        VaultLogic.allocateToStrategies(riskTiers[2].strategies, depositToken, highRiskAmount);

        UserDeposit storage userDep = userDeposits[msg.sender];
        userDep.totalDeposited += amount;
        userDep.lowRiskAmount += lowRiskAmount;
        userDep.medRiskAmount += medRiskAmount;
        userDep.highRiskAmount += highRiskAmount;
        userDep.depositTimestamp = block.timestamp;

        riskTiers[0].totalAllocated += lowRiskAmount;
        riskTiers[1].totalAllocated += medRiskAmount;
        riskTiers[2].totalAllocated += highRiskAmount;
        totalValueLocked += amount;

        _mint(msg.sender, amount);
        emit VaultLogic.Deposited(msg.sender, amount, amount, lowRiskAmount, medRiskAmount, highRiskAmount);
    }

    function withdraw(uint256 auraAmount) external nonReentrant {
        require(auraAmount > 0 && balanceOf(msg.sender) >= auraAmount, "Invalid withdrawal");

        UserDeposit storage userDep = userDeposits[msg.sender];
        require(userDep.totalDeposited > 0, "No deposits");

        uint256 totalUserDeposit = userDep.totalDeposited;
        uint256 lowRiskWithdraw = (userDep.lowRiskAmount * auraAmount) / totalUserDeposit;
        uint256 medRiskWithdraw = (userDep.medRiskAmount * auraAmount) / totalUserDeposit;
        uint256 highRiskWithdraw = (userDep.highRiskAmount * auraAmount) / totalUserDeposit;

        uint256 totalWithdrawn = VaultLogic.withdrawFromStrategies(riskTiers[0].strategies, lowRiskWithdraw) +
                                 VaultLogic.withdrawFromStrategies(riskTiers[1].strategies, medRiskWithdraw) +
                                 VaultLogic.withdrawFromStrategies(riskTiers[2].strategies, highRiskWithdraw);

        userDep.totalDeposited -= auraAmount;
        userDep.lowRiskAmount -= lowRiskWithdraw;
        userDep.medRiskAmount -= medRiskWithdraw;
        userDep.highRiskAmount -= highRiskWithdraw;

        riskTiers[0].totalAllocated -= lowRiskWithdraw;
        riskTiers[1].totalAllocated -= medRiskWithdraw;
        riskTiers[2].totalAllocated -= highRiskWithdraw;
        totalValueLocked -= auraAmount;

        _burn(msg.sender, auraAmount);
        depositToken.safeTransfer(msg.sender, totalWithdrawn);
        emit VaultLogic.Withdrawn(msg.sender, auraAmount, totalWithdrawn);
    }

    // ============ HARVEST & REBALANCE ============

    function harvestAll() external nonReentrant onlyOwner returns (uint256) {
        uint256 totalHarvestedAmount = 0;

        for (uint8 tier = 0; tier < 3; tier++) {
            for (uint256 i = 0; i < riskTiers[tier].strategies.length; i++) {
                if (riskTiers[tier].strategies[i].active) {
                    totalHarvestedAmount += IStrategy(riskTiers[tier].strategies[i].strategy).harvest();
                }
            }
        }

        uint256 performanceFee = (totalHarvestedAmount * performanceFeeBps) / 10000;
        uint256 netHarvest = totalHarvestedAmount - performanceFee;

        if (performanceFee > 0) depositToken.safeTransfer(feeRecipient, performanceFee);
        
        totalHarvested += netHarvest;
        lastHarvestTime = block.timestamp;
        emit Harvested(totalHarvestedAmount, performanceFee, block.timestamp);
        return netHarvest;
    }

    function rebalanceTier(uint8 tier) public nonReentrant onlyOwner {
        require(tier < 3, "Invalid tier");
        StrategyAllocation[] storage strategies = riskTiers[tier].strategies;
        require(strategies.length > 0, "No strategies");

        uint256 totalAllocation = 0;
        uint256 activeCount = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                totalAllocation += strategies[i].allocationPct;
                activeCount++;
            }
        }
        require(totalAllocation == 100 && activeCount > 0, "Invalid allocations");

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

        // Withdraw from overweight
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 targetAssets = (totalTierAssets * strategies[i].allocationPct) / 100;
                if (currentAssets[i] > targetAssets) {
                    IStrategy(strategies[i].strategy).withdraw(
                        currentAssets[i] - targetAssets, address(this), address(this)
                    );
                }
            }
        }

        // Deposit into underweight
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

    function rebalance() external onlyOwner {
        for (uint8 tier = 0; tier < 3; tier++) {
            if (riskTiers[tier].strategies.length > 0) rebalanceTier(tier);
        }
        emit Rebalanced(block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============

    function totalAssets() external view returns (uint256) {
        uint256 total = 0;
        for (uint8 tier = 0; tier < 3; tier++) {
            for (uint256 i = 0; i < riskTiers[tier].strategies.length; i++) {
                if (riskTiers[tier].strategies[i].active) {
                    total += IStrategy(riskTiers[tier].strategies[i].strategy).totalAssets();
                }
            }
        }
        return total;
    }

    function getUserValue(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    function getUserDeposit(address user) external view returns (UserDeposit memory) {
        return userDeposits[user];
    }

    function getRiskTierStrategies(uint8 riskTier) external view returns (StrategyAllocation[] memory) {
        require(riskTier < 3, "Invalid tier");
        return riskTiers[riskTier].strategies;
    }

    function getRiskTierInfo(uint8 riskTier) external view returns (string memory name, uint256 totalAllocated, uint256 strategyCount) {
        require(riskTier < 3, "Invalid tier");
        return (riskTiers[riskTier].name, riskTiers[riskTier].totalAllocated, riskTiers[riskTier].strategies.length);
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
        require(riskTier < 3, "Invalid tier");
        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) {
                totalAllocation += riskTiers[riskTier].strategies[i].allocationPct;
            }
        }
        isValid = (totalAllocation == 100);
    }

    function getTierAllocationDetails(uint8 riskTier) external view returns (
        address[] memory strategyAddresses,
        uint8[] memory allocations,
        uint256[] memory currentAssets,
        uint256[] memory targetAssets
    ) {
        require(riskTier < 3, "Invalid tier");
        
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

    // ============ ADMIN FUNCTIONS ============

    function setPerformanceFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 2000, "Fee too high");
        performanceFeeBps = _feeBps;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
    }

    function emergencyWithdrawStrategy(uint8 riskTier, uint256 strategyIndex) external onlyOwner nonReentrant {
        require(riskTier < 3 && strategyIndex < riskTiers[riskTier].strategies.length, "Invalid params");
        IStrategy(riskTiers[riskTier].strategies[strategyIndex].strategy).withdrawAll();
    }
}
