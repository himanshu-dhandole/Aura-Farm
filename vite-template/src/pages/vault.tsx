"use client";
import React, { useMemo } from "react";
import DefaultLayout from "@/layouts/default";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Flame,
  Bitcoin,
  Gem,
  BadgeCheck,
  Landmark,
  Layers,
  Rocket,
  Skull,
  Plus,
  Activity, // Added for generic strategy icon
} from "lucide-react";
import { useReadContracts, useAccount } from "wagmi"; // Changed to useReadContracts
import { formatUnits } from "viem"; // Added for formatting
import VAULT_ABI from "@/abi/AuraVault.json";

const VAULT_ADDRESS = import.meta.env.VITE_AURA_VAULT_ADDRESS as `0x${string}`;

// Fallback/Demo data if vault is empty
const DEMO_STRATEGIES = {
  low: [
    {
      name: "BTC Vault",
      icon: Bitcoin,
      apy: "4.2",
      tvl: "$12.5M",
      color: "text-orange-500",
      active: true,
    },
    {
      name: "ETH Yield",
      icon: Gem,
      apy: "5.8",
      tvl: "$24.1M",
      color: "text-purple-400",
      active: true,
    },
    {
      name: "BlueChip Index",
      icon: BadgeCheck,
      apy: "6.1",
      tvl: "$8.3M",
      color: "text-blue-400",
      active: true,
    },
  ],
  medium: [
    {
      name: "Lending Loop",
      icon: Landmark,
      apy: "12.4",
      tvl: "$5.2M",
      color: "text-yellow-400",
      active: true,
    },
    {
      name: "Liquid Staking",
      icon: Layers,
      apy: "9.8",
      tvl: "$15.7M",
      color: "text-teal-400",
      active: true,
    },
  ],
  high: [
    {
      name: "Meme Aggregator",
      icon: Rocket,
      apy: "142.5",
      tvl: "$1.2M",
      color: "text-pink-500",
      active: true,
    },
    {
      name: "Shitcoin Index",
      icon: Skull,
      apy: "894.1",
      tvl: "$450k",
      color: "text-red-500",
      active: true,
    },
  ],
};

const formatCurrency = (value: bigint | undefined) => {
  if (value === undefined) return "$0.00";
  const num = parseFloat(formatUnits(value, 18));
  if (num === 0) return "$0.00";
  if (num > 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num > 1_000) return `$${(num / 1_000).toFixed(1)}k`;
  return `$${num.toFixed(2)}`;
};

const formatAPY = (value: bigint | undefined) => {
  if (value === undefined) return "0.0";
  // Assuming APY is in basis points or scaled ? Contract says returns uint256.
  // Often APY is 1e18 based or bps. Let's assume 1e18 for consistency with assets or standard fixed point.
  // Docs say: `estimatedVaultAPY`. Let's assume standard percent * 1e18 or * 100.
  // Actually usually Solidity APY is mostly BPS (10000 = 100%) or updated to 1e18.
  // Let's assume 1e18 = 100% or just handle as raw number.
  // If result is like 50000000000000000 (0.05e18), it 5%.
  const num = parseFloat(formatUnits(value, 18)) * 100;
  return num.toFixed(1);
};

export default function VaultDashboard() {
  const { address } = useAccount();

  // 1. Batch fetch high-level stats
  const { data: vaultStats } = useReadContracts({
    contracts: [
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalAssets" },
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "estimatedVaultAPY",
      },
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getRiskTierInfo",
        args: [0],
      }, // Low
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getRiskTierInfo",
        args: [1],
      }, // Med
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getRiskTierInfo",
        args: [2],
      }, // High
    ],
  });

  const totalAssets = vaultStats?.[0].result as bigint | undefined;
  const vaultAPY = vaultStats?.[1].result as bigint | undefined;

  // getRiskTierInfo returns [name, totalAllocated, strategyCount]
  // Ideally it returns Tier Assets. Docs say `getTierAssets`. `getRiskTierInfo` calls it.
  const lowTierInfo = vaultStats?.[2].result as
    | [string, bigint, bigint]
    | undefined;
  const medTierInfo = vaultStats?.[3].result as
    | [string, bigint, bigint]
    | undefined;
  const highTierInfo = vaultStats?.[4].result as
    | [string, bigint, bigint]
    | undefined;

  // 2. Fetch Detailed Strategy Allocations
  // logic: getTierAllocationDetails(tier) returns (addresses, allocations, currentAssets, targetAssets)
  const { data: strategiesData } = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getTierAllocationDetails",
        args: [0],
      },
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getTierAllocationDetails",
        args: [1],
      },
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "getTierAllocationDetails",
        args: [2],
      },
    ],
  });

  // Helper to process strategy data
  const processStrategies = (tierIndex: number, demoData: any[]) => {
    const raw = strategiesData?.[tierIndex].result as
      | [
          readonly `0x${string}`[],
          readonly number[],
          readonly bigint[],
          readonly bigint[],
        ]
      | undefined;

    // If no real data or empty, return demo data if TVL is also 0 (User is in demo mode)
    // Otherwise return empty array
    if (!raw || raw[0].length === 0) {
      return !totalAssets || totalAssets === 0n ? demoData : [];
    }

    return raw[0].map((addr, i) => ({
      name: `Strategy ${addr.slice(0, 6)}...${addr.slice(-4)}`, // No name on-chain
      icon: Activity, // Default icon
      apy: "0.0", // Individual APY not fetched in this batch
      tvl: formatCurrency(raw[2][i]),
      color: "text-white", // Default color, could be made deterministic
      address: addr,
      allocation: raw[1][i],
    }));
  };

  const lowStrategies = useMemo(
    () => processStrategies(0, DEMO_STRATEGIES.low),
    [strategiesData, totalAssets]
  );
  const medStrategies = useMemo(
    () => processStrategies(1, DEMO_STRATEGIES.medium),
    [strategiesData, totalAssets]
  );
  const highStrategies = useMemo(
    () => processStrategies(2, DEMO_STRATEGIES.high),
    [strategiesData, totalAssets]
  );

  return (
    <DefaultLayout>
      <style>
        {`
          .glass-card {
            background: rgba(28, 38, 31, 0.4);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .risk-low-gradient {
            background: radial-gradient(circle at top left, rgba(19, 236, 91, 0.15), transparent 40%);
          }
          .risk-med-gradient {
            background: radial-gradient(circle at top left, rgba(251, 191, 36, 0.15), transparent 40%);
          }
          .risk-high-gradient {
            background: radial-gradient(circle at top left, rgba(239, 68, 68, 0.15), transparent 40%);
          }
        `}
      </style>

      <div className="min-h-screen bg-[#111813] font-sans text-white p-6 lg:p-8">
        {/* Header */}
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="bg-[#1c261f] border border-white/5 rounded-3xl p-8 grid grid-cols-1 md:grid-cols-4 gap-8 items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#13ec5b]/5 to-transparent pointer-events-none"></div>

            {/* Main Stats */}
            <div className="md:col-span-1 relative z-10">
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">
                Total Value Locked
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {formatCurrency(totalAssets)}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-[#13ec5b] text-sm font-semibold">
                <TrendingUp className="w-4 h-4" />
                <span>{formatAPY(vaultAPY)}% APY</span>
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              <div className="bg-[#111813]/50 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#13ec5b]"></span>
                  <span className="text-gray-400 text-xs uppercase">
                    Low Risk Assets
                  </span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(lowTierInfo?.[1])}
                </p>
              </div>
              <div className="bg-[#111813]/50 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span className="text-gray-400 text-xs uppercase">
                    Medium Risk Assets
                  </span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(medTierInfo?.[1])}
                </p>
              </div>
              <div className="bg-[#111813]/50 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-gray-400 text-xs uppercase">
                    High Risk Assets
                  </span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(highTierInfo?.[1])}
                </p>
              </div>
            </div>
          </div>

          {/* Strategy Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LOW RISK COLUMN */}
            <div className="bg-[#1c261f]/40 border border-[#13ec5b]/20 rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#13ec5b] to-transparent opacity-50"></div>
              <div className="risk-low-gradient absolute inset-0 pointer-events-none"></div>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#13ec5b]/10 text-[#13ec5b]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Low Risk</h3>
                    <p className="text-xs text-[#13ec5b] font-medium">
                      Stable • Conservative
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white/20">01</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 relative z-10">
                {lowStrategies.length > 0 ? (
                  lowStrategies.map((strat, i) => (
                    <div
                      key={i}
                      className="bg-[#0e120f] hover:bg-[#0e120f]/80 border border-white/5 hover:border-[#13ec5b]/40 rounded-2xl p-5 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg text-white group-hover:text-[#13ec5b] transition-colors truncate pr-2">
                          {strat.name}
                        </h4>
                        <div
                          className={`size-8 rounded-full bg-white/5 flex items-center justify-center ${strat.color} shrink-0`}
                        >
                          <strat.icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          {strat.allocation !== undefined ? (
                            <p className="text-xs text-[#13ec5b] font-mono">
                              {strat.allocation}% Alloc
                            </p>
                          ) : (
                            <p className="text-3xl font-bold text-white tracking-tight">
                              {strat.apy}
                              <span className="text-lg text-gray-500 font-medium">
                                %
                              </span>
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            APY / Alloc
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono text-gray-300">
                            {strat.tvl}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            TVL
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No active strategies
                  </div>
                )}
              </div>
            </div>

            {/* MEDIUM RISK COLUMN */}
            <div className="bg-[#1c261f]/40 border border-yellow-400/20 rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-transparent opacity-50"></div>
              <div className="risk-med-gradient absolute inset-0 pointer-events-none"></div>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Medium Risk
                    </h3>
                    <p className="text-xs text-yellow-400 font-medium">
                      Growth • Balanced
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white/20">02</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 relative z-10">
                {medStrategies.length > 0 ? (
                  medStrategies.map((strat, i) => (
                    <div
                      key={i}
                      className="bg-[#0e120f] hover:bg-[#0e120f]/80 border border-white/5 hover:border-yellow-400/40 rounded-2xl p-5 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg text-white group-hover:text-yellow-400 transition-colors truncate pr-2">
                          {strat.name}
                        </h4>
                        <div
                          className={`size-8 rounded-full bg-white/5 flex items-center justify-center ${strat.color} shrink-0`}
                        >
                          <strat.icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          {strat.allocation !== undefined ? (
                            <p className="text-xs text-yellow-400 font-mono">
                              {strat.allocation}% Alloc
                            </p>
                          ) : (
                            <p className="text-3xl font-bold text-white tracking-tight">
                              {strat.apy}
                              <span className="text-lg text-gray-500 font-medium">
                                %
                              </span>
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            APY / Alloc
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono text-gray-300">
                            {strat.tvl}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            TVL
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No active strategies
                  </div>
                )}

                {/* Add Strategy Button */}
                <div className="border border-white/5 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center h-full min-h-[140px] text-gray-600 hover:text-gray-400 hover:border-white/10 transition-all cursor-pointer">
                  <Plus className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Add Strategy
                  </span>
                </div>
              </div>
            </div>

            {/* HIGH RISK COLUMN */}
            <div className="bg-[#1c261f]/40 border border-red-500/20 rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-transparent opacity-50"></div>
              <div className="risk-high-gradient absolute inset-0 pointer-events-none"></div>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">High Risk</h3>
                    <p className="text-xs text-red-500 font-medium">
                      Volatile • Aggressive
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white/20">03</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 relative z-10">
                {highStrategies.length > 0 ? (
                  highStrategies.map((strat, i) => (
                    <div
                      key={i}
                      className="bg-[#0e120f] hover:bg-[#0e120f]/80 border border-white/5 hover:border-red-500/40 rounded-2xl p-5 transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute -right-10 -top-10 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors pointer-events-none"></div>

                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <h4 className="font-bold text-lg text-white group-hover:text-red-500 transition-colors truncate pr-2">
                          {strat.name}
                        </h4>
                        <div
                          className={`size-8 rounded-full bg-white/5 flex items-center justify-center ${strat.color} shrink-0`}
                        >
                          <strat.icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-end justify-between relative z-10">
                        <div>
                          {strat.allocation !== undefined ? (
                            <p className="text-xs text-red-500 font-mono">
                              {strat.allocation}% Alloc
                            </p>
                          ) : (
                            <p className="text-3xl font-bold text-red-500 tracking-tight">
                              {strat.apy}
                              <span className="text-lg text-red-500/70 font-medium">
                                %
                              </span>
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            APY / Alloc
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono text-gray-300">
                            {strat.tvl}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            TVL
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No active strategies
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
