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
import { toast, Toaster } from "sonner";
import { ArrowRight, Lock, Plus, TrendingUp, Gift, Wallet } from "lucide-react";

const USDT = import.meta.env.VITE_VIRTUAL_USDT_ADDRESS as `0x${string}`;
const RISK = import.meta.env.VITE_RISK_NFT_ADDRESS as `0x${string}`;
const VAULT = import.meta.env.VITE_AURA_VAULT_ADDRESS as `0x${string}`;

const ONE = 10n ** 18n;

// Types
interface UserState {
  auraBalance: string;
  usdtBalance: string;
  totalDeposited: string;
  userValue: string;
}

interface VaultState {
  tvl: string;
  apy: string;
}

// Main Deposit Component
export default function Deposit() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [airdropLoading, setAirdropLoading] = useState(false);

  // State
  const [userState, setUserState] = useState<UserState>({
    auraBalance: "0",
    usdtBalance: "0",
    totalDeposited: "0",
    userValue: "0.00",
  });

  const [vaultState, setVaultState] = useState<VaultState>({
    tvl: "0",
    apy: "5.2",
  });

  const [depositAmount, setDepositAmount] = useState("");

  // Fetch User Data
  const fetchUserData = useCallback(async () => {
    if (!address) return;

    try {
      const [aura, usdt, deposit, userValue] = await Promise.all([
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
          address: VAULT,
          abi: VAULT_ABI,
          functionName: "getUserValue",
          args: [address],
        }),
      ]);

      const depositData = deposit as any;

      setUserState({
        auraBalance: (Number(aura) / Number(ONE)).toFixed(2),
        usdtBalance: (Number(usdt) / Number(ONE)).toFixed(2),
        totalDeposited: (
          Number(depositData.totalDeposited) / Number(ONE)
        ).toFixed(2),
        userValue: (Number(userValue) / Number(ONE)).toFixed(2),
      });
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  }, [address]);

  // Fetch Vault Data
  const fetchVaultData = useCallback(async () => {
    try {
      const [tvl, apy] = await Promise.all([
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
      ]);

      setVaultState({
        tvl: (Number(tvl) / Number(ONE)).toFixed(2),
        apy: (Number(apy) / 100).toFixed(1),
      });
    } catch (err) {
      console.error("Error fetching vault data:", err);
    }
  }, []);

  // Airdrop USDT
  const handleAirdrop = useCallback(async () => {
    if (!address) return;
    setAirdropLoading(true);

    try {
      const tx = await writeContract(config, {
        address: USDT,
        abi: USDT_ABI,
        functionName: "airdrop",
        account: address,
      });
      await waitForTransactionReceipt(config, { hash: tx });
      toast.success("Test tokens claimed!", {
        description: "10,000 vUSDT has been added to your wallet",
      });
      await fetchUserData();
    } catch (err) {
      toast.error("Failed to claim tokens");
      console.error(err);
    } finally {
      setAirdropLoading(false);
    }
  }, [address, fetchUserData]);

  // Deposit
  const handleDeposit = useCallback(async () => {
    if (!address || !depositAmount) return;
    setLoading(true);

    try {
      const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1e18));

      const allowance = (await readContract(config, {
        address: USDT,
        abi: USDT_ABI,
        functionName: "allowance",
        args: [address, VAULT],
      })) as bigint;

      if (allowance < amount) {
        toast.info("Approving tokens...");
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
      toast.success("Deposit successful!", {
        description: `$${depositAmount} has been deposited to the vault`,
      });
      setDepositAmount("");
      await Promise.all([fetchUserData(), fetchVaultData()]);
    } catch (err) {
      toast.error("Deposit failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, depositAmount, fetchUserData, fetchVaultData]);

  // Withdraw
  const handleWithdraw = useCallback(async () => {
    if (!address || parseFloat(userState.userValue) <= 0) return;
    setLoading(true);

    try {
      const amount = BigInt(
        Math.floor(parseFloat(userState.auraBalance) * 1e18)
      );

      const tx = await writeContract(config, {
        address: VAULT,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [amount],
        gas: 5_000_000n,
      });

      await waitForTransactionReceipt(config, { hash: tx });
      toast.success("Withdrawal successful!");
      await Promise.all([fetchUserData(), fetchVaultData()]);
    } catch (err) {
      toast.error("Withdrawal failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    address,
    userState.auraBalance,
    userState.userValue,
    fetchUserData,
    fetchVaultData,
  ]);

  const quickAmounts = ["100", "500", "1000", "5000"];
  const quickLabels = ["$100", "$500", "$1k", "$5k"];

  // Initial load
  useEffect(() => {
    if (address) {
      fetchUserData();
      fetchVaultData();

      const interval = setInterval(() => {
        fetchUserData();
        fetchVaultData();
      }, 20000);

      return () => clearInterval(interval);
    }
  }, [address, fetchUserData, fetchVaultData]);

  if (!address) {
    return (
      <DefaultLayout>
        <div className="min-h-screen bg-[#0e120f] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1c261f] flex items-center justify-center mx-auto mb-4 border border-white/5">
              <Wallet className="w-8 h-8 text-[#13ec5b]" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">
              Connect Wallet
            </h1>
            <p className="text-gray-500">
              Connect your wallet to deposit & withdraw
            </p>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] relative overflow-hidden font-sans">
        {/* LEFT PANEL: Total Balance & Withdraw */}
        <section className="flex-1 bg-[#0e120f] flex flex-col justify-center items-center relative p-8 lg:p-20 border-b lg:border-b-0 lg:border-r border-white/5">
          {/* Subtle radial background gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(19,236,91,0.03),transparent_40%)] pointer-events-none" />

          <div className="w-full max-w-md flex flex-col gap-8 z-0 relative">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-xl">🐖</span>
                <span className="uppercase tracking-widest text-xs font-semibold">
                  Total Balance
                </span>
              </div>

              <div className="relative">
                <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter text-white">
                  ${userState.userValue}
                </h1>
                {/* Visual placeholder watermark */}
                <div className="absolute -right-4 -top-2 lg:-right-8 lg:-top-4 opacity-50">
                  <span className="text-[48px] lg:text-[64px] text-white/5 -rotate-12 select-none">
                    $
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#13ec5b]/10 border border-[#13ec5b]/20 self-start">
                <TrendingUp className="w-4 h-4 text-[#13ec5b]" />
                <span className="text-[#13ec5b] text-sm font-bold">
                  +{vaultState.apy}% APY
                </span>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5">
              <p className="text-gray-500 text-sm mb-4">
                Funds are available for withdrawal instantly.
              </p>
              <button
                onClick={handleWithdraw}
                disabled={loading || parseFloat(userState.userValue) <= 0}
                className="w-full sm:w-auto h-14 px-8 rounded-xl border border-white/20 text-white font-bold hover:bg-white/5 hover:border-white/40 active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Withdraw Funds</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: Add Funds */}
        <section className="flex-1 bg-[#1c261f] flex flex-col justify-center items-center relative p-8 lg:p-20">
          {/* Background decoration */}
          <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

          <div className="w-full max-w-md flex flex-col gap-8 z-0 relative">
            {/* Promo Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 p-6 shadow-2xl group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Gift className="w-32 h-32 text-[#13ec5b] -rotate-12 translate-x-8 -translate-y-8" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-[#13ec5b] text-[#0e120f] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    New User
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Get 1,000 USDC Test Tokens
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Start testing the vault immediately without spending real
                  money.
                </p>
                <button
                  onClick={handleAirdrop}
                  disabled={airdropLoading}
                  className="h-10 px-4 bg-white text-[#0e120f] text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 bg-[#0e120f] text-white rounded-full p-0.5" />
                  Claim Free Tokens
                </button>
              </div>
            </div>

            {/* Deposit Form */}
            <div className="space-y-6 mt-4">
              <div className="flex items-center justify-between">
                <label className="uppercase tracking-widest text-xs font-semibold text-gray-400">
                  Deposit Amount
                </label>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Wallet:</span>
                  <span className="font-mono text-white">
                    ${userState.usdtBalance}
                  </span>
                </div>
              </div>

              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-xl font-medium">$</span>
                </div>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="block w-full pl-10 pr-24 py-5 bg-black/20 border border-white/10 rounded-xl text-3xl font-bold text-white placeholder-gray-600 focus:ring-2 focus:ring-[#13ec5b] focus:border-transparent transition-all outline-none"
                />
                <div className="absolute inset-y-0 right-2 flex items-center">
                  <button
                    onClick={() => setDepositAmount(userState.usdtBalance)}
                    className="bg-white/5 hover:bg-white/10 text-[#13ec5b] text-xs font-bold py-1.5 px-3 rounded-lg border border-white/5 transition-colors uppercase tracking-wider"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Quick Amounts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickAmounts.map((amount, idx) => (
                  <button
                    key={amount}
                    onClick={() => setDepositAmount(amount)}
                    className="py-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition-colors"
                  >
                    {quickLabels[idx]}
                  </button>
                ))}
              </div>

              {/* Deposit Action */}
              <button
                onClick={handleDeposit}
                disabled={
                  loading || !depositAmount || parseFloat(depositAmount) <= 0
                }
                className="w-full h-14 bg-[#13ec5b] hover:bg-[#0fd652] text-[#0e120f] text-lg font-bold rounded-xl shadow-[0_0_20px_rgba(19,236,91,0.15)] hover:shadow-[0_0_30px_rgba(19,236,91,0.3)] transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Lock className="w-5 h-5" />
                Deposit to Vault
              </button>

              <p className="text-center text-xs text-gray-500 mt-2">
                No lock-up period. Withdraw anytime.
              </p>
            </div>
          </div>
        </section>
      </div>
      <Toaster />
    </DefaultLayout>
  );
}
