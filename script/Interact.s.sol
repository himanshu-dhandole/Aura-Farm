// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/RiskNFT.sol";
import "../src/AuraFarmer.sol";

/**
 * @title Interact
 * @notice Script for interacting with deployed Aura Farmer contracts
 * @dev Usage: forge script script/Interact.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract Interact is Script {
    // Update these addresses after deployment
    address constant MOCKUSDC_ADDRESS = address(0); // UPDATE THIS
    address constant RISKNFT_ADDRESS = address(0); // UPDATE THIS
    address constant AURAFARMER_ADDRESS = address(0); // UPDATE THIS

    function run() external {
        require(AURAFARMER_ADDRESS != address(0), "Update contract addresses first!");
        
        uint256 userPrivateKey = vm.envUint("PRIVATE_KEY");
        address userAddress = vm.addr(userPrivateKey);
        
        MockUSDC usdc = MockUSDC(MOCKUSDC_ADDRESS);
        AuraFarmer auraFarmer = AuraFarmer(AURAFARMER_ADDRESS);
        RiskNFT riskNFT = RiskNFT(RISKNFT_ADDRESS);

        vm.startBroadcast(userPrivateKey);

        console.log("User address:", userAddress);
        console.log("\n=== Step 1: Check USDC Balance ===");
        uint256 balance = usdc.balanceOf(userAddress);
        console.log("USDC Balance:", balance / 1e6, "USDC");

        // If balance is low, mint more (only if you're the owner)
        if (balance < 100e6) {
            console.log("\n=== Minting 1000 USDC ===");
            try usdc.mint(userAddress, 1000e6) {
                console.log("Minted 1000 USDC successfully");
            } catch {
                console.log("Note: Only owner can mint. Request USDC from deployer.");
            }
        }

        console.log("\n=== Step 2: Check Risk Profile ===");
        bool hasProfile = riskNFT.hasProfile(userAddress);
        console.log("Has Risk Profile:", hasProfile);

        if (!hasProfile) {
            console.log("\n=== Minting Risk Profile NFT ===");
            console.log("Profile: 50% Low, 40% Medium, 10% High");
            auraFarmer.mintNFT(50, 40, 10);
            console.log("NFT minted successfully!");
        } else {
            RiskNFT.RiskProfile memory profile = riskNFT.getRiskProfile(userAddress);
            console.log("Current Profile:");
            console.log("  Low Risk:    ", profile.lowPct, "%");
            console.log("  Medium Risk: ", profile.medPct, "%");
            console.log("  High Risk:   ", profile.highPct, "%");
        }

        console.log("\n=== Step 3: Approve USDC ===");
        uint256 depositAmount = 100e6; // 100 USDC
        usdc.approve(address(auraFarmer), depositAmount);
        console.log("Approved", depositAmount / 1e6, "USDC");

        console.log("\n=== Step 4: Deposit ===");
        uint256 sharesBefore = auraFarmer.balanceOf(userAddress);
        auraFarmer.deposit(depositAmount, userAddress);
        uint256 sharesAfter = auraFarmer.balanceOf(userAddress);
        console.log("Deposited", depositAmount / 1e6, "USDC");
        console.log("Received", sharesAfter - sharesBefore, "shares");

        console.log("\n=== Step 5: Check Allocation ===");
        (uint256 lowAssets, uint256 medAssets, uint256 highAssets) = auraFarmer.getUserAllocation(userAddress);
        console.log("Low Risk Pool:    ", lowAssets / 1e6, "USDC");
        console.log("Medium Risk Pool: ", medAssets / 1e6, "USDC");
        console.log("High Risk Pool:   ", highAssets / 1e6, "USDC");
        
        uint256 totalAssets = auraFarmer.userTotalAssets(userAddress);
        console.log("Total Assets:     ", totalAssets / 1e6, "USDC");

        vm.stopBroadcast();

        console.log("\n=== Success! ===");
        console.log("Your funds are now invested in Aura Farmer!");
        console.log("\nNext steps:");
        console.log("1. Wait for yield to accumulate (or simulate with owner account)");
        console.log("2. Check your balance periodically");
        console.log("3. Withdraw anytime with: auraFarmer.withdraw(amount, address, address)");
    }

    /**
     * @notice Simulate yield (only for owner/testing)
     * @dev Requires being the MockUSDC owner
     */
    function simulateYield() external {
        require(AURAFARMER_ADDRESS != address(0), "Update contract addresses first!");
        
        uint256 ownerPrivateKey = vm.envUint("PRIVATE_KEY");
        MockUSDC usdc = MockUSDC(MOCKUSDC_ADDRESS);
        
        // You'll need to know the pool addresses
        // This is just an example - update with actual pool addresses
        address lowPoolAddress = address(0); // UPDATE
        address medPoolAddress = address(0); // UPDATE
        address highPoolAddress = address(0); // UPDATE

        vm.startBroadcast(ownerPrivateKey);

        console.log("=== Simulating Yield ===");
        
        // Simulate 1 month of yield
        // Low: 7% APY = 0.58% monthly
        // Med: 12% APY = 1% monthly  
        // High: 20% APY = 1.67% monthly

        if (lowPoolAddress != address(0)) {
            BasePool lowPool = BasePool(lowPoolAddress);
            uint256 lowAssets = lowPool.totalAssets();
            uint256 lowYield = (lowAssets * 58) / 10000; // 0.58%
            usdc.mint(lowPoolAddress, lowYield);
            console.log("Low pool yield:    ", lowYield / 1e6, "USDC");
        }

        if (medPoolAddress != address(0)) {
            BasePool medPool = BasePool(medPoolAddress);
            uint256 medAssets = medPool.totalAssets();
            uint256 medYield = (medAssets * 100) / 10000; // 1%
            usdc.mint(medPoolAddress, medYield);
            console.log("Medium pool yield: ", medYield / 1e6, "USDC");
        }

        if (highPoolAddress != address(0)) {
            BasePool highPool = BasePool(highPoolAddress);
            uint256 highAssets = highPool.totalAssets();
            uint256 highYield = (highAssets * 167) / 10000; // 1.67%
            usdc.mint(highPoolAddress, highYield);
            console.log("High pool yield:   ", highYield / 1e6, "USDC");
        }

        vm.stopBroadcast();

        console.log("Yield simulated successfully!");
    }
}
