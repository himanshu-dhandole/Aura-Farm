// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "../src/VirtualUSDT.sol";
import "../src/RiskNFT.sol";
import "../src/AuraVault.sol";

// Low-risk strategies
import "../src/strategies/low-risk/BTCStrategy.sol";
import "../src/strategies/low-risk/ETHStrategy.sol";
import "../src/strategies/low-risk/BlueChipStrategy.sol";

// Medium-risk strategies
import "../src/strategies/medium-risk/DeFiLendingStrategy.sol";
import "../src/strategies/medium-risk/AltcoinStakingStrategy.sol";

// High-risk strategies
import "../src/strategies/high-risk/LeveragedYieldStrategy.sol";
import "../src/strategies/high-risk/MemecoinFarmingStrategy.sol";

contract DeployAuraProtocol is Script {
    VirtualUSDT public vUSDT;
    RiskNFT public riskNFT;
    AuraVault public vault;

    BTCStrategy public btc;
    ETHStrategy public eth;
    BlueChipStrategy public bluechip;
    DeFiLendingStrategy public defi;
    AltcoinStakingStrategy public alt;
    LeveragedYieldStrategy public lev;
    MemecoinFarmingStrategy public meme;

    address public deployer;
    address public feeRecipient;

    uint256 constant TEST_YIELD_PERIOD = 360; // 6 minutes = 1 "year" of yield

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(privateKey);
        feeRecipient = deployer; // ← change in .env if needed

        vm.startBroadcast(privateKey);

        console2.log("=====================================");
        console2.log("Deploying Aura Protocol - TEST MODE");
        console2.log("Yield period set to 6 minutes for all strategies");
        console2.log("Deployer:     ", deployer);
        console2.log("Fee Recipient:", feeRecipient);
        console2.log("=====================================");

        // 1. VirtualUSDT
        vUSDT = new VirtualUSDT();
        console2.log("VirtualUSDT :", address(vUSDT));

        // 2. RiskNFT
        riskNFT = new RiskNFT();
        console2.log("RiskNFT :", address(riskNFT));

        // 3. AuraVault
        vault = new AuraVault(address(vUSDT), address(riskNFT), feeRecipient);
        console2.log("AuraVault :", address(vault));

        // 4. Deploy strategies
        btc = new BTCStrategy(IERC20(address(vUSDT)));
        eth = new ETHStrategy(IERC20(address(vUSDT)));
        bluechip = new BlueChipStrategy(IERC20(address(vUSDT)));
        defi = new DeFiLendingStrategy(IERC20(address(vUSDT)));
        alt = new AltcoinStakingStrategy(IERC20(address(vUSDT)));
        lev = new LeveragedYieldStrategy(IERC20(address(vUSDT)));
        meme = new MemecoinFarmingStrategy(IERC20(address(vUSDT)));

        console2.log("Strategies deployed");

        // 5. Set vault + 6-minute yield period on ALL strategies
        address[] memory strats = new address[](7);
        strats[0] = address(btc);
        strats[1] = address(eth);
        strats[2] = address(bluechip);
        strats[3] = address(defi);
        strats[4] = address(alt);
        strats[5] = address(lev);
        strats[6] = address(meme);

        for (uint256 i = 0; i < strats.length; i++) {
            // Set vault
            (bool successVault,) = strats[i].call(
                abi.encodeWithSignature("setVault(address)", address(vault))
            );
            require(successVault, "setVault failed");

            // Set test yield period (6 minutes)
            (bool successPeriod,) = strats[i].call(
                abi.encodeWithSignature("setYieldPeriod(uint256)", TEST_YIELD_PERIOD)
            );
            require(successPeriod, "setYieldPeriod failed");

            // Add as minter to VirtualUSDT
            vUSDT.addMinter(strats[i]);

            console2.log("Configured strategy:", strats[i]);
        }

        // 6. Add strategies to vault tiers (100% sum per tier)
        console2.log("\nAdding strategies to tiers...");

        // Tier 0: Low Risk
        vault.addStrategy(0, address(btc), 40);
        vault.addStrategy(0, address(eth), 40);
        vault.addStrategy(0, address(bluechip), 20);

        // Tier 1: Medium Risk
        vault.addStrategy(1, address(defi), 60);
        vault.addStrategy(1, address(alt), 40);

        // Tier 2: High Risk
        vault.addStrategy(2, address(lev), 60);
        vault.addStrategy(2, address(meme), 40);

        vm.stopBroadcast();

        // ──────────────────────────────────────────────────────────────
        // FINAL SUMMARY
        // ──────────────────────────────────────────────────────────────
        console2.log("\n=====================================");
        console2.log("DEPLOYMENT SUCCESSFUL (TEST MODE)");
        console2.log("Yield period = 6 minutes on all strategies");
        console2.log("=====================================");
        console2.log("VirtualUSDT:      ", address(vUSDT));
        console2.log("RiskNFT:          ", address(riskNFT));
        console2.log("AuraVault:        ", address(vault));
        console2.log("Fee Recipient:    ", feeRecipient);

        console2.log("\nLow Risk (Tier 0):");
        console2.log("  BTC:      ", address(btc));
        console2.log("  ETH:      ", address(eth));
        console2.log("  BlueChip: ", address(bluechip));

        console2.log("\nMedium Risk (Tier 1):");
        console2.log("  DeFiLending:    ", address(defi));
        console2.log("  AltcoinStaking: ", address(alt));

        console2.log("\nHigh Risk (Tier 2):");
        console2.log("  LeveragedYield: ", address(lev));
        console2.log("  MemecoinFarming:", address(meme));
    }
}