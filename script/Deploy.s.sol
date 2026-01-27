// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
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

/**
 * @title DeployAuraProtocol
 * @notice Comprehensive deployment script for the entire Aura Protocol
 */
contract DeployAuraProtocol is Script {
    // Contracts
    VirtualUSDT public vUSDT;
    RiskNFT public riskNFT;
    AuraVault public vault;
    
    // Low Risk Strategies
    BTCStrategy public btcStrategy;
    ETHStrategy public ethStrategy;
    BlueChipStrategy public blueChipStrategy;
    
    // Medium Risk Strategies
    DeFiLendingStrategy public defiLendingStrategy;
    AltcoinStakingStrategy public altcoinStakingStrategy;
    
    // High Risk Strategies
    LeveragedYieldStrategy public leveragedYieldStrategy;
    MemecoinFarmingStrategy public memecoinFarmingStrategy;

    address public deployer;
    address public feeRecipient;

    function run() external {
        deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        feeRecipient = deployer; // Can be changed to treasury address
        
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        console.log("====================================");
        console.log("Deploying Aura Protocol");
        console.log("Deployer:", deployer);
        console.log("====================================");

        // Step 1: Deploy VirtualUSDT
        console.log("\n1. Deploying VirtualUSDT...");
        vUSDT = new VirtualUSDT();
        console.log("VirtualUSDT deployed at:", address(vUSDT));

        // Step 2: Deploy RiskNFT
        console.log("\n2. Deploying RiskNFT...");
        riskNFT = new RiskNFT();
        console.log("RiskNFT deployed at:", address(riskNFT));

        // Step 3: Deploy AuraVault
        console.log("\n3. Deploying AuraVault...");
        vault = new AuraVault(
            address(vUSDT),
            address(riskNFT),
            feeRecipient
        );
        console.log("AuraVault deployed at:", address(vault));

        // Step 4: Deploy Low Risk Strategies
        console.log("\n4. Deploying Low Risk Strategies...");
        
        btcStrategy = new BTCStrategy(vUSDT);
        console.log("BTCStrategy deployed at:", address(btcStrategy));
        btcStrategy.setVault(address(vault));
        
        ethStrategy = new ETHStrategy(vUSDT);
        console.log("ETHStrategy deployed at:", address(ethStrategy));
        ethStrategy.setVault(address(vault));
        
        blueChipStrategy = new BlueChipStrategy(vUSDT);
        console.log("BlueChipStrategy deployed at:", address(blueChipStrategy));
        blueChipStrategy.setVault(address(vault));

        // Step 5: Deploy Medium Risk Strategies
        console.log("\n5. Deploying Medium Risk Strategies...");
        
        defiLendingStrategy = new DeFiLendingStrategy(vUSDT);
        console.log("DeFiLendingStrategy deployed at:", address(defiLendingStrategy));
        defiLendingStrategy.setVault(address(vault));
        
        altcoinStakingStrategy = new AltcoinStakingStrategy(vUSDT);
        console.log("AltcoinStakingStrategy deployed at:", address(altcoinStakingStrategy));
        altcoinStakingStrategy.setVault(address(vault));

        // Step 6: Deploy High Risk Strategies
        console.log("\n6. Deploying High Risk Strategies...");
        
        leveragedYieldStrategy = new LeveragedYieldStrategy(vUSDT);
        console.log("LeveragedYieldStrategy deployed at:", address(leveragedYieldStrategy));
        leveragedYieldStrategy.setVault(address(vault));
        
        memecoinFarmingStrategy = new MemecoinFarmingStrategy(vUSDT);
        console.log("MemecoinFarmingStrategy deployed at:", address(memecoinFarmingStrategy));
        memecoinFarmingStrategy.setVault(address(vault));

        // Step 7: Configure Low Risk Tier (Tier 0)
        console.log("\n7. Configuring Low Risk Tier...");
        vault.addStrategy(0, address(btcStrategy), 60);        // 60% BTC
        vault.addStrategy(0, address(ethStrategy), 20);        // 20% ETH
        vault.addStrategy(0, address(blueChipStrategy), 20);   // 20% BlueChip

        // Step 8: Configure Medium Risk Tier (Tier 1)
        console.log("\n8. Configuring Medium Risk Tier...");
        vault.addStrategy(1, address(defiLendingStrategy), 60);      // 60% DeFi Lending
        vault.addStrategy(1, address(altcoinStakingStrategy), 40);   // 40% Altcoin Staking

        // Step 9: Configure High Risk Tier (Tier 2)
        console.log("\n9. Configuring High Risk Tier...");
        vault.addStrategy(2, address(leveragedYieldStrategy), 70);   // 70% Leveraged Yield
        vault.addStrategy(2, address(memecoinFarmingStrategy), 30);  // 30% Memecoin Farming

        // Step 10: Mint test Risk NFTs
        console.log("\n10. Minting test Risk NFTs...");
        
        // Conservative profile (50% Low, 30% Med, 20% High)
        address testUser1 = vm.addr(1);
        riskNFT.mint(testUser1, 50, 30, 20);
        console.log("Minted conservative profile for:", testUser1);
        
        // Balanced profile (30% Low, 40% Med, 30% High)
        address testUser2 = vm.addr(2);
        riskNFT.mint(testUser2, 30, 40, 30);
        console.log("Minted balanced profile for:", testUser2);
        
        // Aggressive profile (10% Low, 20% Med, 70% High)
        address testUser3 = vm.addr(3);
        riskNFT.mint(testUser3, 10, 20, 70);
        console.log("Minted aggressive profile for:", testUser3);

        // Step 11: Airdrop test USDT
        console.log("\n11. Airdropping test vUSDT...");
        vUSDT.mint(testUser1, 10_000e18);
        vUSDT.mint(testUser2, 10_000e18);
        vUSDT.mint(testUser3, 10_000e18);
        console.log("Airdropped 10,000 vUSDT to each test user");

        vm.stopBroadcast();

        // Print summary
        console.log("\n====================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("====================================");
        console.log("VirtualUSDT:", address(vUSDT));
        console.log("RiskNFT:", address(riskNFT));
        console.log("AuraVault:", address(vault));
        console.log("\nLow Risk Strategies:");
        console.log("  BTCStrategy (60%):", address(btcStrategy));
        console.log("  ETHStrategy (20%):", address(ethStrategy));
        console.log("  BlueChipStrategy (20%):", address(blueChipStrategy));
        console.log("\nMedium Risk Strategies:");
        console.log("  DeFiLendingStrategy (60%):", address(defiLendingStrategy));
        console.log("  AltcoinStakingStrategy (40%):", address(altcoinStakingStrategy));
        console.log("\nHigh Risk Strategies:");
        console.log("  LeveragedYieldStrategy (70%):", address(leveragedYieldStrategy));
        console.log("  MemecoinFarmingStrategy (30%):", address(memecoinFarmingStrategy));
        console.log("\nTest Users:");
        console.log("  User1 (Conservative):", testUser1);
        console.log("  User2 (Balanced):", testUser2);
        console.log("  User3 (Aggressive):", testUser3);
        console.log("====================================");
    }
}
