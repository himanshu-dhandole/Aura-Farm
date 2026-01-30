import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConnectButton } from "thirdweb/react";
import { client } from "@/config/thirdwebConfig";
import { createWallet } from "thirdweb/wallets";
import { useTheme } from "@heroui/use-theme";
import { useAccount } from "wagmi";
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
} from "@wagmi/core";
import { config } from "@/config/wagmiConfig";
import RISK_ABI from "@/abi/RiskNFT.json";
import { Loader2, X, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { toast, Toaster } from "sonner";

const RISK = import.meta.env.VITE_RISK_NFT_ADDRESS as `0x${string}`;

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

export interface HeroSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  animatedTexts: string[];
  subtitle: string;
  infoBadgeText?: string;
  ctaButtonText?: string;
  socialProofText: string;
  avatars: {
    src: string;
    alt: string;
    fallback: string;
  }[];
}

const HeroSection = React.forwardRef<HTMLDivElement, HeroSectionProps>(
  (
    {
      className,
      title,
      animatedTexts,
      subtitle,
      infoBadgeText,
      socialProofText,
      avatars,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { address, isConnected, status } = useAccount();

    // Typewriter effect state
    const [textIndex, setTextIndex] = React.useState(0);
    const [displayText, setDisplayText] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Profile & minting state
    const [hasProfile, setHasProfile] = React.useState<boolean | null>(null);
    const [isCheckingProfile, setIsCheckingProfile] = React.useState(false);
    const [showMintModal, setShowMintModal] = React.useState(false);
    const [isMinting, setIsMinting] = React.useState(false);
    const [mintSuccess, setMintSuccess] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // 🔒 HYDRATION GUARD - Critical fix
    const [hasHydrated, setHasHydrated] = React.useState(false);

    // Risk allocation state
    const [allocations, setAllocations] = React.useState({
      low: 40,
      med: 40,
      high: 20,
    });

    /* ===========================
       HYDRATION DETECTION
    =========================== */
    React.useEffect(() => {
      // Wait until wagmi finishes its initial connection state resolution
      if (status !== "connecting") {
        setHasHydrated(true);
      }
    }, [status]);

    /* ===========================
       TYPEWRITER EFFECT
    =========================== */
    React.useEffect(() => {
      const fullText = animatedTexts[textIndex];

      const interval = setInterval(
        () => {
          setDisplayText((prev) =>
            isDeleting ? prev.slice(0, -1) : fullText.slice(0, prev.length + 1)
          );
        },
        isDeleting ? 60 : 120
      );

      if (!isDeleting && displayText === fullText) {
        setTimeout(() => setIsDeleting(true), 1500);
      }

      if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setTextIndex((i) => (i + 1) % animatedTexts.length);
      }

      return () => clearInterval(interval);
    }, [displayText, isDeleting, textIndex, animatedTexts]);

    /* ===========================
       CHECK PROFILE
    =========================== */
    const checkProfile = React.useCallback(async () => {
      if (!address || !isConnected) {
        return null;
      }

      setIsCheckingProfile(true);
      try {
        const exists = (await readContract(config, {
          address: RISK,
          abi: RISK_ABI,
          functionName: "hasProfile",
          args: [address],
        })) as boolean;

        setHasProfile(exists);
        return exists;
      } catch (err) {
        console.error("Profile check failed:", err);
        setHasProfile(null);
        return null;
      } finally {
        setIsCheckingProfile(false);
      }
    }, [address, isConnected]);

    /* ===========================
       HANDLE CONNECTION STATE CHANGES - WITH HYDRATION GUARD + DELAY
    =========================== */
    React.useEffect(() => {
      // 🔒 CRITICAL: Do nothing until wagmi has fully hydrated
      if (!hasHydrated) {
        return;
      }

      // When wallet disconnects, reset everything
      if (!isConnected || !address) {
        setHasProfile(null);
        setShowMintModal(false);
        setMintSuccess(false);
        setError(null);
        setIsCheckingProfile(false);
        return;
      }

      // 🔒 WAIT 2 SECONDS after hydration to ensure wagmi state is fully stable
      const timeoutId = setTimeout(() => {
        const checkAndHandle = async () => {
          const profileExists = await checkProfile();

          // Only show modal if user is still connected and definitively has no profile
          if (isConnected && address && profileExists === false) {
            setShowMintModal(true);
          } else if (profileExists === true) {
            // User has profile, don't show modal, optionally show toast
            setShowMintModal(false);
            toast.success("Profile detected!", {
              description: "Visit the Vault to manage your assets",
              action: {
                label: "Go to Vault",
                onClick: () => (window.location.href = "/vault"),
              },
            });
          }
        };

        checkAndHandle();
      }, 2000); // Wait 2 seconds for wagmi to fully stabilize

      // Cleanup timeout if component unmounts or dependencies change
      return () => clearTimeout(timeoutId);
    }, [hasHydrated, address, isConnected, checkProfile]);

    /* ===========================
       ALLOCATION LOGIC
    =========================== */
    const total = allocations.low + allocations.med + allocations.high;
    const isValid = total === 100;

    const handleChange = (key: "low" | "med" | "high", value: number) => {
      const numValue = Math.max(0, Math.min(100, value));
      setAllocations((prev) => ({
        ...prev,
        [key]: numValue,
      }));
    };

    const handleSliderChange = (key: "low" | "med" | "high", value: number) => {
      setAllocations((prev) => ({
        ...prev,
        [key]: value,
      }));
    };

    /* ===========================
       MINT LOGIC
    =========================== */
    const handleMintNFT = async () => {
      if (!address || !isValid) return;

      setIsMinting(true);
      setError(null);

      try {
        const hash = await writeContract(config, {
          address: RISK,
          abi: RISK_ABI,
          functionName: "mint",
          args: [allocations.low, allocations.med, allocations.high],
          account: address,
        });

        await waitForTransactionReceipt(config, { hash });

        setMintSuccess(true);

        // Show success toast
        toast.success("NFT Minted Successfully!", {
          description: "Your risk profile has been created",
        });

        // Wait a moment to show success, then close modal and update profile
        setTimeout(async () => {
          setShowMintModal(false);
          await checkProfile();

          // Show vault toast after profile is updated
          setTimeout(() => {
            toast.success("Ready to explore!", {
              description: "Visit the Vault to manage your assets",
              action: {
                label: "Go to Vault",
                onClick: () => (window.location.href = "/vault"),
              },
              duration: 5000,
            });
          }, 500);
        }, 2000);
      } catch (err: any) {
        console.error("Mint error:", err);
        const errorMessage =
          err?.shortMessage ||
          err?.message?.split("\n")[0] ||
          "Transaction failed. Please try again.";

        setError(errorMessage);
        toast.error("Minting Failed", {
          description: errorMessage,
        });
      } finally {
        setIsMinting(false);
      }
    };

    const riskLabels = {
      low: "Low Risk",
      med: "Medium Risk",
      high: "High Risk",
    };

    return (
      <>
        <section
          ref={ref}
          {...props}
          className={cn(
            "relative container mx-auto flex flex-col items-center justify-center py-24 px-4 text-center overflow-hidden min-h-[calc(100vh-4rem)]",
            className
          )}
        >
          {/* Background gradient effects */}
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
              style={{ animationDelay: "1s" }}
            />
          </div>

          {/* Info badge */}
          {infoBadgeText && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              {infoBadgeText}
            </div>
          )}

          {/* Main heading with typewriter */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-5xl">
            {title}
            <span className="block mt-2 bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              {displayText}
              <span className="animate-pulse">|</span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
            {subtitle}
          </p>

          {/* CTA Section - Fixed height to prevent layout shift */}
          <div className="mt-10 flex flex-col items-center gap-6 min-h-[120px]">
            {isCheckingProfile ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Checking profile...</span>
              </div>
            ) : (
              <>
                <ConnectButton
                  client={client}
                  wallets={wallets}
                  theme={isDark ? "dark" : "light"}
                  connectButton={{
                    label: "Connect Wallet",
                    className:
                      "!px-8 !py-6 !text-lg !font-semibold !rounded-xl !shadow-lg hover:!shadow-xl transition-all",
                  }}
                  connectModal={{
                    title: "Select a Wallet",
                    showThirdwebBranding: false,
                  }}
                />

                {/* Social proof */}
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <div className="flex -space-x-3">
                    {avatars.map((a, i) => (
                      <Avatar
                        key={i}
                        className="border-2 border-background ring-2 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-110 cursor-pointer"
                      >
                        <AvatarImage src={a.src} alt={a.alt} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">
                          {a.fallback}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground font-medium">
                    {socialProofText}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Mint Modal - 🔒 EXTRA SAFETY: Multiple guards to prevent flash */}
        {showMintModal &&
          hasHydrated &&
          isConnected &&
          address &&
          hasProfile === false && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 p-6 sm:p-8 text-white shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Create Risk Profile</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMintModal(false)}
                    className="hover:bg-zinc-800 rounded-full"
                    disabled={isMinting}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {!mintSuccess ? (
                  <>
                    {/* Instructions */}
                    <p className="text-sm text-zinc-400 mb-6">
                      Allocate your risk tolerance across three categories.
                      Total must equal 100%.
                    </p>

                    {/* Allocation Inputs */}
                    <div className="space-y-5 mb-6">
                      {(["low", "med", "high"] as const).map((k) => (
                        <div key={k} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-zinc-300">
                              {riskLabels[k]}
                            </label>
                            <span className="text-sm font-semibold text-white">
                              {allocations[k]}%
                            </span>
                          </div>
                          {/* Slider */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={allocations[k]}
                            onChange={(e) =>
                              handleSliderChange(k, Number(e.target.value))
                            }
                            disabled={isMinting}
                            className={cn(
                              "w-full h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                              "bg-zinc-800"
                            )}
                            style={{
                              background: `linear-gradient(to right, 
                              ${k === "low" ? "#10b981" : k === "med" ? "#f59e0b" : "#ef4444"} 0%, 
                              ${k === "low" ? "#10b981" : k === "med" ? "#f59e0b" : "#ef4444"} ${allocations[k]}%, 
                              #27272a ${allocations[k]}%, 
                              #27272a 100%)`,
                            }}
                          />
                          {/* Number input */}
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={allocations[k]}
                            onChange={(e) =>
                              handleChange(k, Number(e.target.value))
                            }
                            disabled={isMinting}
                            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Total Display */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 mb-6">
                      <span className="text-sm font-medium text-zinc-300">
                        Total Allocation
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xl font-bold",
                            isValid ? "text-green-400" : "text-red-400"
                          )}
                        >
                          {total}%
                        </span>
                        {isValid ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                    </div>

                    {/* Validation Message */}
                    {!isValid && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
                        <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-400">
                          Total allocation must equal 100%
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="flex items-start gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-6">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowMintModal(false)}
                        disabled={isMinting}
                        className="flex-1 border-zinc-700 hover:bg-zinc-800"
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={!isValid || isMinting}
                        onClick={handleMintNFT}
                        className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isMinting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Minting...
                          </>
                        ) : (
                          "Mint NFT Profile"
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  /* Success State */
                  <div className="text-center py-8">
                    <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 animate-in zoom-in duration-300">
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Profile Created!</h3>
                    <p className="text-zinc-400">
                      Your risk profile NFT has been minted successfully.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        <Toaster />
      </>
    );
  }
);

HeroSection.displayName = "HeroSection";
export { HeroSection };
