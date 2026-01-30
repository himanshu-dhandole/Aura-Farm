"use client";
import React, { useState, useEffect } from "react";
import DefaultLayout from "@/layouts/default";
import {
  ShieldCheck,
  Fingerprint,
  PieChart,
  Brain,
  Settings,
  HelpCircle,
  ArrowRight,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { config } from "@/config/wagmiConfig";
import RISK_ABI from "@/abi/RiskNFT.json";
import { toast, Toaster } from "sonner";

const RISK_ADDRESS = import.meta.env.VITE_RISK_NFT_ADDRESS as `0x${string}`;

export default function Profile() {
  const { address, isConnected } = useAccount();
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Update state
  const [newAllocations, setNewAllocations] = useState({
    low: 40,
    med: 40,
    high: 20,
  });
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Contract Reads
  const { data: riskProfileData, refetch: refetchProfile } = useReadContract({
    address: RISK_ADDRESS,
    abi: RISK_ABI,
    functionName: "getRiskProfile",
    args: [address],
    query: {
      enabled: !!address,
    },
  });

  const { data: tokenId } = useReadContract({
    address: RISK_ADDRESS,
    abi: RISK_ABI,
    functionName: "getTokenId",
    args: [address],
    query: {
      enabled: !!address,
    },
  });

  // Contract Writes
  const {
    writeContract: updateProfile,
    data: updateHash,
    isPending: isUpdating,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: updateHash,
    });

  // Derived State
  const profile = riskProfileData as
    | { lowPct: number; medPct: number; highPct: number }
    | undefined;

  const hasProfile = !!profile;
  const low = profile?.lowPct || 0;
  const med = profile?.medPct || 0;
  const high = profile?.highPct || 0;

  // Calculate generic "Risk Score" (0-100)
  // Simple weighted: Low(0.2), Med(0.5), High(0.9)
  const riskScore = Math.round(low * 0.2 + med * 0.5 + high * 0.9);

  const riskLevel =
    riskScore < 30
      ? "Conservative"
      : riskScore < 60
        ? "Moderate"
        : "Aggressive";
  const riskLevelClass =
    riskScore < 30
      ? "text-emerald-400"
      : riskScore < 60
        ? "text-yellow-400"
        : "text-red-500";
  const identityLevel = Math.floor(riskScore / 20) + 1; // 1-5

  // Effects
  useEffect(() => {
    if (isConfirmed) {
      toast.success("Profile Updated", {
        description: "Your risk strategy has been recalibrated.",
      });
      setShowUpdateModal(false);
      refetchProfile();
    }
  }, [isConfirmed, refetchProfile]);

  useEffect(() => {
    if (writeError) {
      toast.error("Update Failed", {
        description: writeError.message.split("\n")[0],
      });
    }
  }, [writeError]);

  // Handlers
  const handleSliderChange = (key: "low" | "med" | "high", value: number) => {
    setNewAllocations((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdate = () => {
    const total = newAllocations.low + newAllocations.med + newAllocations.high;
    if (total !== 100) {
      setUpdateError(`Total allocation must equal 100% (Current: ${total}%)`);
      return;
    }
    setUpdateError(null);

    updateProfile({
      address: RISK_ADDRESS,
      abi: RISK_ABI,
      functionName: "updateRiskProfile",
      args: [newAllocations.low, newAllocations.med, newAllocations.high],
    });
  };

  if (!isConnected) {
    return (
      <DefaultLayout>
        <div className="min-h-screen bg-[#0e120f] flex items-center justify-center text-white">
          <p>Please connect your wallet to view your profile.</p>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <style>
        {`
          .glass-panel {
            background: rgba(28, 38, 31, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .nft-shimmer {
            background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
            background-size: 200% 100%;
            animation: shimmer 4s infinite linear;
          }
          @keyframes shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
          }
        `}
      </style>

      {/* Main Content Split View */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] relative overflow-hidden font-sans">
        {/* Floating Header (Desktop) */}
        <div className="hidden lg:flex absolute top-0 left-0 w-full p-8 justify-between items-start z-10 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-[#0e120f]/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
            <ShieldCheck className="text-[#13ec5b] w-5 h-5" />
            <span className="font-bold text-white tracking-tight">
              Aura Profile
            </span>
          </div>
          <div className="pointer-events-auto">
            <button className="group flex items-center justify-center gap-2 overflow-hidden rounded-full h-10 px-5 bg-[#0e120f]/80 backdrop-blur-md border border-white/5 text-white text-sm font-bold transition hover:border-[#13ec5b]/50">
              <span className="w-2 h-2 rounded-full bg-[#13ec5b] group-hover:bg-white transition-colors"></span>
              <span className="font-mono">
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "Not Connected"}
              </span>
            </button>
          </div>
        </div>

        {/* LEFT PANEL: NFT & Stats */}
        <section className="flex-1 bg-[#0e120f] flex flex-col justify-center items-center relative p-8 lg:p-20 border-b lg:border-b-0 lg:border-r border-white/5 overflow-y-auto lg:overflow-visible">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(19,236,91,0.05),transparent_50%)] pointer-events-none"></div>

          <div className="w-full max-w-md flex flex-col items-center z-0">
            {/* NFT Card */}
            {hasProfile ? (
              <div className="relative group perspective-1000 mb-12">
                <div className="absolute -inset-4 bg-[#13ec5b]/20 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>

                <div className="relative w-72 h-[420px] bg-gradient-to-br from-gray-800 to-black rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center justify-between p-6 overflow-hidden transition-transform duration-500 hover:scale-[1.02] hover:-rotate-1">
                  <div className="absolute inset-0 nft-shimmer pointer-events-none"></div>

                  <div className="w-full flex justify-between items-center z-10">
                    <Fingerprint className="text-gray-500 w-6 h-6" />
                    <span className="text-[10px] font-mono text-[#13ec5b] border border-[#13ec5b]/30 px-2 py-0.5 rounded-full bg-[#13ec5b]/5">
                      #{tokenId?.toString().padStart(4, "0")}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center">
                    <ShieldCheck className="w-[120px] h-[120px] text-[#13ec5b] drop-shadow-[0_0_15px_rgba(19,236,91,0.3)]" />
                    <h3 className="mt-4 text-2xl font-bold text-white tracking-tight">
                      Risk Sentinel
                    </h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                      Level {identityLevel} Identity
                    </p>
                  </div>

                  <div className="w-full z-10 bg-white/5 rounded-xl p-4 border border-white/5 backdrop-blur-sm">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs text-gray-400 font-medium uppercase">
                        Risk Score
                      </span>
                      <span className="text-2xl font-bold text-white leading-none">
                        {riskScore}
                        <span className="text-sm text-gray-500 font-normal">
                          /100
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-yellow-500 to-[#13ec5b] h-full transition-all duration-1000"
                        style={{ width: `${riskScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[420px] w-72 bg-[#111613] rounded-3xl border border-dashed border-white/10 mb-12">
                <ShieldCheck className="w-16 h-16 text-gray-700 mb-4" />
                <p className="text-gray-500 text-sm">No Profile Found</p>
              </div>
            )}

            {/* Allocation Breakdown */}
            <div className="w-full space-y-4 px-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="text-[#13ec5b] w-4 h-4" />
                Allocation Breakdown
              </h4>
              <div className="grid gap-3">
                {/* Low */}
                <div className="flex items-center gap-3">
                  <div className="w-12 text-xs font-bold text-gray-400">
                    LOW
                  </div>
                  <div className="flex-1 h-8 bg-[#1c261f] border border-white/5 rounded-lg relative overflow-hidden flex items-center px-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#13ec5b]/20 transition-all duration-1000"
                      style={{ width: `${low}%` }}
                    ></div>
                    <span className="relative z-10 text-xs font-medium text-white">
                      Stablecoin Farms
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white w-8 text-right">
                    {low}%
                  </div>
                </div>

                {/* Med */}
                <div className="flex items-center gap-3">
                  <div className="w-12 text-xs font-bold text-gray-400">
                    MED
                  </div>
                  <div className="flex-1 h-8 bg-[#1c261f] border border-white/5 rounded-lg relative overflow-hidden flex items-center px-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-yellow-500/20 transition-all duration-1000"
                      style={{ width: `${med}%` }}
                    ></div>
                    <span className="relative z-10 text-xs font-medium text-white">
                      Blue-chip Lending
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white w-8 text-right">
                    {med}%
                  </div>
                </div>

                {/* High */}
                <div className="flex items-center gap-3">
                  <div className="w-12 text-xs font-bold text-gray-400">
                    HIGH
                  </div>
                  <div className="flex-1 h-8 bg-[#1c261f] border border-white/5 rounded-lg relative overflow-hidden flex items-center px-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-red-500/20 transition-all duration-1000"
                      style={{ width: `${high}%` }}
                    ></div>
                    <span className="relative z-10 text-xs font-medium text-white">
                      Degen Vaults
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white w-8 text-right">
                    {high}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: Strategy & Management */}
        <section className="flex-1 bg-[#1c261f] flex flex-col justify-center items-center relative p-8 lg:p-20 overflow-y-auto">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(19,236,91,0.05),transparent_60%)] pointer-events-none"></div>

          <div className="w-full max-w-md flex flex-col gap-8 z-0">
            {/* Strategy Card */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  Current Strategy
                </h2>
                {hasProfile && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#13ec5b]/10 border border-[#13ec5b]/20 text-[#13ec5b] text-[10px] font-bold uppercase tracking-wide">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#13ec5b] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#13ec5b]"></span>
                    </span>
                    AI Active
                  </span>
                )}
              </div>

              <div className="glass-panel rounded-2xl p-6 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <Brain className="w-[100px] h-[100px] text-white" />
                </div>
                {hasProfile ? (
                  <>
                    <h3 className="text-lg font-bold text-white mb-2">
                      <span className={riskLevelClass}>{riskLevel}</span>{" "}
                      Aggregation
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6 relative z-10">
                      The{" "}
                      <span className="text-white font-medium">
                        Aura RAG Engine
                      </span>{" "}
                      has analyzed your on-chain behavior and NFT risk score (
                      {riskScore}). It is currently optimizing for{" "}
                      {riskScore > 60
                        ? "MAXIMUM YIELD"
                        : riskScore > 30
                          ? "BALANCED GROWTH"
                          : "CAPITAL PRESERVATION"}
                      .
                    </p>
                    <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">
                          Projected APY
                        </div>
                        <div className="text-xl font-bold text-[#13ec5b]">
                          {5 + (riskScore * 0.15).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">
                          Rebalance Freq
                        </div>
                        <div className="text-xl font-bold text-white">
                          {riskScore > 70 ? "Daily" : "Weekly"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">
                      No active strategy. Mint a profile to start.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Management */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="text-gray-400 w-4 h-4" />
                <span className="uppercase tracking-widest text-xs font-semibold text-gray-400">
                  Profile Management
                </span>
              </div>

              <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="size-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <HelpCircle className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">
                      Is your profile outdated?
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Market conditions shift rapidly. Retake the assessment to
                      recalibrate the AI engine for your current goals.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNewAllocations({
                      low: low || 40,
                      med: med || 40,
                      high: high || 20,
                    });
                    setShowUpdateModal(true);
                  }}
                  className="w-full h-12 bg-white hover:bg-gray-200 text-[#0e120f] text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 group"
                >
                  <span>
                    {hasProfile ? "Retake 2-Minute Quiz" : "Create Profile"}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <p className="text-center text-xs text-gray-600">
                Last assessment:{" "}
                <span className="text-gray-500">
                  {hasProfile ? "Recently" : "Never"}
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* UPDATE MODAL */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111613] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                Update Risk Allocation
              </h3>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                {/* Low Risk Slider */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#13ec5b] font-bold">Low Risk</span>
                    <span className="text-white font-mono">
                      {newAllocations.low}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newAllocations.low}
                    onChange={(e) =>
                      handleSliderChange("low", parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#13ec5b]"
                  />
                </div>

                {/* Medium Risk Slider */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-yellow-500 font-bold">
                      Medium Risk
                    </span>
                    <span className="text-white font-mono">
                      {newAllocations.med}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newAllocations.med}
                    onChange={(e) =>
                      handleSliderChange("med", parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>

                {/* High Risk Slider */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-red-500 font-bold">High Risk</span>
                    <span className="text-white font-mono">
                      {newAllocations.high}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newAllocations.high}
                    onChange={(e) =>
                      handleSliderChange("high", parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>
              </div>

              {/* Total Check */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                <span className="text-sm text-gray-400">Total Allocation</span>
                <span
                  className={`font-mono font-bold ${
                    newAllocations.low +
                      newAllocations.med +
                      newAllocations.high ===
                    100
                      ? "text-[#13ec5b]"
                      : "text-red-500"
                  }`}
                >
                  {newAllocations.low +
                    newAllocations.med +
                    newAllocations.high}
                  %
                </span>
              </div>

              {updateError && (
                <div className="flex items gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{updateError}</p>
                </div>
              )}

              <button
                onClick={handleUpdate}
                disabled={isUpdating || isConfirming}
                className="w-full h-12 bg-[#13ec5b] hover:bg-[#0fd652] text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Confirm Update"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </DefaultLayout>
  );
}
