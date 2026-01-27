// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/RiskNFT.sol";
import "../src/LowRiskPool.sol";
import "../src/MedRiskPool.sol";
import "../src/HighRiskPool.sol";
import "../src/AuraFarmer.sol";

/**
 * @title Deploy
 * @notice Deployment script for Aura Farmer protocol to Sepolia testnet
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy RiskNFT
        RiskNFT riskNFT = new RiskNFT();
        console.log("RiskNFT deployed at:", address(riskNFT));

        // 3. Deploy Risk Pools
        LowRiskPool lowPool = new LowRiskPool(usdc);
        console.log("LowRiskPool deployed at:", address(lowPool));

        MedRiskPool medPool = new MedRiskPool(usdc);
        console.log("MedRiskPool deployed at:", address(medPool));

        HighRiskPool highPool = new HighRiskPool(usdc);
        console.log("HighRiskPool deployed at:", address(highPool));

        // 4. Deploy AuraFarmer
        AuraFarmer auraFarmer = new AuraFarmer(
            usdc,
            riskNFT,
            lowPool,
            medPool,
            highPool
        );
        console.log("AuraFarmer deployed at:", address(auraFarmer));

        // 5. Transfer ownership of RiskNFT to AuraFarmer
        riskNFT.transferOwnership(address(auraFarmer));
        console.log("RiskNFT ownership transferred to AuraFarmer");

        // 6. Mint initial USDC for testing (optional)
        uint256 initialMint = 1_000_000e6; // 1M USDC for deployer
        usdc.mint(msg.sender, initialMint);
        console.log("Minted", initialMint / 1e6, "USDC to deployer");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("Deployer:", msg.sender);
        console.log("\nContract Addresses:");
        console.log("-------------------");
        console.log("MockUSDC:      ", address(usdc));
        console.log("RiskNFT:       ", address(riskNFT));
        console.log("LowRiskPool:   ", address(lowPool));
        console.log("MedRiskPool:   ", address(medPool));
        console.log("HighRiskPool:  ", address(highPool));
        console.log("AuraFarmer:    ", address(auraFarmer));
        console.log("\n=== Next Steps ===");
        console.log("1. Verify contracts on Etherscan");
        console.log("2. Mint risk profile NFT: auraFarmer.mintNFT(50, 40, 10)");
        console.log("3. Approve USDC: usdc.approve(auraFarmer, amount)");
        console.log("4. Deposit: auraFarmer.deposit(amount, yourAddress)");
    }
}
