// keeper.js

const { ethers } = require('ethers');
const axios = require('axios');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// ============================================
// CONFIGURATION
// ============================================

const RPC_URL = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc';
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const AURA_VAULT_ADDRESS = process.env.AURA_VAULT_ADDRESS;
const AI_API_URL = process.env.AI_API_URL || 'https://api.aura-farm.ai/allocate-pools';
const MONGODB_URI = process.env.MONGODB_URI;
const REBALANCE_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Smart Contract ABIs
const AURA_VAULT_ABI = [
    // View functions
    "function getRiskTierStrategies(uint8 riskTier) external view returns (tuple(address strategy, uint8 allocationPct, bool active)[])",
    "function getRiskTierInfo(uint8 riskTier) external view returns (string name, uint256 totalAllocated, uint256 strategyCount)",
    "function getTierAllocationDetails(uint8 riskTier) external view returns (address[] strategyAddresses, uint8[] allocations, uint256[] currentAssets, uint256[] targetAssets)",
    "function isTierAllocationValid(uint8 riskTier) external view returns (bool isValid, uint256 totalAllocation)",
    "function estimatedVaultAPY() external view returns (uint256)",
    "function totalAssets() external view returns (uint256)",
    
    // Write functions
    "function updateTierAllocations(uint8 riskTier, uint256[] calldata indices, uint8[] calldata allocations) external",
    "function rebalanceTier(uint8 tier) public",
    
    // Events
    "event TierAllocationsUpdated(uint8 indexed riskTier, address[] strategies, uint8[] allocations)",
    "event TierRebalanced(uint8 indexed riskTier, uint256 timestamp, uint256 totalRebalanced)"
];

const STRATEGY_ABI = [
    "function totalAssets() external view returns (uint256)",
    "function estimatedAPY() external view returns (uint256)",
    "function baseAPY() external view returns (uint256)",
    "function deposit(uint256 assets, address receiver) external returns (uint256 shares)",
    "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 assetsReceived)"
];

// ============================================
// KEEPER SERVICE
// ============================================

class KeeperService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
        
        // Initialize contract instance
        this.auraVault = new ethers.Contract(
            AURA_VAULT_ADDRESS,
            AURA_VAULT_ABI,
            this.wallet
        );
        
        // MongoDB client
        this.mongoClient = null;
        this.db = null;
        
        // Cache for strategy contracts
        this.strategyContracts = new Map();
        
        console.log('✅ Keeper initialized');
        console.log(`📡 AuraVault Contract: ${AURA_VAULT_ADDRESS}`);
        console.log(`🤖 AI API Endpoint: ${AI_API_URL}`);
        console.log(`🗄️  MongoDB URI: ${MONGODB_URI}`);
        console.log(`⏰ Rebalance Interval: ${REBALANCE_INTERVAL / 60000} minutes\n`);
    }
    
    // ============================================
    // MongoDB Connection
    // ============================================
    
    async connectMongoDB() {
        try {
            console.log('🗄️  Connecting to MongoDB...');
            this.mongoClient = new MongoClient(MONGODB_URI);
            await this.mongoClient.connect();
            this.db = this.mongoClient.db('aura-farmer');
            console.log('✅ MongoDB connected\n');
        } catch (error) {
            console.error('❌ MongoDB connection error:', error.message);
            throw error;
        }
    }
    
    // ============================================
    // Get Strategy Contract Instance
    // ============================================
    
    getStrategyContract(strategyAddress) {
        if (!this.strategyContracts.has(strategyAddress)) {
            this.strategyContracts.set(
                strategyAddress,
                new ethers.Contract(strategyAddress, STRATEGY_ABI, this.provider)
            );
        }
        return this.strategyContracts.get(strategyAddress);
    }
    
    // ============================================
    // Fetch All Active Strategies from Blockchain
    // ============================================
    
    async fetchAllStrategies() {
        console.log('🔍 Fetching all strategies from AuraVault...\n');
        
        const allStrategies = {
            tiers: [],
            strategyMap: new Map() // Map<address, {name, tier, index}>
        };
        
        const tierNames = ['Low Risk', 'Medium Risk', 'High Risk'];
        
        for (let tier = 0; tier < 3; tier++) {
            try {
                const strategies = await this.auraVault.getRiskTierStrategies(tier);
                const tierInfo = await this.auraVault.getRiskTierInfo(tier);
                
                const activeStrategies = [];
                let strategyIndex = 0;
                
                for (let i = 0; i < strategies.length; i++) {
                    const [strategyAddress, allocationPct, active] = strategies[i];
                    
                    if (active) {
                        activeStrategies.push({
                            index: i, // Original index in contract
                            address: strategyAddress,
                            allocationPct: Number(allocationPct),
                            active: active
                        });
                        
                        // Store in map for quick lookup
                        allStrategies.strategyMap.set(strategyAddress, {
                            name: `${tierNames[tier]}_Strategy_${strategyIndex}`,
                            tier: tier,
                            contractIndex: i
                        });
                        
                        strategyIndex++;
                    }
                }
                
                allStrategies.tiers[tier] = {
                    tier: tier,
                    name: tierInfo[0],
                    totalAllocated: tierInfo[1],
                    strategyCount: tierInfo[2],
                    strategies: activeStrategies
                };
                
                console.log(`Tier ${tier} (${tierInfo[0]}):`);
                console.log(`  Total Allocated: ${ethers.formatUnits(tierInfo[1], 6)} USDC`);
                console.log(`  Active Strategies: ${activeStrategies.length}`);
                
                for (const strat of activeStrategies) {
                    console.log(`    [${strat.index}] ${strat.address.slice(0, 10)}... (${strat.allocationPct}%)`);
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error fetching tier ${tier} strategies:`, error.message);
                allStrategies.tiers[tier] = {
                    tier: tier,
                    name: tierNames[tier],
                    strategies: []
                };
            }
        }
        
        return allStrategies;
    }
    
    // ============================================
    // Fetch Current APYs from Blockchain
    // ============================================
    
    async fetchCurrentAPYs(allStrategies) {
        console.log('📊 Fetching current APYs from blockchain...\n');
        
        const currentAPYs = {
            byTier: {},
            byAddress: {}
        };
        
        for (let tier = 0; tier < 3; tier++) {
            currentAPYs.byTier[tier] = [];
            
            const tierData = allStrategies.tiers[tier];
            if (!tierData || !tierData.strategies) continue;
            
            console.log(`Tier ${tier} (${tierData.name}):`);
            
            for (const strat of tierData.strategies) {
                try {
                    const strategyContract = this.getStrategyContract(strat.address);
                    // Fetch baseAPY directly from the contract
                    const [baseApyRaw, totalAssets] = await Promise.all([
                        strategyContract.baseAPY(),
                        strategyContract.totalAssets()
                    ]);
                    // baseAPY is stored as integer, e.g. 450 = 4.5%
                    const baseApyPercent = Number(baseApyRaw) / 100;
                    const assetsFormatted = Number(ethers.formatUnits(totalAssets, 6));
                    const strategyData = {
                        address: strat.address,
                        index: strat.index,
                        allocationPct: strat.allocationPct,
                        apy: baseApyPercent, // Use baseAPY as currentAPY
                        totalAssets: assetsFormatted,
                        name: allStrategies.strategyMap.get(strat.address)?.name || `Strategy_${strat.index}`
                    };
                    currentAPYs.byTier[tier].push(strategyData);
                    currentAPYs.byAddress[strat.address] = strategyData;
                    console.log(`  [${strat.index}] ${strategyData.name}`);
                    console.log(`      Address: ${strat.address.slice(0, 10)}...`);
                    console.log(`      Base APY (currentAPY): ${baseApyPercent.toFixed(2)}%`);
                    console.log(`      Total Assets: ${assetsFormatted.toFixed(2)} USDC`);
                    console.log(`      Allocation: ${strat.allocationPct}%`);
                } catch (error) {
                    console.error(`  ❌ Error fetching APY for strategy ${strat.address}:`, error.message);
                    currentAPYs.byTier[tier].push({
                        address: strat.address,
                        index: strat.index,
                        allocationPct: strat.allocationPct,
                        apy: 0,
                        totalAssets: 0,
                        name: `Strategy_${strat.index}`
                    });
                }
            }
            console.log('');
        }
        
        return currentAPYs;
    }
    
    // ============================================
    // Fetch Previous APYs from MongoDB
    // ============================================

    async fetchPreviousAPYs(allStrategies, days = 7) {
        console.log(`📈 Fetching previous ${days}-day APYs from MongoDB...\n`);
        try {
            const collection = this.db.collection('strategy_performance');
            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const previousAPYs = {
                byTier: {},
                byAddress: {}
            };

            for (let tier = 0; tier < 3; tier++) {
                previousAPYs.byTier[tier] = [];
                const tierData = allStrategies.tiers[tier];
                if (!tierData || !tierData.strategies) continue;

                for (const strat of tierData.strategies) {
                    // Fetch last 7 days, sorted by timestamp descending
                    const results = await collection.find({
                        strategyAddress: strat.address,
                        timestamp: { $gte: cutoffDate }
                    }).sort({ timestamp: -1 }).limit(days).toArray();

                    // Sort ascending by timestamp for chronological order
                    results.sort((a, b) => a.timestamp - b.timestamp);

                    const apys = results.map(r => r.apy);
                    const avgAPY = apys.length ? apys.reduce((sum, apy) => sum + apy, 0) / apys.length : 0;
                    const volatility = this.calculateVolatility(apys);
                    const sharpe = this.calculateSharpe(apys);

                    const strategyData = {
                        address: strat.address,
                        index: strat.index,
                        name: allStrategies.strategyMap.get(strat.address)?.name || `Strategy_${strat.index}`,
                        avg: apys,   // <-- 7-day APY array
                        volatility: volatility,
                        sharpe: sharpe,
                        dataPoints: results.length,
                        apyHistory: avgAPY 
                    };

                    previousAPYs.byTier[tier].push(strategyData);
                    previousAPYs.byAddress[strat.address] = strategyData;
                }
            }

            return previousAPYs;

        } catch (error) {
            console.error('❌ Error fetching previous APYs from MongoDB:', error.message);
            const emptyAPYs = { byTier: {}, byAddress: {} };
            for (let tier = 0; tier < 3; tier++) {
                emptyAPYs.byTier[tier] = [];
            }
            return emptyAPYs;
        }
    }
    
    // ============================================
    // Calculate Volatility (Standard Deviation)
    // ============================================
    
    calculateVolatility(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    
    // ============================================
    // Calculate Sharpe Ratio
    // ============================================
    
    calculateSharpe(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const volatility = this.calculateVolatility(values);
        return volatility > 0 ? mean / volatility : 0;
    }
    
    // ============================================
    // Get AI Allocations for Rebalancing
    // ============================================
    
    async getAIAllocations(currentAPYs, previousAPYs, allStrategies) {
        console.log('🤖 Requesting allocations from AI...\n');
        try {
            const aiRequestData = {
                requestType: 'rebalance',
                timestamp: Date.now(),
                tiers: []
            };
            // Build tier data for AI
            for (let tier = 0; tier < 3; tier++) {
                const tierData = allStrategies.tiers[tier];
                const currentTierAPYs = currentAPYs.byTier[tier] || [];
                const previousTierAPYs = previousAPYs.byTier[tier] || [];
                const strategies = currentTierAPYs.map((curr, idx) => {
                    const prev = previousTierAPYs.find(p => p.address === curr.address) || {};
                    return {
                        index: curr.index,
                        address: curr.address,
                        name: curr.name,
                        currentAPY: curr.apy,
                        currentAllocation: curr.allocationPct,
                        totalAssets: curr.totalAssets,
                        historical: {
                            avgAPY: Array.isArray(prev.avg)
                                ? (prev.avg.length ? prev.avg.reduce((a, b) => a + b, 0) / prev.avg.length : 0)
                                : prev.avg || 0,
                            volatility: prev.volatility || 0,
                            sharpe: prev.sharpe || 0
                        }
                    };
                });
                aiRequestData.tiers.push({
                    tier: tier,
                    name: tierData.name,
                    strategies: strategies
                });
            }
            // Wrap in base_apy as required by the API
            const payload = { base_apy: aiRequestData };

            console.log('📤 Sending to AI:');
            console.log(JSON.stringify(payload, null, 2));
            console.log('');
            const aiResponse = await axios.post(AI_API_URL, payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000
            });
            const allocations = aiResponse.data;
            console.log('✅ AI Allocations Received:');
            if (allocations.confidence !== undefined) {
                console.log(`   Confidence: ${(allocations.confidence * 100).toFixed(1)}%\n`);
            }
            for (let tier = 0; tier < (allocations.tiers?.length || 0); tier++) {
                if (allocations.tiers[tier]) {
                    console.log(`   Tier ${tier} (${allocations.tiers[tier].name}):`);
                    for (const strat of allocations.tiers[tier].strategies) {
                        console.log(`     [${strat.index}] ${strat.name}: ${strat.newAllocation}%`);
                    }
                    console.log('');
                }
            }
            return allocations;
        } catch (error) {
            console.error('❌ Error getting AI allocations:', error.message);
            throw error;
        }
    }
    
    // ============================================
    // Update Tier Allocations on Smart Contract
    // ============================================
    
    async updateTierAllocations(tier, indices, allocations) {
        console.log(`📝 Updating Tier ${tier} allocations on-chain...`);
        console.log(`   Indices: [${indices.join(', ')}]`);
        console.log(`   Allocations: [${allocations.join(', ')}]%`);
        
        try {
            const tx = await this.auraVault.updateTierAllocations(
                tier,
                indices,
                allocations
            );
            
            console.log(`   🔄 TX sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
            console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);
            
            return receipt;
            
        } catch (error) {
            console.error(`   ❌ Error updating tier ${tier} allocations:`, error.message);
            throw error;
        }
    }
    
    // ============================================
    // Rebalance Tier on Smart Contract
    // ============================================
    
    async rebalanceTier(tier) {
        console.log(`⚖️  Rebalancing Tier ${tier}...`);
        
        try {
            const tx = await this.auraVault.rebalanceTier(tier);
            
            console.log(`   🔄 TX sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
            console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);
            
            return receipt;
            
        } catch (error) {
            console.error(`   ❌ Error rebalancing tier ${tier}:`, error.message);
            throw error;
        }
    }
    
    // ============================================
    // Update MongoDB with Current Strategy Data
    // ============================================
    
    async updateMongoDBStrategies(currentAPYs) {
        console.log('💾 Updating MongoDB with current strategy data...\n');
        
        try {
            const collection = this.db.collection('strategy_performance');
            const timestamp = new Date();
            
            const documents = [];
            
            for (let tier = 0; tier < 3; tier++) {
                const tierAPYs = currentAPYs.byTier[tier] || [];
                
                for (const strat of tierAPYs) {
                    documents.push({
                        strategyAddress: strat.address,
                        strategyName: strat.name,
                        tier: tier,
                        index: strat.index,
                        apy: strat.apy,
                        totalAssets: strat.totalAssets,
                        allocationPct: strat.allocationPct,
                        timestamp: timestamp,
                        updatedAt: timestamp
                    });
                }
            }
            
            if (documents.length > 0) {
                await collection.insertMany(documents);
                console.log(`   ✅ Inserted ${documents.length} strategy records into MongoDB\n`);
            } else {
                console.log(`   ⚠️  No strategy data to insert\n`);
            }
            
        } catch (error) {
            console.error('   ❌ Error updating MongoDB:', error.message);
        }
    }
    
    // ============================================
    // MAIN REBALANCE FUNCTION (Runs Every 10 Minutes)
    // ============================================
    
    async performRebalance() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔄 REBALANCE CYCLE STARTED');
        console.log(`⏰ Time: ${new Date().toISOString()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        try {
            // Step 1: Fetch all strategies from AuraVault
            const allStrategies = await this.fetchAllStrategies();
            
            // Step 2: Fetch current APYs from blockchain
            const currentAPYs = await this.fetchCurrentAPYs(allStrategies);
            
            // Step 3: Fetch previous APYs from MongoDB
            const previousAPYs = await this.fetchPreviousAPYs(allStrategies, 7);
            
            // Step 4: Get AI allocations
            const aiAllocations = await this.getAIAllocations(currentAPYs, previousAPYs, allStrategies);

            // Step 5: Update and rebalance each tier using AI response
            for (let tier = 0; tier < aiAllocations.tiers.length; tier++) {
                const tierData = aiAllocations.tiers[tier];
                if (!tierData || !tierData.strategies || tierData.strategies.length === 0) {
                    console.log(`   ⚠️  No AI allocations for tier ${tier}, skipping...\n`);
                    continue;
                }

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`TIER ${tier}: ${tierData.name.toUpperCase()}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                // Get indices and new allocations from AI response, convert to integers
                const indices = tierData.strategies.map(s => s.index);
                const allocations = tierData.strategies.map(s => Math.round(s.newAllocation)); // <-- fix here

                // Update tier allocations
                await this.updateTierAllocations(tier, indices, allocations);

                // Rebalance tier
                await this.rebalanceTier(tier);
            }
            
            // Step 6: Update MongoDB with current strategy data
            await this.updateMongoDBStrategies(currentAPYs);
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ REBALANCE CYCLE COMPLETED SUCCESSFULLY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
        } catch (error) {
            console.error('❌ REBALANCE CYCLE FAILED:', error.message);
            console.error('Stack trace:', error.stack);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
    }
    
    // ============================================
    // Start Rebalance Scheduler (Every 10 Minutes)
    // ============================================
    
    startRebalanceScheduler() {
        console.log('⏰ Starting rebalance scheduler...');
        console.log(`   Interval: ${REBALANCE_INTERVAL / 60000} minutes\n`);
        
        // Run immediately on start
        this.performRebalance();
        
        // Schedule subsequent runs
        setInterval(() => {
            this.performRebalance();
        }, REBALANCE_INTERVAL);
    }
}

// ============================================
// START KEEPER SERVICE
// ============================================

async function main() {
    console.log('\n🚀 Aura-Farm Keeper Service Starting...\n');
    
    const keeper = new KeeperService();
    
    // Connect to MongoDB
    await keeper.connectMongoDB();
    
    // Start rebalance scheduler (every 10 minutes)
    keeper.startRebalanceScheduler();
    
    console.log('✅ Keeper service fully operational!\n');
    
    // Keep the process running
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down keeper...');
        if (keeper.mongoClient) {
            await keeper.mongoClient.close();
            console.log('✅ MongoDB connection closed');
        }
        process.exit(0);
    });
}

// Run the keeper
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});