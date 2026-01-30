import React from "react";
import {
  Brain,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Database,
  Cpu,
  Coins,
  ArrowRight as ArrowRightAlt,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable components matching the HTML structure
const NavLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <a href={href} className="hover:text-[#13ec5b] transition-colors">
    {children}
  </a>
);

const Hero = () => {
  return (
    <div className="bg-[#050505] text-white font-sans overflow-x-hidden selection:bg-[#13ec5b] selection:text-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="text-[#13ec5b] w-6 h-6" />
            <span className="font-bold tracking-tight text-lg">Aura-Farm</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
              <NavLink href="#">Methodology</NavLink>
              <NavLink href="#">Performance</NavLink>
              <NavLink href="#">Docs</NavLink>
            </div>
            <button className="bg-[#111613] border border-white/10 hover:border-[#13ec5b]/50 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all text-[#13ec5b] hover:text-[#0fd652] hover:bg-[#13ec5b]/5">
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>

      {/* Header Section */}
      <header className="relative pt-32 pb-20 px-6 border-b border-white/5 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #13ec5b1a 1px, transparent 1px), linear-gradient(to bottom, #13ec5b1a 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="max-w-5xl mx-auto relative z-10 text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#13ec5b]/20 bg-[#13ec5b]/5 text-[#13ec5b] text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-2 h-2 rounded-full bg-[#13ec5b] animate-pulse" />
            AI-Driven Yield Aggregator
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
            Precision Portfolio <br /> Management
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Utilizing Soulbound NFTs to construct a personalized risk profile
            and maximize yield efficiency via our proprietary Nitrolite L3.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-4 md:gap-8 items-stretch mb-12">
          {/* Card 1: Risk Assessment */}
          <div className="relative group bg-[#111613] border border-white/5 hover:border-[#13ec5b]/30 transition-all duration-500 rounded-2xl p-8 md:p-12 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <ShieldCheck className="w-[120px] h-[120px]" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Database className="text-gray-500 w-5 h-5" />
                <h3 className="text-gray-400 text-sm font-mono uppercase tracking-widest">
                  User Risk Assessment
                </h3>
              </div>
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-7xl md:text-8xl font-bold text-white tracking-tighter">
                  49
                </span>
                <span className="text-2xl text-gray-500 font-medium">
                  / 100
                </span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-[#13ec5b] w-[49%] rounded-full"
                  style={{ boxShadow: "0 0 15px rgba(19,236,91,0.5)" }}
                />
              </div>
              <p className="text-sm text-gray-400">
                <span className="text-[#13ec5b] font-bold">
                  Moderate Profile.
                </span>{" "}
                Based on on-chain history and wallet behavior.
              </p>
            </div>
          </div>

          {/* Card 2: APY */}
          <div className="relative group bg-[#111613] border border-white/5 hover:border-[#13ec5b]/30 transition-all duration-500 rounded-2xl p-8 md:p-12 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <TrendingUp className="w-[120px] h-[120px]" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-gray-500 w-5 h-5" />
                <h3 className="text-gray-400 text-sm font-mono uppercase tracking-widest">
                  Projected Blended APY
                </h3>
              </div>
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-7xl md:text-8xl font-bold text-[#13ec5b] tracking-tighter">
                  18.4%
                </span>
              </div>
              <div className="flex items-end gap-1 h-8 mb-4 opacity-50">
                <div className="w-full bg-[#13ec5b]/20 h-[40%] rounded-sm" />
                <div className="w-full bg-[#13ec5b]/40 h-[60%] rounded-sm" />
                <div className="w-full bg-[#13ec5b]/60 h-[50%] rounded-sm" />
                <div className="w-full bg-[#13ec5b]/80 h-[80%] rounded-sm" />
                <div
                  className="w-full bg-[#13ec5b] h-[90%] rounded-sm"
                  style={{ boxShadow: "0 0 10px rgba(19,236,91,0.5)" }}
                />
              </div>
              <p className="text-sm text-gray-400">
                Optimized across 12 protocols including{" "}
                <span className="text-white">Aave</span>,{" "}
                <span className="text-white">Curve</span>, and{" "}
                <span className="text-white">Convex</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-center relative z-20">
          <button className="group relative px-8 py-5 bg-white text-black text-lg font-bold rounded-xl overflow-hidden hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            <div className="absolute inset-0 bg-[#13ec5b] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 flex items-center gap-3 group-hover:text-black transition-colors">
              Start Your 2-Minute Assessment
              <ArrowRight className="group-hover:translate-x-1 transition-transform w-5 h-5" />
            </span>
          </button>
        </div>
      </header>

      {/* Architecture Section */}
      <section className="py-24 border-b border-white/5 bg-[#0e120f] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/3 space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold">RAG Architecture</h2>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Our Retrieval-Augmented Generation (RAG) engine ingests
                  real-time DeFi yields, cross-references with your Soulbound
                  Risk NFT, and outputs the optimal strategy allocation.
                </p>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded bg-[#13ec5b]/10 text-[#13ec5b] border border-[#13ec5b]/20 text-xs font-bold font-mono">
                    01
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Market Ingestion
                    </h4>
                    <p className="text-xs text-gray-400">
                      Real-time scraping of 50+ yield sources.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/5">
                  <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded bg-[#13ec5b]/10 text-[#13ec5b] border border-[#13ec5b]/20 text-xs font-bold font-mono">
                    02
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Vector Embedding
                    </h4>
                    <p className="text-xs text-gray-400">
                      Contextualizing yields with risk vectors.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Diagram */}
            <div className="lg:w-2/3 w-full bg-[#111613] border border-white/5 rounded-2xl p-8 md:p-12 relative overflow-hidden group">
              <div
                className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #13ec5b1a 1px, transparent 1px), linear-gradient(to bottom, #13ec5b1a 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 relative z-10 items-center">
                <div className="md:col-span-2 bg-black/40 border border-dashed border-white/20 p-6 rounded-lg text-center backdrop-blur-sm">
                  <Database className="text-[#13ec5b] mb-3 w-8 h-8 mx-auto" />
                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
                    Input Source
                  </div>
                  <div className="font-bold text-sm">Yield Data</div>
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-center text-gray-600">
                  <ArrowRightAlt className="animate-pulse w-6 h-6" />
                </div>
                <div className="md:col-span-1 bg-[#13ec5b]/5 border border-[#13ec5b]/30 p-8 rounded-full text-center relative shadow-[0_0_40px_rgba(19,236,91,0.1)] flex items-center justify-center aspect-square mx-auto">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#0e120f] px-3 py-1 text-[10px] text-[#13ec5b] font-bold uppercase tracking-widest border border-[#13ec5b]/30 rounded-full whitespace-nowrap">
                    AI Core
                  </div>
                  <div className="flex flex-col items-center">
                    <Cpu className="text-white w-10 h-10 mb-1" />
                    <div className="text-[10px] font-mono text-gray-500 uppercase">
                      RAG Engine
                    </div>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-center text-gray-600">
                  <ArrowRightAlt className="animate-pulse w-6 h-6" />
                </div>
                <div className="md:col-span-2 bg-black/40 border border-dashed border-white/20 p-6 rounded-lg text-center backdrop-blur-sm">
                  <Coins className="text-[#13ec5b] mb-3 w-8 h-8 mx-auto" />
                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
                    Output Strategy
                  </div>
                  <div className="font-bold text-sm">Optimized Vault</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Efficiency Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-[#0e120f] to-transparent -z-10" />
        <div className="max-w-4xl mx-auto text-center mb-16 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Efficiency at Scale
          </h2>
          <p className="text-gray-400">Powered by Nitrolite L3 aggregation.</p>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="bg-[#111613] border border-white/10 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center h-full relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(19,236,91,0.05),transparent_60%)]" />
            <div className="relative z-10">
              <div className="text-[100px] md:text-[120px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-[#13ec5b] to-green-900/20 tracking-tighter">
                99.8%
              </div>
              <h3 className="text-2xl font-bold text-white mt-4">
                Gas Savings
              </h3>
              <p className="text-gray-500 mt-2 text-sm max-w-xs mx-auto">
                Compared to standard Ethereum mainnet interactions for complex
                yield routing.
              </p>
            </div>
          </div>
          <div className="space-y-10">
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400 font-medium">
                  Standard DeFi Portfolio Rebalance
                </span>
                <span className="text-red-400 font-mono">~$45.00</span>
              </div>
              <div className="h-6 bg-white/5 rounded-full overflow-hidden w-full flex items-center px-1">
                <div className="h-4 bg-red-500/50 w-full rounded-full" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-white font-bold">
                  Aura-Farm with Nitrolite
                </span>
                <span className="text-[#13ec5b] font-mono font-bold">
                  ~$0.09
                </span>
              </div>
              <div className="h-6 bg-white/5 rounded-full overflow-hidden w-full relative flex items-center px-1">
                <div className="h-4 bg-[#13ec5b] w-[1%] rounded-full shadow-[0_0_15px_#13ec5b] animate-pulse" />
              </div>
            </div>
            <div className="bg-[#13ec5b]/5 border border-[#13ec5b]/10 rounded-xl p-6 flex gap-4 items-start">
              <div className="p-2 bg-[#13ec5b]/10 rounded-lg">
                <Zap className="text-[#13ec5b] shrink-0 w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm mb-1">
                  Batch Validity Proofs
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Nitrolite batches thousands of user transactions into single
                  validity proofs, drastically reducing calldata costs while
                  maintaining non-custodial security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <Brain className="text-[#13ec5b] text-xl" />
            <span className="font-bold text-white text-sm">
              Aura-Farm © 2024
            </span>
          </div>
          <div className="flex gap-6 text-xs text-gray-600">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <span>Not financial advice.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Hero;
