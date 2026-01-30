"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { useAccount } from "wagmi";
import DefaultLayout from "@/layouts/default";
import { config } from "@/config/wagmiConfig";
import USDT_ABI from "@/abi/VirtualUSDC.json";
import VAULT_ABI from "@/abi/AuraVault.json";
import RISK_ABI from "@/abi/RiskNFT.json";

const USDT = import.meta.env.VITE_VIRTUAL_USDT_ADDRESS as `0x${string}`;
const RISK = import.meta.env.VITE_RISK_NFT_ADDRESS as `0x${string}`;
const VAULT = import.meta.env.VITE_AURA_VAULT_ADDRESS as `0x${string}`;

const ONE = 10n ** 18n;

// Types
interface UserState {
  auraBalance: string;
  usdtBalance: string;
  totalDeposited: string;
  lowRiskAmount: string;
  medRiskAmount: string;
  highRiskAmount: string;
  depositTimestamp: number;
  userValue: string;
}

interface VaultState {
  tvl: string;
  apy: string;
  totalHarvested: string;
  performanceFeeBps: number;
  lastHarvestTime: number;
}

interface RiskProfile {
  lowPct: number;
  medPct: number;
  highPct: number;
}

interface StrategyInfo {
  name: string;
  assets: string;
  apy: string;
}

interface TierInfo {
  name: string;
  totalAllocated: string;
  strategyCount: number;
  strategies: StrategyInfo[];
}

// Toast Component
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: "bg-green-50 border-green-200 text-green-900",
    error: "bg-red-50 border-red-200 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };

  return (
    <div
      className={`fixed top-6 right-6 border px-6 py-4 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 ${bgColor[type]} z-50`}
    >
      <p className="font-medium text-sm">{message}</p>
    </div>
  );
};

// Modal Component
const Modal = ({
  isOpen,
  title,
  children,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-8 max-w-md w-full shadow-lg border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Input Component
const Input = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  helper,
}: {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
  helper?: string;
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
    />
    {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
  </div>
);

// Button Component
const Button = ({
  onClick,
  children,
  disabled = false,
  loading = false,
  variant = "primary",
  className = "",
  fullWidth = true,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "success";
  className?: string;
  fullWidth?: boolean;
}) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        py-2.5 px-4 rounded-lg font-medium text-sm
        transition-all duration-200 flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${fullWidth ? "w-full" : ""}
        ${variants[variant]} ${className}
      `}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
};

// Stat Card Component
const StatCard = ({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) => (
  <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {label}
    </p>
    <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
  </div>
);

// Tab Component
const Tabs = ({
  tabs,
  activeTab,
  setActiveTab,
}: {
  tabs: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) => (
  <div className="flex gap-8 border-b border-gray-200 mb-8">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`pb-4 px-1 font-medium text-sm transition-all ${
          activeTab === tab
            ? "text-gray-900 border-b-2 border-gray-900"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

// Progress Bar Component
const ProgressBar = ({
  percentage,
  color = "blue",
}: {
  percentage: number;
  color?: "blue" | "green" | "amber" | "red";
}) => {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`${colorClasses[color]} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
};

// Main Dashboard Component
export default function AuraVaultDashboard() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // State
  const [userState, setUserState] = useState<UserState>({
    auraBalance: "0",
    usdtBalance: "0",
    totalDeposited: "0",
    lowRiskAmount: "0",
    medRiskAmount: "0",
    highRiskAmount: "0",
    depositTimestamp: 0,
    userValue: "0",
  });

  const [vaultState, setVaultState] = useState<VaultState>({
    tvl: "0",
    apy: "0",
    totalHarvested: "0",
    performanceFeeBps: 0,
    lastHarvestTime: 0,
  });

  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [tierInfos, setTierInfos] = useState<TierInfo[]>([
    { name: "Low Risk", totalAllocated: "0", strategyCount: 0, strategies: [] },
    {
      name: "Medium Risk",
      totalAllocated: "0",
      strategyCount: 0,
      strategies: [],
    },
    {
      name: "High Risk",
      totalAllocated: "0",
      strategyCount: 0,
      strategies: [],
    },
  ]);
  const [isOwner, setIsOwner] = useState(false);

  // Modals
  const [modals, setModals] = useState({
    deposit: false,
    withdraw: false,
    mintNFT: false,
    addStrategy: false,
    updateFee: false,
  });

  // Form States
  const [forms, setForms] = useState({
    deposit: "",
    withdraw: "",
    riskAlloc: { low: "20", med: "50", high: "30" },
    strategyTier: "0",
    strategyAddress: "",
    strategyAllocation: "100",
    newFee: "",
    newFeeRecipient: "",
  });

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ message, type });
    },
    [],
  );

  // Fetch User Data
  const fetchUserData = useCallback(async () => {
    if (!address) return;

    try {
      const [aura, usdt, deposit, profile, userValue] = await Promise.all([
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        readContract(config, {
          address: USDT,
          abi: USDT_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "getUserDeposit",
          args: [address],
        }),
        readContract(config, {
          address: RISK,
          abi: RISK_ABI,
          functionName: "getRiskProfile",
          args: [address],
        }).catch(() => null),
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "getUserValue",
          args: [address],
        }),
      ]);

      const depositData = deposit as any;
      const prof = profile as any;

      setUserState({
        auraBalance: (Number(aura) / Number(ONE)).toFixed(4),
        usdtBalance: (Number(usdt) / Number(ONE)).toFixed(2),
        totalDeposited: (
          Number(depositData.totalDeposited) / Number(ONE)
        ).toFixed(2),
        lowRiskAmount: (
          Number(depositData.lowRiskAmount) / Number(ONE)
        ).toFixed(2),
        medRiskAmount: (
          Number(depositData.medRiskAmount) / Number(ONE)
        ).toFixed(2),
        highRiskAmount: (
          Number(depositData.highRiskAmount) / Number(ONE)
        ).toFixed(2),
        depositTimestamp: Number(depositData.depositTimestamp),
        userValue: (Number(userValue) / Number(ONE)).toFixed(2),
      });

      if (prof) {
        setRiskProfile({
          lowPct: prof.lowPct,
          medPct: prof.medPct,
          highPct: prof.highPct,
        });
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  }, [address]);

  // Fetch Vault Data
  const fetchVaultData = useCallback(async () => {
    try {
      const [tvl, apy, harvested, fee, lastHarvest] = await Promise.all([
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "totalAssets",
        }),
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "estimatedVaultAPY",
        }),
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "totalHarvested",
        }),
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "performanceFeeBps",
        }),
        readContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "lastHarvestTime",
        }),
      ]);

      setVaultState({
        tvl: (Number(tvl) / Number(ONE)).toFixed(2),
        apy: (Number(apy) / 100).toFixed(2),
        totalHarvested: (Number(harvested) / Number(ONE)).toFixed(2),
        performanceFeeBps: Number(fee),
        lastHarvestTime: Number(lastHarvest),
      });
    } catch (err) {
      console.error("Error fetching vault data:", err);
    }
  }, []);

  // Fetch Tier Info
  const fetchTierInfo = useCallback(async () => {
    try {
      const tierData = [];
      for (let i = 0; i < 3; i++) {
        const [info, allocationDetails] = await Promise.all([
          readContract(config, {
            address: VAULT,
            abi: VAULT_ABI,
            functionName: "getRiskTierInfo",
            args: [i],
          }),
          readContract(config, {
            address: VAULT,
            abi: VAULT_ABI,
            functionName: "getTierAllocationDetails",
            args: [i],
          }),
        ]);

        const infoData = info as any;
        const allocationData = allocationDetails as any;

        tierData.push({
          name: infoData[0],
          totalAllocated: (Number(infoData[1]) / Number(ONE)).toFixed(2),
          strategyCount: infoData[2],
          strategies: (allocationData[0] as string[]).map((addr, idx) => ({
            name: `Strategy ${idx + 1}`,
            assets: (Number(allocationData[2][idx]) / Number(ONE)).toFixed(2),
            apy: "N/A",
          })),
        });
      }
      setTierInfos(tierData);
    } catch (err) {
      console.error("Error fetching tier info:", err);
    }
  }, []);

  // Airdrop USDT
  const handleAirdrop = useCallback(async () => {
    if (!address) return;
    setLoading(true);

    try {
      const tx = await writeContract(config, {
        address: USDT,
        abi: USDT_ABI,
        functionName: "airdrop",
        account: address,
      });
      await waitForTransactionReceipt(config, { hash: tx });
      showToast("10,000 vUSDT airdrop claimed successfully", "success");
      await fetchUserData();
    } catch (err) {
      showToast("Airdrop failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, fetchUserData, showToast]);

  // Mint Risk NFT
  const handleMintNFT = useCallback(async () => {
    if (!address) return;
    setLoading(true);

    try {
      const low = Math.min(100, Math.max(0, parseInt(forms.riskAlloc.low)));
      const med = Math.min(
        100 - low,
        Math.max(0, parseInt(forms.riskAlloc.med)),
      );
      const high = 100 - low - med;

      const tx = await writeContract(config, {
        address: RISK,
        abi: RISK_ABI,
        functionName: "mint",
        args: [low, med, high],
        account: address,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast("Risk Profile NFT minted successfully", "success");
      setModals({ ...modals, mintNFT: false });
      await fetchUserData();
    } catch (err) {
      showToast("NFT minting failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, forms.riskAlloc, modals, fetchUserData, showToast]);

  // Deposit
  const handleDeposit = useCallback(async () => {
    if (!address || !forms.deposit) return;
    setLoading(true);

    try {
      const amount = BigInt(Math.floor(parseFloat(forms.deposit) * 1e18));

      const allowance = (await readContract(config, {
        address: USDT,
        abi: USDT_ABI,
        functionName: "allowance",
        args: [address, VAULT],
      })) as bigint;

      if (allowance < amount) {
        const approveTx = await writeContract(config, {
          address: USDT,
          abi: USDT_ABI,
          functionName: "approve",
          args: [VAULT, amount],
        });
        await waitForTransactionReceipt(config, { hash: approveTx });
      }

      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amount],
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast(`${forms.deposit} vUSDT deposited successfully`, "success");
      setModals({ ...modals, deposit: false });
      setForms({ ...forms, deposit: "" });
      await Promise.all([fetchUserData(), fetchVaultData()]);
    } catch (err) {
      showToast("Deposit failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, forms, modals, fetchUserData, fetchVaultData, showToast]);

  // Withdraw
  const handleWithdraw = useCallback(async () => {
    if (!address || !forms.withdraw) return;
    setLoading(true);

    try {
      const amount = BigInt(Math.floor(parseFloat(forms.withdraw) * 1e18));

      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [amount],
        gas: 5_000_000n,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast(`${forms.withdraw} AURA withdrawn successfully`, "success");
      setModals({ ...modals, withdraw: false });
      setForms({ ...forms, withdraw: "" });
      await Promise.all([fetchUserData(), fetchVaultData()]);
    } catch (err) {
      showToast("Withdrawal failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, forms, modals, fetchUserData, fetchVaultData, showToast]);

  // Harvest All (Admin)
  const handleHarvestAll = useCallback(async () => {
    if (!address) return;
    setLoading(true);

    try {
      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "harvestAll",
        account: address,
        gas: 5_000_000n,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast("All strategies harvested successfully", "success");
      await fetchVaultData();
    } catch (err) {
      showToast("Harvest failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, fetchVaultData, showToast]);

  // Rebalance Tier (Admin)
  const handleRebalanceTier = useCallback(
    async (tier: number) => {
      if (!address) return;
      setLoading(true);

      try {
        const tx = await writeContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "rebalanceTier",
          args: [tier],
          account: address,
          gas: 3_000_000n,
        });

        await waitForTransactionReceipt(config, { hash: tx });
        showToast(`Tier ${tier} rebalanced successfully`, "success");
        await fetchVaultData();
      } catch (err) {
        showToast("Rebalance failed", "error");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [address, fetchVaultData, showToast],
  );

  // Add Strategy (Admin)
  const handleAddStrategy = useCallback(async () => {
    if (!address || !forms.strategyAddress) return;
    setLoading(true);

    try {
      const tier = parseInt(forms.strategyTier);
      const allocation = parseInt(forms.strategyAllocation);

      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "addStrategy",
        args: [tier, forms.strategyAddress as `0x${string}`, allocation],
        account: address,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast("Strategy added successfully", "success");
      setModals({ ...modals, addStrategy: false });
      setForms({
        ...forms,
        strategyAddress: "",
        strategyAllocation: "100",
      });
      await fetchTierInfo();
    } catch (err) {
      showToast("Add strategy failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, forms, modals, fetchTierInfo, showToast]);

  // Set Performance Fee (Admin)
  const handleSetPerformanceFee = useCallback(async () => {
    if (!address || !forms.newFee) return;
    setLoading(true);

    try {
      const feeBps = parseInt(forms.newFee) * 100; // Convert percentage to basis points

      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "setPerformanceFee",
        args: [BigInt(feeBps)],
        account: address,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast("Performance fee updated successfully", "success");
      setModals({ ...modals, updateFee: false });
      setForms({ ...forms, newFee: "" });
      await fetchVaultData();
    } catch (err) {
      showToast("Update fee failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, forms, modals, fetchVaultData, showToast]);

  // Set Fee Recipient (Admin)
  const handleSetFeeRecipient = useCallback(async () => {
    if (!address || !forms.newFeeRecipient) return;
    setLoading(true);

    try {
      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "setFeeRecipient",
        args: [forms.newFeeRecipient as `0x${string}`],
        account: address,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      showToast("Fee recipient updated successfully", "success");
      setForms({ ...forms, newFeeRecipient: "" });
      await fetchVaultData();
    } catch (err) {
      showToast("Update fee recipient failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, forms, fetchVaultData, showToast]);

  // Remove Strategy (Admin)
  const handleRemoveStrategy = useCallback(
    async (tier: number, index: number) => {
      if (!address) return;
      setLoading(true);

      try {
        const tx = await writeContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "removeStrategy",
          args: [tier, index],
          account: address,
        });

        await waitForTransactionReceipt(config, { hash: tx });
        showToast("Strategy removed successfully", "success");
        await fetchTierInfo();
      } catch (err) {
        showToast("Remove strategy failed", "error");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [address, fetchTierInfo, showToast],
  );

  // Update Tier Allocations (Admin)
  const handleUpdateTierAllocations = useCallback(
    async (tier: number, indices: number[], allocations: number[]) => {
      if (!address) return;
      setLoading(true);

      try {
        const tx = await writeContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "updateTierAllocations",
          args: [tier, indices, allocations],
          account: address,
        });

        await waitForTransactionReceipt(config, { hash: tx });
        showToast("Tier allocations updated successfully", "success");
        await fetchTierInfo();
      } catch (err) {
        showToast("Update allocations failed", "error");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [address, fetchTierInfo, showToast],
  );

  // Emergency Withdraw Strategy (Admin)
  const handleEmergencyWithdraw = useCallback(
    async (tier: number, index: number) => {
      if (!address) return;
      setLoading(true);

      try {
        const tx = await writeContract(config, {
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "emergencyWithdrawStrategy",
          args: [tier, index],
          account: address,
          gas: 3_000_000n,
        });

        const res = await waitForTransactionReceipt(config, { hash: tx });
        if(res.status === "success") {
          showToast("Emergency withdrawal completed", "success");
          await fetchTierInfo();
        } else {
          showToast("Emergency withdrawal failed", "error");
        }
      } catch (err) {
        showToast("Emergency withdrawal failed", "error");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [address, fetchTierInfo, showToast],
  );

  const updateNFT = async() => {
    if (!address) return;
    setLoading(true);
    try {
      const tx = await writeContract(config, {
        address: RISK,
        abi: RISK_ABI,
        functionName: "updateRiskProfile",
        args: [100, 0, 0],
        account: address,
      });
      await waitForTransactionReceipt(config, { hash: tx });
      showToast("Risk Profile NFT updated successfully", "success");
      await fetchUserData();
    } catch (err) {
      showToast("NFT update failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const emergencyWithdrawStrategy = async() => {
    if (!address) return;
    setLoading(true);
    try {
      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "emergencyWithdrawStrategy",
        args: [1,1],
        account: address,
        gas: 3_000_000n,
      });
      await waitForTransactionReceipt(config, { hash: tx });
      
      showToast("Emergency withdrawal completed", "success");
      await fetchTierInfo();
    } catch (err) {
      showToast("Emergency withdrawal failed", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    if (address) {
      fetchUserData();
      fetchVaultData();
      fetchTierInfo();

      const interval = setInterval(() => {
        fetchUserData();
        fetchVaultData();
      }, 20000);

      return () => clearInterval(interval);
    }
  }, [address, fetchUserData, fetchVaultData, fetchTierInfo]);

  if (!address) {
    return (
      <DefaultLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              Aura Vault
            </h1>
            <p className="text-gray-600">
              Connect your wallet to access the vault
            </p>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Aura Vault
            </h1>
            <p className="text-gray-600">
              Risk-aligned automated yield farming
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <StatCard label="Total Value Locked" value={`$${vaultState.tvl}`} />
            <StatCard label="Vault APY" value={`${vaultState.apy}%`} />
            <StatCard
              label="Your Holdings"
              value={userState.auraBalance}
              subtext="AURA tokens"
            />
            <StatCard
              label="Available Balance"
              value={userState.usdtBalance}
              subtext="vUSDT"
            />
          </div>

          {/* Navigation Tabs */}
          <Tabs
            tabs={["Overview", "Portfolio", "Strategies", "Admin"]}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Overview Tab */}
          {activeTab === "Overview" && (
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Button
                    onClick={handleAirdrop}
                    loading={loading}
                    variant="success"
                  >
                    Claim Airdrop
                  </Button>
                  <Button
                    onClick={() => setModals({ ...modals, deposit: true })}
                    variant="primary"
                  >
                    Deposit
                  </Button>
                  <Button
                    onClick={() => setModals({ ...modals, withdraw: true })}
                    variant="secondary"
                  >
                    Withdraw
                  </Button>
                  <Button
                    onClick={() => setModals({ ...modals, mintNFT: true })}
                    variant="primary"
                  >
                    Mint Risk NFT
                  </Button>
                  <Button onClick={() => fetchUserData()} variant="secondary">
                    Refresh
                  </Button>
                  <Button onClick={updateNFT} loading={loading} variant="danger">Update NFT</Button>
                </div>
              </div>

              {/* Vault Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Total Harvested
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${vaultState.totalHarvested}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Performance Fee
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(vaultState.performanceFeeBps / 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Last Harvest
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {vaultState.lastHarvestTime
                      ? new Date(
                          vaultState.lastHarvestTime * 1000,
                        ).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === "Portfolio" && (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  Your Portfolio
                </h2>

                {riskProfile ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Total Deposited
                        </p>
                        <p className="text-3xl font-bold text-gray-900">
                          ${userState.totalDeposited}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Current Value
                        </p>
                        <p className="text-3xl font-bold text-green-600">
                          ${userState.userValue}
                        </p>
                      </div>
                    </div>

                    {/* Risk Allocation Breakdown */}
                    <div className="space-y-6">
                      <h3 className="font-semibold text-gray-900">
                        Risk Allocation
                      </h3>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            Low Risk
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            ${userState.lowRiskAmount} ({riskProfile.lowPct}%)
                          </p>
                        </div>
                        <ProgressBar
                          percentage={riskProfile.lowPct}
                          color="green"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            Medium Risk
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            ${userState.medRiskAmount} ({riskProfile.medPct}%)
                          </p>
                        </div>
                        <ProgressBar
                          percentage={riskProfile.medPct}
                          color="amber"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            High Risk
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            ${userState.highRiskAmount} ({riskProfile.highPct}%)
                          </p>
                        </div>
                        <ProgressBar
                          percentage={riskProfile.highPct}
                          color="red"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        Deposit Date:{" "}
                        {userState.depositTimestamp
                          ? new Date(
                              userState.depositTimestamp * 1000,
                            ).toLocaleDateString()
                          : "No deposits"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-600 mb-6">
                      Create a risk profile to start investing
                    </p>
                    <Button
                      onClick={() => setModals({ ...modals, mintNFT: true })}
                      variant="primary"
                    >
                      Mint Risk Profile NFT
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Strategies Tab */}
          {activeTab === "Strategies" && (
            <div className="space-y-6">
              {tierInfos.map((tier, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-lg p-8"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {tier.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {tier.strategyCount} strategy{" "}
                        {tier.strategyCount !== 1 ? "strategies" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Allocated
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${tier.totalAllocated}
                      </p>
                    </div>
                  </div>

                  {tier.strategies.length > 0 ? (
                    <div className="space-y-3">
                      {tier.strategies.map((strategy, stratIdx) => (
                        <div
                          key={stratIdx}
                          className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {strategy.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              Assets: ${strategy.assets}
                            </p>
                          </div>
                          {isOwner && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() =>
                                  handleRemoveStrategy(idx, stratIdx)
                                }
                                variant="danger"
                                className="!w-auto px-3 py-1 text-xs"
                              >
                                Remove
                              </Button>
                              <Button
                                onClick={() =>
                                  handleEmergencyWithdraw(idx, stratIdx)
                                }
                                variant="secondary"
                                className="!w-auto px-3 py-1 text-xs"
                              >
                                Emergency Withdraw
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">
                      No strategies configured
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Admin Tab */}
          {activeTab === "Admin" && (
            <div className="space-y-8">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  Admin functions are restricted to contract owner
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Harvest */}
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Harvest Yields
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Collect yields from all active strategies and distribute
                    performance fees.
                  </p>
                  <Button
                    onClick={handleHarvestAll}
                    loading={loading}
                    variant="success"
                  >
                    Execute Harvest
                  </Button>
                </div>

                {/* Rebalance */}
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Rebalance Tiers
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Rebalance strategies within each risk tier to match target
                    allocations.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((tier) => (
                      <Button
                        key={tier}
                        onClick={() => handleRebalanceTier(tier)}
                        loading={loading}
                        variant="secondary"
                        className="text-xs"
                      >
                        Tier {tier}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Add Strategy */}
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Add Strategy
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Add a new strategy to a specific risk tier.
                  </p>
                  <Button
                    onClick={() => setModals({ ...modals, addStrategy: true })}
                    variant="primary"
                  >
                    Configure Strategy
                  </Button>
                </div>

                {/* Emergency Withdraw */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Emergency Withdraw
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Emergency withdraw a strategy from a specific risk tier.
                  </p>
                  <Button
                    onClick={emergencyWithdrawStrategy}
                    loading={loading}
                    variant="danger"
                  >
                    Emergency Withdraw
                  </Button>
                </div>

                {/* Update Fee */}
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Performance Fee
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Current fee:{" "}
                    {(vaultState.performanceFeeBps / 100).toFixed(1)}%
                  </p>
                  <Button
                    onClick={() => setModals({ ...modals, updateFee: true })}
                    variant="primary"
                  >
                    Update Fee
                  </Button>
                </div>

                {/* Fee Recipient */}
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Fee Recipient
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Update where performance fees are sent.
                  </p>
                  <Input
                    value={forms.newFeeRecipient}
                    onChange={(e) =>
                      setForms({ ...forms, newFeeRecipient: e.target.value })
                    }
                    placeholder="0x..."
                  />
                  <Button
                    onClick={handleSetFeeRecipient}
                    loading={loading}
                    variant="primary"
                  >
                    Update Recipient
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      <Modal
        isOpen={modals.deposit}
        title="Deposit vUSDT"
        onClose={() => setModals({ ...modals, deposit: false })}
      >
        <Input
          label="Amount"
          value={forms.deposit}
          onChange={(e) => setForms({ ...forms, deposit: e.target.value })}
          placeholder="0.00"
          type="number"
          helper={`Available: ${userState.usdtBalance} vUSDT`}
        />
        <Button onClick={handleDeposit} loading={loading} variant="primary">
          Confirm Deposit
        </Button>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        isOpen={modals.withdraw}
        title="Withdraw AURA"
        onClose={() => setModals({ ...modals, withdraw: false })}
      >
        <Input
          label="Amount"
          value={forms.withdraw}
          onChange={(e) => setForms({ ...forms, withdraw: e.target.value })}
          placeholder="0.00"
          type="number"
          helper={`Available: ${userState.auraBalance} AURA`}
        />
        <Button onClick={handleWithdraw} loading={loading} variant="primary">
          Confirm Withdrawal
        </Button>
      </Modal>

      {/* Mint NFT Modal */}
      <Modal
        isOpen={modals.mintNFT}
        title="Create Risk Profile"
        onClose={() => setModals({ ...modals, mintNFT: false })}
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Low Risk: {forms.riskAlloc.low}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={forms.riskAlloc.low}
              onChange={(e) => {
                const low = parseInt(e.target.value);
                const med = Math.min(100 - low, parseInt(forms.riskAlloc.med));
                setForms({
                  ...forms,
                  riskAlloc: {
                    low: String(low),
                    med: String(med),
                    high: String(100 - low - med),
                  },
                });
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Medium Risk: {forms.riskAlloc.med}%
            </label>
            <input
              type="range"
              min="0"
              max={String(100 - parseInt(forms.riskAlloc.low))}
              value={forms.riskAlloc.med}
              onChange={(e) => {
                const med = parseInt(e.target.value);
                const low = parseInt(forms.riskAlloc.low);
                setForms({
                  ...forms,
                  riskAlloc: {
                    low: String(low),
                    med: String(med),
                    high: String(100 - low - med),
                  },
                });
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              High Risk: {forms.riskAlloc.high}%
            </label>
            <input
              type="range"
              min="0"
              max={String(
                100 -
                  parseInt(forms.riskAlloc.low) -
                  parseInt(forms.riskAlloc.med),
              )}
              value={forms.riskAlloc.high}
              disabled
              className="w-full opacity-50"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium">
              Total:{" "}
              {parseInt(forms.riskAlloc.low) +
                parseInt(forms.riskAlloc.med) +
                parseInt(forms.riskAlloc.high)}
              %
            </p>
          </div>

          <Button onClick={handleMintNFT} loading={loading} variant="primary">
            Mint Risk Profile NFT
          </Button>

          
        </div>
      </Modal>

      {/* Add Strategy Modal */}
      <Modal
        isOpen={modals.addStrategy}
        title="Add Strategy"
        onClose={() => setModals({ ...modals, addStrategy: false })}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Risk Tier
            </label>
            <select
              value={forms.strategyTier}
              onChange={(e) =>
                setForms({ ...forms, strategyTier: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">Low Risk</option>
              <option value="1">Medium Risk</option>
              <option value="2">High Risk</option>
            </select>
          </div>

          <Input
            label="Strategy Address"
            value={forms.strategyAddress}
            onChange={(e) =>
              setForms({ ...forms, strategyAddress: e.target.value })
            }
            placeholder="0x..."
          />

          <Input
            label="Allocation %"
            value={forms.strategyAllocation}
            onChange={(e) =>
              setForms({ ...forms, strategyAllocation: e.target.value })
            }
            placeholder="100"
            type="number"
          />

          <Button
            onClick={handleAddStrategy}
            loading={loading}
            variant="primary"
          >
            Add Strategy
          </Button>
        </div>
      </Modal>

      {/* Update Fee Modal */}
      <Modal
        isOpen={modals.updateFee}
        title="Update Performance Fee"
        onClose={() => setModals({ ...modals, updateFee: false })}
      >
        <div className="space-y-4">
          <Input
            label="Fee Percentage"
            value={forms.newFee}
            onChange={(e) => setForms({ ...forms, newFee: e.target.value })}
            placeholder="10"
            type="number"
            helper="Maximum 20%"
          />

          <Button
            onClick={handleSetPerformanceFee}
            loading={loading}
            variant="primary"
          >
            Update Fee
          </Button>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </DefaultLayout>
  );
}
