// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VirtualUSDT.sol";
import "../src/RiskNFT.sol";
import "../src/AuraVault.sol";
import "../src/strategies/low-risk/BTCStrategy.sol";
import "../src/strategies/low-risk/ETHStrategy.sol";
import "../src/strategies/low-risk/BlueChipStrategy.sol";
import "../src/strategies/medium-risk/DeFiLendingStrategy.sol";
import "../src/strategies/medium-risk/AltcoinStakingStrategy.sol";
import "../src/strategies/high-risk/LeveragedYieldStrategy.sol";
import "../src/strategies/high-risk/MemecoinFarmingStrategy.sol";

contract AuraProtocolComprehensiveTest is Test {
    VirtualUSDT public vUSDT;
    RiskNFT public riskNFT;
    AuraVault public vault;
    
    // Strategies
    BTCStrategy public btcStrategy;
    ETHStrategy public ethStrategy;
    BlueChipStrategy public blueChipStrategy;
    DeFiLendingStrategy public defiLendingStrategy;
    AltcoinStakingStrategy public altcoinStakingStrategy;
    LeveragedYieldStrategy public leveragedYieldStrategy;
    MemecoinFarmingStrategy public memecoinFarmingStrategy;

    address public owner;
    address public user1;
    address public user2;
    address public user3;
    address public user4;
    address public user5;

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

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        user4 = makeAddr("user4");
        user5 = makeAddr("user5");

        // Deploy core contracts
        vUSDT = new VirtualUSDT();
        riskNFT = new RiskNFT();
        vault = new AuraVault(address(vUSDT), address(riskNFT), owner);

        // Deploy Low Risk Strategies
        btcStrategy = new BTCStrategy(vUSDT);
        btcStrategy.setVault(address(vault));
        
        ethStrategy = new ETHStrategy(vUSDT);
        ethStrategy.setVault(address(vault));
        
        blueChipStrategy = new BlueChipStrategy(vUSDT);
        blueChipStrategy.setVault(address(vault));

        // Deploy Medium Risk Strategies
        defiLendingStrategy = new DeFiLendingStrategy(vUSDT);
        defiLendingStrategy.setVault(address(vault));
        
        altcoinStakingStrategy = new AltcoinStakingStrategy(vUSDT);
        altcoinStakingStrategy.setVault(address(vault));

        // Deploy High Risk Strategies
        leveragedYieldStrategy = new LeveragedYieldStrategy(vUSDT);
        leveragedYieldStrategy.setVault(address(vault));
        
        memecoinFarmingStrategy = new MemecoinFarmingStrategy(vUSDT);
        memecoinFarmingStrategy.setVault(address(vault));

        // Configure Low Risk Tier (60% BTC, 20% ETH, 20% BlueChip)
        vault.addStrategy(0, address(btcStrategy), 60);
        vault.addStrategy(0, address(ethStrategy), 20);
        vault.addStrategy(0, address(blueChipStrategy), 20);

        // Configure Medium Risk Tier (60% DeFi, 40% Altcoin)
        vault.addStrategy(1, address(defiLendingStrategy), 60);
        vault.addStrategy(1, address(altcoinStakingStrategy), 40);

        // Configure High Risk Tier (70% Leveraged, 30% Memecoin)
        vault.addStrategy(2, address(leveragedYieldStrategy), 70);
        vault.addStrategy(2, address(memecoinFarmingStrategy), 30);
    }

    // ============ TEST 1: Aggressive Profile Deposit ============
    function test_AggressiveProfileDeposit() public {
        console.log("\n=== TEST 1: Aggressive Profile (10% Low, 20% Med, 70% High) ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        vUSDT.mint(user1, 1000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        
        vm.expectEmit(true, true, true, true);
        emit Deposited(user1, 1000e18, 1000e18, 100e18, 200e18, 700e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        assertEq(vault.balanceOf(user1), 1000e18, "Should receive 1000 AURA");
        
        AuraVault.UserDeposit memory userDep = vault.getUserDeposit(user1);
        assertEq(userDep.totalDeposited, 1000e18);
        assertEq(userDep.lowRiskAmount, 100e18);
        assertEq(userDep.medRiskAmount, 200e18);
        assertEq(userDep.highRiskAmount, 700e18);

        console.log("BTC Strategy: %s USDT (Expected: 60)", btcStrategy.totalAssets() / 1e18);
        console.log("ETH Strategy: %s USDT (Expected: 20)", ethStrategy.totalAssets() / 1e18);
        console.log("BlueChip Strategy: %s USDT (Expected: 20)", blueChipStrategy.totalAssets() / 1e18);
        
        console.log("DeFi Lending: %s USDT (Expected: 120)", defiLendingStrategy.totalAssets() / 1e18);
        console.log("Altcoin Staking: %s USDT (Expected: 80)", altcoinStakingStrategy.totalAssets() / 1e18);
        
        console.log("Leveraged Yield: %s USDT (Expected: 490)", leveragedYieldStrategy.totalAssets() / 1e18);
        console.log("Memecoin Farming: %s USDT (Expected: 210)", memecoinFarmingStrategy.totalAssets() / 1e18);
    }

    // ============ TEST 2: Conservative Profile Deposit ============
    function test_ConservativeProfileDeposit() public {
        console.log("\n=== TEST 2: Conservative Profile (50% Low, 30% Med, 20% High) ===");
        
        riskNFT.mint(user2, 50, 30, 20);
        vUSDT.mint(user2, 1000e18);
        
        vm.startPrank(user2);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        assertEq(vault.balanceOf(user2), 1000e18);
        
        AuraVault.UserDeposit memory userDep = vault.getUserDeposit(user2);
        assertEq(userDep.lowRiskAmount, 500e18);
        assertEq(userDep.medRiskAmount, 300e18);
        assertEq(userDep.highRiskAmount, 200e18);

        console.log("BTC Strategy: %s USDT (Expected: 300)", btcStrategy.totalAssets() / 1e18);
        console.log("ETH Strategy: %s USDT (Expected: 100)", ethStrategy.totalAssets() / 1e18);
        console.log("BlueChip Strategy: %s USDT (Expected: 100)", blueChipStrategy.totalAssets() / 1e18);
        
        console.log("DeFi Lending: %s USDT (Expected: 180)", defiLendingStrategy.totalAssets() / 1e18);
        console.log("Altcoin Staking: %s USDT (Expected: 120)", altcoinStakingStrategy.totalAssets() / 1e18);
        
        console.log("Leveraged Yield: %s USDT (Expected: 140)", leveragedYieldStrategy.totalAssets() / 1e18);
        console.log("Memecoin Farming: %s USDT (Expected: 60)", memecoinFarmingStrategy.totalAssets() / 1e18);
    }

    // ============ TEST 3: Balanced Profile Deposit ============
    function test_BalancedProfileDeposit() public {
        console.log("\n=== TEST 3: Balanced Profile (30% Low, 40% Med, 30% High) ===");
        
        riskNFT.mint(user3, 30, 40, 30);
        vUSDT.mint(user3, 2000e18);
        
        vm.startPrank(user3);
        vUSDT.approve(address(vault), 2000e18);
        vault.deposit(2000e18);
        vm.stopPrank();

        assertEq(vault.balanceOf(user3), 2000e18);
        
        AuraVault.UserDeposit memory userDep = vault.getUserDeposit(user3);
        assertEq(userDep.lowRiskAmount, 600e18);
        assertEq(userDep.medRiskAmount, 800e18);
        assertEq(userDep.highRiskAmount, 600e18);

        console.log("Balanced profile deposit successful");
    }

    // ============ TEST 4: Multiple Deposits ============
    function test_MultipleDepositsFromSameUser() public {
        console.log("\n=== TEST 4: Multiple Deposits from Same User ===");
        
        riskNFT.mint(user1, 20, 30, 50);
        vUSDT.mint(user1, 5000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 5000e18);
        
        vault.deposit(1000e18);
        console.log("After first deposit: %s AURA", vault.balanceOf(user1) / 1e18);
        
        vault.deposit(2000e18);
        console.log("After second deposit: %s AURA", vault.balanceOf(user1) / 1e18);
        
        vault.deposit(2000e18);
        console.log("After third deposit: %s AURA", vault.balanceOf(user1) / 1e18);
        
        vm.stopPrank();
    }

    // ============ TEST 5: Partial Withdrawal ============
    function test_PartialWithdrawal() public {
        console.log("\n=== TEST 5: Partial Withdrawal ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        vUSDT.mint(user1, 1000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        
        uint256 balanceBefore = vUSDT.balanceOf(user1);
        vault.withdraw(500e18);
        uint256 balanceAfter = vUSDT.balanceOf(user1);
        vm.stopPrank();

        uint256 received = balanceAfter - balanceBefore;
        console.log("USDT received: %s", received / 1e18);
    }

    // ============ TEST 6: Full Withdrawal ============
    function test_FullWithdrawal() public {
        console.log("\n=== TEST 6: Full Withdrawal ===");
        
        riskNFT.mint(user1, 25, 25, 50);
        vUSDT.mint(user1, 1000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        
        vault.withdraw(1000e18);
        vm.stopPrank();

        console.log("After full withdrawal: %s AURA", vault.balanceOf(user1) / 1e18);
    }

    // ============ TEST 7: Multiple Users ============
    function test_MultipleUsersDifferentProfiles() public {
        console.log("\n=== TEST 7: Multiple Users with Different Profiles ===");
        
        riskNFT.mint(user1, 70, 20, 10);
        vUSDT.mint(user1, 1000e18);
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        riskNFT.mint(user2, 50, 30, 20);
        vUSDT.mint(user2, 2000e18);
        vm.startPrank(user2);
        vUSDT.approve(address(vault), 2000e18);
        vault.deposit(2000e18);
        vm.stopPrank();

        riskNFT.mint(user3, 30, 40, 30);
        vUSDT.mint(user3, 1500e18);
        vm.startPrank(user3);
        vUSDT.approve(address(vault), 1500e18);
        vault.deposit(1500e18);
        vm.stopPrank();

        console.log("Total Supply: %s AURA", vault.totalSupply() / 1e18);
        console.log("Total TVL: %s USDT", vault.totalValueLocked() / 1e18);
    }

    // ============ TEST 8: Yield Generation ============
    function test_YieldGenerationOverTime() public {
        console.log("\n=== TEST 8: Yield Generation Over Time ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        vUSDT.mint(user1, 1000e18);
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        uint256 before = vault.totalAssets();
        console.log("Assets before: %s USDT", before / 1e18);

        vm.warp(block.timestamp + 30 days);
        uint256 after1 = vault.totalAssets();
        console.log("Assets after 30d: %s USDT", after1 / 1e18);
    }

    // ============ TEST 9: Harvest ============
    function test_HarvestYields() public {
        console.log("\n=== TEST 9: Harvest Yields ===");
        
        riskNFT.mint(user1, 20, 30, 50);
        vUSDT.mint(user1, 5000e18);
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 5000e18);
        vault.deposit(5000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        uint256 harvested = vault.harvestAll();
        console.log("Harvested: %s USDT", harvested / 1e18);
    }

    // ============ TEST 10: Strategy APY ============
    function test_StrategyAPYDifferences() public {
        console.log("\n=== TEST 10: Strategy APY Differences ===");
        
        console.log("BTC APY: %s bps", btcStrategy.estimatedAPY());
        console.log("ETH APY: %s bps", ethStrategy.estimatedAPY());
        console.log("BlueChip APY: %s bps", blueChipStrategy.estimatedAPY());
        
        console.log("DeFi Lending APY: %s bps", defiLendingStrategy.estimatedAPY());
        console.log("Altcoin Staking APY: %s bps", altcoinStakingStrategy.estimatedAPY());
        
        console.log("Leveraged Yield APY: %s bps", leveragedYieldStrategy.estimatedAPY());
        console.log("Memecoin Farming APY: %s bps", memecoinFarmingStrategy.estimatedAPY());
    }

      // ============ TEST 11: Revert - No Risk NFT ============
    function test_RevertNoRiskNFT() public {
        console.log("\n=== TEST 11: Revert - No Risk NFT ===");
        
        vUSDT.mint(user1, 1000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vm.expectRevert("No risk profile NFT");
        vault.deposit(1000e18);
        vm.stopPrank();

        console.log("Correctly reverted without Risk NFT");
    }

    // ============ TEST 12: Revert - Zero Deposit ============
    function test_RevertZeroDeposit() public {
        console.log("\n=== TEST 12: Revert - Zero Deposit ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        
        vm.startPrank(user1);
        vm.expectRevert("Amount must be > 0");
        vault.deposit(0);
        vm.stopPrank();

        console.log("Correctly reverted zero deposit");
    }

    // ============ TEST 13: Revert - Insufficient AURA ============
    function test_RevertInsufficientAURABalance() public {
        console.log("\n=== TEST 13: Revert - Insufficient AURA Balance ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        vUSDT.mint(user1, 1000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.expectRevert("Insufficient AURA balance");
        vault.withdraw(2000e18);
        vm.stopPrank();

        console.log("Correctly reverted insufficient AURA");
    }

    // ============ TEST 14: Edge Case - 100% Low Risk ============
    function test_EdgeCase100PercentLowRisk() public {
        console.log("\n=== TEST 14: Edge Case - 100% Low Risk ===");
        
        riskNFT.mint(user1, 100, 0, 0);
        vUSDT.mint(user1, 1000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        AuraVault.UserDeposit memory dep = vault.getUserDeposit(user1);
        console.log("Low Risk Allocation: %s USDT", dep.lowRiskAmount / 1e18);
    }

    // ============ TEST 15: Edge Case - 100% High Risk ============
    function test_EdgeCase100PercentHighRisk() public {
        console.log("\n=== TEST 15: Edge Case - 100% High Risk ===");
        
        riskNFT.mint(user2, 0, 0, 100);
        vUSDT.mint(user2, 1000e18);
        
        vm.startPrank(user2);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        AuraVault.UserDeposit memory dep = vault.getUserDeposit(user2);
        console.log("High Risk Allocation: %s USDT", dep.highRiskAmount / 1e18);
    }

    // ============ TEST 16: Large Deposit ============
    function test_LargeDepositAmounts() public {
        console.log("\n=== TEST 16: Large Deposit Amounts ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        uint256 largeAmount = 1_000_000e18;
        vUSDT.mint(user1, largeAmount);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), largeAmount);
        vault.deposit(largeAmount);
        vm.stopPrank();

        console.log("Deposited: %s USDT", largeAmount / 1e18);
    }

    // ============ TEST 17: Small Deposit ============
    function test_SmallDepositAmounts() public {
        console.log("\n=== TEST 17: Small Deposit Amounts ===");
        
        riskNFT.mint(user1, 10, 20, 70);
        uint256 smallAmount = 1e18;
        vUSDT.mint(user1, smallAmount);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), smallAmount);
        vault.deposit(smallAmount);
        vm.stopPrank();

        console.log("Deposited: %s USDT", smallAmount / 1e18);
    }

    // ============ TEST 18: Sequential Deposits/Withdrawals ============
    function test_SequentialDepositsAndWithdrawals() public {
        console.log("\n=== TEST 18: Sequential Deposits and Withdrawals ===");
        
        riskNFT.mint(user1, 20, 30, 50);
        vUSDT.mint(user1, 10000e18);
        
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 10000e18);

        vault.deposit(1000e18);
        console.log("After deposit 1000: %s AURA", vault.balanceOf(user1) / 1e18);

        vault.deposit(2000e18);
        console.log("After deposit 2000: %s AURA", vault.balanceOf(user1) / 1e18);

        vault.withdraw(500e18);
        console.log("After withdraw 500: %s AURA", vault.balanceOf(user1) / 1e18);

        vault.deposit(3000e18);
        console.log("After deposit 3000: %s AURA", vault.balanceOf(user1) / 1e18);

        vault.withdraw(2000e18);
        console.log("After withdraw 2000: %s AURA", vault.balanceOf(user1) / 1e18);

        vm.stopPrank();
    }

    // ============ TEST 19: Vault Total Assets ============
    function test_VaultTotalAssetsTracking() public {
        console.log("\n=== TEST 19: Vault Total Assets Tracking ===");
        
        riskNFT.mint(user1, 50, 30, 20);
        vUSDT.mint(user1, 1000e18);
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        riskNFT.mint(user2, 30, 40, 30);
        vUSDT.mint(user2, 2000e18);
        vm.startPrank(user2);
        vUSDT.approve(address(vault), 2000e18);
        vault.deposit(2000e18);
        vm.stopPrank();

        riskNFT.mint(user3, 10, 20, 70);
        vUSDT.mint(user3, 1500e18);
        vm.startPrank(user3);
        vUSDT.approve(address(vault), 1500e18);
        vault.deposit(1500e18);
        vm.stopPrank();

        console.log("Total Assets: %s USDT", vault.totalAssets() / 1e18);
    }

    // ============ TEST 20: Estimated Vault APY ============
    function test_EstimatedVaultAPY() public {
        console.log("\n=== TEST 20: Estimated Vault APY ===");
        
        riskNFT.mint(user1, 30, 40, 30);
        vUSDT.mint(user1, 10000e18);
        vm.startPrank(user1);
        vUSDT.approve(address(vault), 10000e18);
        vault.deposit(10000e18);
        vm.stopPrank();

        uint256 vaultAPY = vault.estimatedVaultAPY();
        console.log("Estimated Vault APY: %s bps", vaultAPY);
        console.log("Estimated Vault APY: %s %%", vaultAPY / 100);
    }
}

