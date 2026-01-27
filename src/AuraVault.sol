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
 * @title AuraVault
 * @notice Main vault that integrates with Risk NFT and allocates deposits across strategies
 * @dev Users deposit USDT, get AURA tokens, funds are allocated based on their Risk NFT profile
 */
contract AuraVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ STRUCTS ============

    struct StrategyAllocation {
        address strategy;
        uint8 allocationPct; // Percentage allocation within the risk tier (0-100)
        bool active;
    }

    struct RiskTier {
        string name;
        StrategyAllocation[] strategies;
        uint256 totalAllocated; // Total USDT currently allocated to this tier
    }

    struct UserDeposit {
        uint256 totalDeposited;
        uint256 lowRiskAmount;
        uint256 medRiskAmount;
        uint256 highRiskAmount;
        uint256 depositTimestamp;
    }

    // ============ STATE VARIABLES ============

    IERC20 public immutable depositToken; // vUSDT
    IRiskNFT public immutable riskNFT;

    // Risk tiers: 0 = Low, 1 = Medium, 2 = High
    RiskTier[3] public riskTiers;

    // User tracking
    mapping(address => UserDeposit) public userDeposits;
    
    uint256 public totalValueLocked;
    uint256 public totalHarvested;
    uint256 public lastHarvestTime;

    // Performance fee
    uint256 public performanceFeeBps = 1000; // 10%
    address public feeRecipient;

    // ============ EVENTS ============

    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 auraTokensMinted,
        uint256 lowRiskAlloc,
        uint256 medRiskAlloc,
        uint256 highRiskAlloc
    );

    event Withdrawn(
        address indexed user,
        uint256 auraTokensBurned,
        uint256 amountReceived
    );

    event StrategyAdded(
        uint8 indexed riskTier,
        address indexed strategy,
        uint8 allocationPct
    );

    event StrategyRemoved(
        uint8 indexed riskTier,
        uint256 indexed strategyIndex
    );

    event Harvested(
        uint256 totalHarvested,
        uint256 performanceFee,
        uint256 timestamp
    );

    event Rebalanced(uint256 timestamp);

    // ============ CONSTRUCTOR ============

    constructor(
        address _depositToken,
        address _riskNFT,
        address _feeRecipient
    ) ERC20("Aura Vault Token", "AURA") Ownable(msg.sender) {
        require(_depositToken != address(0), "Invalid deposit token");
        require(_riskNFT != address(0), "Invalid risk NFT");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        depositToken = IERC20(_depositToken);
        riskNFT = IRiskNFT(_riskNFT);
        feeRecipient = _feeRecipient;

        // Initialize risk tier names
        riskTiers[0].name = "Low Risk";
        riskTiers[1].name = "Medium Risk";
        riskTiers[2].name = "High Risk";
    }

    // ============ STRATEGY MANAGEMENT ============

    /**
     * @notice Add a strategy to a specific risk tier
     * @param riskTier 0=Low, 1=Medium, 2=High
     * @param strategy Address of the strategy contract
     * @param allocationPct Percentage allocation within this tier (0-100)
     */
    function addStrategy(
        uint8 riskTier,
        address strategy,
        uint8 allocationPct
    ) external onlyOwner {
        require(riskTier < 3, "Invalid risk tier");
        require(strategy != address(0), "Invalid strategy");
        require(allocationPct > 0 && allocationPct <= 100, "Invalid allocation");

        // Check total allocation doesn't exceed 100%
        uint256 totalAlloc = allocationPct;
        for (uint256 i = 0; i < riskTiers[riskTier].strategies.length; i++) {
            if (riskTiers[riskTier].strategies[i].active) {
                totalAlloc += riskTiers[riskTier].strategies[i].allocationPct;
            }
        }
        require(totalAlloc <= 100, "Total allocation exceeds 100%");

        riskTiers[riskTier].strategies.push(
            StrategyAllocation({
                strategy: strategy,
                allocationPct: allocationPct,
                active: true
            })
        );

        emit StrategyAdded(riskTier, strategy, allocationPct);
    }

    /**
     * @notice Remove a strategy from a risk tier
     */
    function removeStrategy(uint8 riskTier, uint256 strategyIndex) external onlyOwner {
        require(riskTier < 3, "Invalid risk tier");
        require(strategyIndex < riskTiers[riskTier].strategies.length, "Invalid index");

        riskTiers[riskTier].strategies[strategyIndex].active = false;
        riskTiers[riskTier].strategies[strategyIndex].allocationPct = 0;

        emit StrategyRemoved(riskTier, strategyIndex);
    }

    /**
     * @notice Update strategy allocation percentage
     */
    function updateStrategyAllocation(
        uint8 riskTier,
        uint256 strategyIndex,
        uint8 newAllocationPct
    ) external onlyOwner {
        require(riskTier < 3, "Invalid risk tier");
        require(strategyIndex < riskTiers[riskTier].strategies.length, "Invalid index");
        require(newAllocationPct > 0 && newAllocationPct <= 100, "Invalid allocation");

        riskTiers[riskTier].strategies[strategyIndex].allocationPct = newAllocationPct;
    }

    // ============ DEPOSIT FUNCTION ============

    /**
     * @notice Deposit USDT and receive AURA tokens
     * @param amount Amount of USDT to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(riskNFT.hasProfile(msg.sender), "No risk profile NFT");

        // Get user's risk profile
        IRiskNFT.RiskProfile memory profile = riskNFT.getRiskProfile(msg.sender);

        // Transfer USDT from user
        depositToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate allocations based on risk profile
        uint256 lowRiskAmount = (amount * profile.lowPct) / 100;
        uint256 medRiskAmount = (amount * profile.medPct) / 100;
        uint256 highRiskAmount = (amount * profile.highPct) / 100;

        // Allocate to strategies
        _allocateToStrategies(0, lowRiskAmount);  // Low risk
        _allocateToStrategies(1, medRiskAmount);  // Medium risk
        _allocateToStrategies(2, highRiskAmount); // High risk

        // Update user deposit tracking
        UserDeposit storage userDep = userDeposits[msg.sender];
        userDep.totalDeposited += amount;
        userDep.lowRiskAmount += lowRiskAmount;
        userDep.medRiskAmount += medRiskAmount;
        userDep.highRiskAmount += highRiskAmount;
        userDep.depositTimestamp = block.timestamp;

        // Update tier tracking
        riskTiers[0].totalAllocated += lowRiskAmount;
        riskTiers[1].totalAllocated += medRiskAmount;
        riskTiers[2].totalAllocated += highRiskAmount;

        totalValueLocked += amount;

        // Mint AURA tokens 1:1 with deposited USDT
        _mint(msg.sender, amount);

        emit Deposited(
            msg.sender,
            amount,
            amount,
            lowRiskAmount,
            medRiskAmount,
            highRiskAmount
        );
    }

    /**
     * @notice Internal function to allocate funds to strategies in a risk tier
     * @param riskTier 0=Low, 1=Medium, 2=High
     * @param amount Total amount to allocate to this tier
     */
    function _allocateToStrategies(uint8 riskTier, uint256 amount) internal {
        if (amount == 0) return;

        StrategyAllocation[] storage strategies = riskTiers[riskTier].strategies;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 strategyAmount = (amount * strategies[i].allocationPct) / 100;
                
                if (strategyAmount > 0) {
                    // Approve and deposit to strategy
                    depositToken.approve(strategies[i].strategy, strategyAmount);
                    IStrategy(strategies[i].strategy).deposit(strategyAmount, address(this));
                }
            }
        }
    }

    // ============ WITHDRAWAL FUNCTION ============

    /**
     * @notice Withdraw USDT by burning AURA tokens
     * @param auraAmount Amount of AURA tokens to burn
     */
    function withdraw(uint256 auraAmount) external nonReentrant {
        require(auraAmount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= auraAmount, "Insufficient AURA balance");

        UserDeposit storage userDep = userDeposits[msg.sender];
        require(userDep.totalDeposited > 0, "No deposits");

        // Calculate proportional withdrawal from each risk tier
        uint256 totalUserDeposit = userDep.totalDeposited;
        
        uint256 lowRiskWithdraw = (userDep.lowRiskAmount * auraAmount) / totalUserDeposit;
        uint256 medRiskWithdraw = (userDep.medRiskAmount * auraAmount) / totalUserDeposit;
        uint256 highRiskWithdraw = (userDep.highRiskAmount * auraAmount) / totalUserDeposit;

        // Withdraw from strategies
        uint256 totalWithdrawn = 0;
        totalWithdrawn += _withdrawFromStrategies(0, lowRiskWithdraw);
        totalWithdrawn += _withdrawFromStrategies(1, medRiskWithdraw);
        totalWithdrawn += _withdrawFromStrategies(2, highRiskWithdraw);

        // Update user deposit tracking
        userDep.totalDeposited -= auraAmount;
        userDep.lowRiskAmount -= lowRiskWithdraw;
        userDep.medRiskAmount -= medRiskWithdraw;
        userDep.highRiskAmount -= highRiskWithdraw;

        // Update tier tracking
        riskTiers[0].totalAllocated -= lowRiskWithdraw;
        riskTiers[1].totalAllocated -= medRiskWithdraw;
        riskTiers[2].totalAllocated -= highRiskWithdraw;

        totalValueLocked -= auraAmount;

        // Burn AURA tokens
        _burn(msg.sender, auraAmount);

        // Transfer USDT to user
        depositToken.safeTransfer(msg.sender, totalWithdrawn);

        emit Withdrawn(msg.sender, auraAmount, totalWithdrawn);
    }

    /**
     * @notice Internal function to withdraw from strategies in a risk tier
     * @param riskTier 0=Low, 1=Medium, 2=High
     * @param amount Total amount to withdraw from this tier
     */
    function _withdrawFromStrategies(uint8 riskTier, uint256 amount) internal returns (uint256) {
        if (amount == 0) return 0;

        StrategyAllocation[] storage strategies = riskTiers[riskTier].strategies;
        uint256 totalWithdrawn = 0;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) {
                uint256 strategyAmount = (amount * strategies[i].allocationPct) / 100;
                
                if (strategyAmount > 0) {
                    uint256 withdrawn = IStrategy(strategies[i].strategy).withdraw(
                        strategyAmount,
                        address(this),
                        address(this)
                    );
                    totalWithdrawn += withdrawn;
                }
            }
        }
        
        return totalWithdrawn;
    }

    // ============ HARVEST & REBALANCE ============

    /**
     * @notice Harvest yields from all strategies
     */
    function harvestAll() external nonReentrant onlyOwner returns (uint256) {
        uint256 totalHarvestedAmount = 0;

        // Harvest from all risk tiers
        for (uint8 tier = 0; tier < 3; tier++) {
            StrategyAllocation[] storage strategies = riskTiers[tier].strategies;
            
            for (uint256 i = 0; i < strategies.length; i++) {
                if (strategies[i].active) {
                    uint256 harvested = IStrategy(strategies[i].strategy).harvest();
                    totalHarvestedAmount += harvested;
                }
            }
        }

        // Calculate performance fee
        uint256 performanceFee = (totalHarvestedAmount * performanceFeeBps) / 10000;
        uint256 netHarvest = totalHarvestedAmount - performanceFee;

        if (performanceFee > 0) {
            depositToken.safeTransfer(feeRecipient, performanceFee);
        }

        totalHarvested += netHarvest;
        lastHarvestTime = block.timestamp;

        emit Harvested(totalHarvestedAmount, performanceFee, block.timestamp);

        return netHarvest;
    }

    /**
     * @notice Rebalance funds across strategies (can be expanded for dynamic rebalancing)
     */
    function rebalance() external onlyOwner {
        // This can be expanded to implement dynamic rebalancing logic
        // For now, it's a placeholder that emits an event
        emit Rebalanced(block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get total assets under management
     */
    function totalAssets() external view returns (uint256) {
        uint256 total = 0;

        for (uint8 tier = 0; tier < 3; tier++) {
            StrategyAllocation[] storage strategies = riskTiers[tier].strategies;
            
            for (uint256 i = 0; i < strategies.length; i++) {
                if (strategies[i].active) {
                    total += IStrategy(strategies[i].strategy).totalAssets();
                }
            }
        }

        return total;
    }

    /**
     * @notice Get user's current position value
     */
    function getUserValue(address user) external view returns (uint256) {
        // Simplified: returns AURA balance (1:1 with initial deposit)
        // Can be enhanced to include proportional yield
        return balanceOf(user);
    }

    /**
     * @notice Get user's deposit details
     */
    function getUserDeposit(address user) external view returns (UserDeposit memory) {
        return userDeposits[user];
    }

    /**
     * @notice Get all strategies in a risk tier
     */
    function getRiskTierStrategies(uint8 riskTier) external view returns (StrategyAllocation[] memory) {
        require(riskTier < 3, "Invalid risk tier");
        return riskTiers[riskTier].strategies;
    }

    /**
     * @notice Get risk tier information
     */
    function getRiskTierInfo(uint8 riskTier) external view returns (
        string memory name,
        uint256 totalAllocated,
        uint256 strategyCount
    ) {
        require(riskTier < 3, "Invalid risk tier");
        return (
            riskTiers[riskTier].name,
            riskTiers[riskTier].totalAllocated,
            riskTiers[riskTier].strategies.length
        );
    }

    /**
     * @notice Get estimated vault APY (weighted average across all strategies)
     */
    function estimatedVaultAPY() external view returns (uint256) {
        uint256 totalWeightedAPY = 0;
        uint256 totalAssetValue = 0;

        for (uint8 tier = 0; tier < 3; tier++) {
            StrategyAllocation[] storage strategies = riskTiers[tier].strategies;
            
            for (uint256 i = 0; i < strategies.length; i++) {
                if (strategies[i].active) {
                    uint256 strategyAssets = IStrategy(strategies[i].strategy).totalAssets();
                    uint256 strategyAPY = IStrategy(strategies[i].strategy).estimatedAPY();
                    
                    totalWeightedAPY += strategyAssets * strategyAPY;
                    totalAssetValue += strategyAssets;
                }
            }
        }

        if (totalAssetValue == 0) return 0;
        return totalWeightedAPY / totalAssetValue;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set performance fee
     */
    function setPerformanceFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 2000, "Fee too high"); // Max 20%
        performanceFeeBps = _feeBps;
    }

    /**
     * @notice Set fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Emergency withdrawal from a specific strategy
     */
    function emergencyWithdrawStrategy(uint8 riskTier, uint256 strategyIndex) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(riskTier < 3, "Invalid risk tier");
        require(strategyIndex < riskTiers[riskTier].strategies.length, "Invalid index");
        
        address strategy = riskTiers[riskTier].strategies[strategyIndex].strategy;
        IStrategy(strategy).withdrawAll();
    }
}
