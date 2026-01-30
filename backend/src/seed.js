const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'aura-farmer';
const COLLECTION = 'strategy_performance';

// Real strategies and static APY values for 7 days
const strategies = [
  // Tier 0 (Low Risk)
  {
    tier: 0,
    index: 0,
    address: '0xC1E0Ce90A5715DF698c537305D3Cb4fD7E97A399',
    name: 'Low Risk_Strategy_0',
    apys: [4.23, 5.2, 3.22, 4.53, 3.28, 4.66, 4.78]
  },
  {
    tier: 0,
    index: 1,
    address: '0x622Cd0667F96ef145b363A1BAbA2ee8A59c576EE',
    name: 'Low Risk_Strategy_1',
    apys: [4.32, 5.50, 4.50, 3.50, 5.01, 4.89, 4.65]
  },
  {
    tier: 0,
    index: 2,
    address: '0x1221d0bfe79371ADf88cEBa4753E9472736cf1d4',
    name: 'Low Risk_Strategy_2',
    apys: [3.50, 2.90, 3.15, 3.25, 2.99, 3.44, 3.21]
  },
  // Tier 1 (Medium Risk)
  {
    tier: 1,
    index: 0,
    address: '0x37abfd1159E5147d23E63798d83DEcB41a8FbC09',
    name: 'Medium Risk_Strategy_0',
    apys: [8.30, 7.80, 7.90, 8.20, 7.00, 8.00, 9.00]
  },
  {
    tier: 1,
    index: 1,
    address: '0xdb6DF0e0A84A8A503492e39CE275Ae12AC3c2Be4',
    name: 'Medium Risk_Strategy_1',
    apys: [11.00, 9.00, 9.98, 10.12, 10.32, 10.22, 10.00]
  },
  // Tier 2 (High Risk)
  {
    tier: 2,
    index: 0,
    address: '0x68B59F71127BaFDd8a68e07BE8843878F3b746A9',
    name: 'High Risk_Strategy_0',
    apys: [22.00, 28.00, 29.00, 21.00, 15.00, 20.00, 14.00]
  },
  {
    tier: 2,
    index: 1,
    address: '0x31232b5807D8279A4d74Ee7124F1e0e33Dddf5dE',
    name: 'High Risk_Strategy_1',
    apys: [20.00, 25.00, 22.00, 33.00, 49.00, 42.00, 40.00]
  }
];

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    // Remove old data for these addresses (optional)
    await collection.deleteMany({
      strategyAddress: { $in: strategies.map(s => s.address) }
    });

    const now = Date.now();
    const docs = [];

    for (const strat of strategies) {
      for (let day = 0; day < 7; day++) {
        const timestamp = new Date(now - day * 24 * 60 * 60 * 1000);
        docs.push({
          strategyAddress: strat.address,
          strategyName: strat.name,
          tier: strat.tier,
          index: strat.index,
          apy: strat.apys[day],
          totalAssets: 10000, // static or you can use real values if needed
          allocationPct: 30,  // static or use real allocation
          timestamp,
          updatedAt: timestamp
        });
      }
    }

    await collection.insertMany(docs);
    console.log(`✅ Inserted ${docs.length} static APY records for 7 days.`);
  } catch (err) {
    console.error('❌ Error seeding static data:', err);
  } finally {
    await client.close();
  }
}

seed();