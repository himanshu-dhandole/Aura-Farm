// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MockUSDC.sol";
import "../src/RiskNFT.sol";
import "../src/LowRiskPool.sol";
import "../src/MedRiskPool.sol";
import "../src/HighRiskPool.sol";
import "../src/AuraFarmer.sol";

/**
 * @title AuraFarmerTest
 * @notice Comprehensive tests for the Aura Farmer protocol
 */
contract AuraFarmerTest is Test {
    MockUSDC public usdc;
    RiskNFT public riskNFT;
    LowRiskPool public lowPool;
    MedRiskPool public medPool;
    HighRiskPool public highPool;
    AuraFarmer public auraFarmer;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    uint256 constant INITIAL_MINT = 1_000_000e6; // 1M USDC (6 decimals)
    uint256 constant DEPOSIT_AMOUNT = 100e6; // 100 USDC

    function setUp() public {
        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy RiskNFT
        riskNFT = new RiskNFT();

        // Deploy risk pools
        lowPool = new LowRiskPool(usdc);
        medPool = new MedRiskPool(usdc);
        highPool = new HighRiskPool(usdc);

        // Deploy AuraFarmer
        auraFarmer = new AuraFarmer(
            usdc,
            riskNFT,
            lowPool,
            medPool,
            highPool
        );

        // Transfer ownership of RiskNFT to AuraFarmer
        riskNFT.transferOwnership(address(auraFarmer));

        // Mint USDC to users
        usdc.mint(user1, INITIAL_MINT);
        usdc.mint(user2, INITIAL_MINT);
        usdc.mint(user3, INITIAL_MINT);

        // Mint USDC to owner for yield simulation
        usdc.mint(owner, INITIAL_MINT);
    }

    // ============ NFT Minting Tests ============

    function testMintNFT() public {
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        vm.stopPrank();

        assertTrue(riskNFT.hasProfile(user1), "User should have NFT");
        
        RiskNFT.RiskProfile memory profile = riskNFT.getRiskProfile(user1);
        assertEq(profile.lowPct, 50, "Low risk percentage should be 50");
        assertEq(profile.medPct, 40, "Med risk percentage should be 40");
        assertEq(profile.highPct, 10, "High risk percentage should be 10");
    }

    function testMintNFTInvalidPercentages() public {
        vm.startPrank(user1);
        vm.expectRevert("RiskNFT: percentages must sum to 100");
        auraFarmer.mintNFT(50, 40, 20); // Sum = 110
        vm.stopPrank();
    }

    function testMintNFTDuplicate() public {
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        
        vm.expectRevert("RiskNFT: user already has NFT");
        auraFarmer.mintNFT(30, 40, 30);
        vm.stopPrank();
    }

    function testNFTSoulbound() public {
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        uint256 tokenId = riskNFT.getTokenId(user1);
        
        // Try to approve - should revert
        vm.expectRevert("RiskNFT: token is soulbound");
        riskNFT.approve(user2, tokenId);
        
        vm.stopPrank();
    }

    // ============ Deposit Tests ============

    function testDeposit() public {
        // Setup user1 with NFT
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        
        // Approve and deposit
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        uint256 shares = auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        // Check shares minted
        assertGt(shares, 0, "Should mint shares");
        assertEq(auraFarmer.balanceOf(user1), shares, "User should have shares");

        // Check allocation
        (uint256 lowAssets, uint256 medAssets, uint256 highAssets) = auraFarmer.getUserAllocation(user1);
        
        // Allow for rounding errors (±1)
        assertApproxEqAbs(lowAssets, 50e6, 1, "Low risk allocation should be ~50 USDC");
        assertApproxEqAbs(medAssets, 40e6, 1, "Med risk allocation should be ~40 USDC");
        assertApproxEqAbs(highAssets, 10e6, 1, "High risk allocation should be ~10 USDC");
    }

    function testDepositWithoutNFT() public {
        vm.startPrank(user1);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        
        vm.expectRevert("AuraFarmer: no risk profile");
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();
    }

    function testDepositMultipleUsers() public {
        // User1: 50/40/10 profile
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        // User2: 20/30/50 profile
        vm.startPrank(user2);
        auraFarmer.mintNFT(20, 30, 50);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user2);
        vm.stopPrank();

        // Check user1 allocation
        (uint256 low1, uint256 med1, uint256 high1) = auraFarmer.getUserAllocation(user1);
        assertApproxEqAbs(low1, 50e6, 1, "User1 low should be ~50");
        assertApproxEqAbs(med1, 40e6, 1, "User1 med should be ~40");
        assertApproxEqAbs(high1, 10e6, 1, "User1 high should be ~10");

        // Check user2 allocation
        (uint256 low2, uint256 med2, uint256 high2) = auraFarmer.getUserAllocation(user2);
        assertApproxEqAbs(low2, 20e6, 1, "User2 low should be ~20");
        assertApproxEqAbs(med2, 30e6, 1, "User2 med should be ~30");
        assertApproxEqAbs(high2, 50e6, 1, "User2 high should be ~50");
    }

    function testDepositZeroAmount() public {
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        
        vm.expectRevert("AuraFarmer: zero deposit");
        auraFarmer.deposit(0, user1);
        vm.stopPrank();
    }

    // ============ Withdrawal Tests ============

    function testWithdraw() public {
        // Setup and deposit
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);

        uint256 initialBalance = usdc.balanceOf(user1);

        // Withdraw half
        uint256 withdrawAmount = DEPOSIT_AMOUNT / 2;
        auraFarmer.withdraw(withdrawAmount, user1, user1);
        vm.stopPrank();

        uint256 finalBalance = usdc.balanceOf(user1);
        assertApproxEqAbs(
            finalBalance - initialBalance,
            withdrawAmount,
            2,
            "Should receive ~50 USDC"
        );

        // Check remaining allocation
        (uint256 lowAssets, uint256 medAssets, uint256 highAssets) = auraFarmer.getUserAllocation(user1);
        uint256 remaining = lowAssets + medAssets + highAssets;
        assertApproxEqAbs(remaining, withdrawAmount, 2, "Should have ~50 USDC remaining");
    }

    function testWithdrawAll() public {
        // Setup and deposit
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);

        uint256 initialBalance = usdc.balanceOf(user1);

        // Withdraw all
        uint256 userAssets = auraFarmer.userTotalAssets(user1);
        auraFarmer.withdraw(userAssets, user1, user1);
        vm.stopPrank();

        uint256 finalBalance = usdc.balanceOf(user1);
        assertApproxEqAbs(
            finalBalance - initialBalance,
            DEPOSIT_AMOUNT,
            2,
            "Should receive ~100 USDC"
        );

        // Check allocation is cleared
        (uint256 lowAssets, uint256 medAssets, uint256 highAssets) = auraFarmer.getUserAllocation(user1);
        assertEq(lowAssets + medAssets + highAssets, 0, "Should have no assets remaining");
    }

    function testRedeem() public {
        // Setup and deposit
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        uint256 shares = auraFarmer.deposit(DEPOSIT_AMOUNT, user1);

        uint256 initialBalance = usdc.balanceOf(user1);

        // Redeem half of shares
        uint256 redeemShares = shares / 2;
        auraFarmer.redeem(redeemShares, user1, user1);
        vm.stopPrank();

        uint256 finalBalance = usdc.balanceOf(user1);
        assertApproxEqAbs(
            finalBalance - initialBalance,
            DEPOSIT_AMOUNT / 2,
            2,
            "Should receive ~50 USDC"
        );
    }

    // ============ Yield Simulation Tests ============

    function testSimulateYield() public {
        // Setup and deposit
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        uint256 assetsBeforeYield = auraFarmer.userTotalAssets(user1);

        // Simulate 10% yield in low risk pool
        // First, mint USDC to low pool for yield simulation
        uint256 lowPoolAssets = lowPool.totalAssets();
        uint256 yieldAmount = (lowPoolAssets * 1000) / 10000; // 10%
        usdc.mint(address(lowPool), yieldAmount);

        uint256 assetsAfterYield = auraFarmer.userTotalAssets(user1);

        // User should have more assets now (they have 50% in low pool)
        assertGt(assetsAfterYield, assetsBeforeYield, "Assets should increase after yield");
    }

    function testYieldInMultiplePools() public {
        // Setup and deposit
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        uint256 assetsBeforeYield = auraFarmer.userTotalAssets(user1);

        // Simulate yield in all pools
        uint256 lowPoolAssets = lowPool.totalAssets();
        uint256 medPoolAssets = medPool.totalAssets();
        uint256 highPoolAssets = highPool.totalAssets();

        usdc.mint(address(lowPool), (lowPoolAssets * 700) / 10000); // 7%
        usdc.mint(address(medPool), (medPoolAssets * 1200) / 10000); // 12%
        usdc.mint(address(highPool), (highPoolAssets * 2000) / 10000); // 20%

        uint256 assetsAfterYield = auraFarmer.userTotalAssets(user1);

        // Calculate expected increase
        // Low: 50 * 1.07 = 53.5
        // Med: 40 * 1.12 = 44.8
        // High: 10 * 1.20 = 12
        // Total: 110.3
        uint256 expectedIncrease = 10.3e6;

        assertApproxEqAbs(
            assetsAfterYield - assetsBeforeYield,
            expectedIncrease,
            1e5, // Allow 0.1 USDC tolerance
            "Yield should match expected increase"
        );
    }

    // ============ ERC4626 Compliance Tests ============

    function testTotalAssets() public {
        // Initially zero
        assertEq(auraFarmer.totalAssets(), 0, "Should start with 0 assets");

        // After user1 deposits
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        assertApproxEqAbs(
            auraFarmer.totalAssets(),
            DEPOSIT_AMOUNT,
            1,
            "Total assets should be ~100 USDC"
        );

        // After user2 deposits
        vm.startPrank(user2);
        auraFarmer.mintNFT(20, 30, 50);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user2);
        vm.stopPrank();

        assertApproxEqAbs(
            auraFarmer.totalAssets(),
            DEPOSIT_AMOUNT * 2,
            2,
            "Total assets should be ~200 USDC"
        );
    }

    function testPreviewFunctions() public {
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        
        uint256 previewedShares = auraFarmer.previewDeposit(DEPOSIT_AMOUNT);
        uint256 actualShares = auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        
        assertEq(previewedShares, actualShares, "Preview should match actual");
        
        uint256 previewedAssets = auraFarmer.previewRedeem(actualShares);
        assertApproxEqAbs(
            previewedAssets,
            DEPOSIT_AMOUNT,
            1,
            "Preview redeem should match deposit"
        );
        vm.stopPrank();
    }

    // ============ Edge Cases Tests ============

    function testLargeDeposit() public {
        uint256 largeAmount = 10_000e6; // 10,000 USDC
        
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), largeAmount);
        auraFarmer.deposit(largeAmount, user1);
        vm.stopPrank();

        (uint256 lowAssets, uint256 medAssets, uint256 highAssets) = auraFarmer.getUserAllocation(user1);
        
        assertApproxEqAbs(lowAssets, 5_000e6, 1, "Low should be ~5000");
        assertApproxEqAbs(medAssets, 4_000e6, 1, "Med should be ~4000");
        assertApproxEqAbs(highAssets, 1_000e6, 1, "High should be ~1000");
    }

    function testSmallDeposit() public {
        uint256 smallAmount = 1e6; // 1 USDC
        
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        usdc.approve(address(auraFarmer), smallAmount);
        uint256 shares = auraFarmer.deposit(smallAmount, user1);
        vm.stopPrank();

        assertGt(shares, 0, "Should mint shares even for small deposit");
        
        uint256 userAssets = auraFarmer.userTotalAssets(user1);
        assertApproxEqAbs(userAssets, smallAmount, 1, "User assets should be ~1 USDC");
    }

    function testExtremeRiskProfiles() public {
        // Test 100% low risk
        vm.startPrank(user1);
        auraFarmer.mintNFT(100, 0, 0);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        (uint256 low1, uint256 med1, uint256 high1) = auraFarmer.getUserAllocation(user1);
        assertApproxEqAbs(low1, DEPOSIT_AMOUNT, 1, "All should be in low risk");
        assertEq(med1, 0, "Med should be 0");
        assertEq(high1, 0, "High should be 0");

        // Test 100% high risk
        vm.startPrank(user2);
        auraFarmer.mintNFT(0, 0, 100);
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user2);
        vm.stopPrank();

        (uint256 low2, uint256 med2, uint256 high2) = auraFarmer.getUserAllocation(user2);
        assertEq(low2, 0, "Low should be 0");
        assertEq(med2, 0, "Med should be 0");
        assertApproxEqAbs(high2, DEPOSIT_AMOUNT, 1, "All should be in high risk");
    }

    function testMultipleDepositsAndWithdrawals() public {
        vm.startPrank(user1);
        auraFarmer.mintNFT(50, 40, 10);
        
        // First deposit
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        
        // Second deposit
        usdc.approve(address(auraFarmer), DEPOSIT_AMOUNT);
        auraFarmer.deposit(DEPOSIT_AMOUNT, user1);
        
        uint256 totalAssets = auraFarmer.userTotalAssets(user1);
        assertApproxEqAbs(totalAssets, DEPOSIT_AMOUNT * 2, 2, "Should have ~200 USDC");
        
        // Partial withdrawal
        auraFarmer.withdraw(DEPOSIT_AMOUNT, user1, user1);
        
        totalAssets = auraFarmer.userTotalAssets(user1);
        assertApproxEqAbs(totalAssets, DEPOSIT_AMOUNT, 2, "Should have ~100 USDC");
        
        // Final withdrawal
        auraFarmer.withdraw(totalAssets, user1, user1);
        
        totalAssets = auraFarmer.userTotalAssets(user1);
        assertEq(totalAssets, 0, "Should have 0 USDC");
        
        vm.stopPrank();
    }

    // ============ Pool APY Tests ============

    function testPoolAPYs() public {
        assertEq(lowPool.expectedAPY(), 700, "Low pool should have 7% APY");
        assertEq(medPool.expectedAPY(), 1200, "Med pool should have 12% APY");
        assertEq(highPool.expectedAPY(), 2000, "High pool should have 20% APY");
    }

    function testPoolRiskCategories() public {
        assertEq(lowPool.getRiskCategory(), "Low Risk", "Low pool category");
        assertEq(medPool.getRiskCategory(), "Medium Risk", "Med pool category");
        assertEq(highPool.getRiskCategory(), "High Risk", "High pool category");
    }
}
