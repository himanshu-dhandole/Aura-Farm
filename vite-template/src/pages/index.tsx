import { config } from "@/config/wagmiConfig";
import DefaultLayout from "@/layouts/default";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { useAccount } from "wagmi";

import VITE_VIRTUAL_USDT_ABI from "@/abi/VirtualUSDC.json";
import VITE_AURA_VAULT_ABI from "@/abi/AuraVault.json";
import VITE_RISK_NFT_ABI from "@/abi/RiskNFT.json";

const VITE_VIRTUAL_USDT_ADDRESS = import.meta.env
  .VITE_VIRTUAL_USDT_ADDRESS as `0x${string}`;
const VITE_RISK_NFT_ADDRESS = import.meta.env
  .VITE_RISK_NFT_ADDRESS as `0x${string}`;
const VITE_AURA_VAULT_ADDRESS = import.meta.env
  .VITE_AURA_VAULT_ADDRESS as `0x${string}`;

export default function IndexPage() {
  const { address } = useAccount();
  const deposit = async () => {
    if (!address) return;

    try {
      const amount = 1_000 * 1e18; // 1000 USDT with 18 decimals

      // 1. Check allowance
      const allowance = (await readContract(config, {
        address: VITE_VIRTUAL_USDT_ADDRESS,
        abi: VITE_VIRTUAL_USDT_ABI,
        functionName: "allowance",
        args: [address, VITE_AURA_VAULT_ADDRESS],
      })) as bigint;

      // 2. Approve if needed
      if (allowance < amount) {
        const approveTx = await writeContract(config, {
          address: VITE_VIRTUAL_USDT_ADDRESS,
          abi: VITE_VIRTUAL_USDT_ABI,
          functionName: "approve",
          args: [VITE_AURA_VAULT_ADDRESS, amount],
        });

        await waitForTransactionReceipt(config, { hash: approveTx });
      }

      // 3. Deposit into AuraVault (ERC4626)
      const depositTx = await writeContract(config, {
        address: VITE_AURA_VAULT_ADDRESS,
        abi: VITE_AURA_VAULT_ABI,
        functionName: "deposit",
        args: [amount],
      });

      alert("Deposit sent. Waiting for confirmation...");
      await waitForTransactionReceipt(config, { hash: depositTx });

      alert("Deposit successful 🚀");
    } catch (err) {
      console.error(err);
      alert("Deposit failed");
    }
  };

  const airdrop = async () => {
    if (!address) return;
    try {
      const tx = await writeContract(config, {
        address: VITE_VIRTUAL_USDT_ADDRESS,
        abi: VITE_VIRTUAL_USDT_ABI,
        functionName: "mint",
        args: [address, 10_000 * 1e18],
      });

      alert("Transaction sent. Waiting for confirmation...");
      const receipt = await waitForTransactionReceipt(config, { hash: tx });
    } catch (err) {
      console.error(err);
      alert("Airdrop failed.");
    }
  };

  const userbalance = async () => {
    if (!address) return;
    try {
      const balance = (await readContract(config, {
        address: VITE_VIRTUAL_USDT_ADDRESS,
        abi: VITE_VIRTUAL_USDT_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      console.log("User balance:", Number(balance) / 1e18);
    } catch (err) {
      console.error(err);
    }
  };

  const mintNFT = async () => {
    if (!address) return;
    try {
      const tx = await writeContract(config, {
        address: VITE_RISK_NFT_ADDRESS,
        abi: VITE_RISK_NFT_ABI,
        functionName: "mint", // Replace with actual function name
        args: [address, 20, 50, 30],
      });
      alert("NFT mint transaction sent. Waiting for confirmation...");
      await waitForTransactionReceipt(config, { hash: tx });
      alert("NFT minted successfully 🚀");
    } catch (err) {
      console.error(err);
      alert("NFT minting failed");
    }
  };

  const getRiskProfile = async () => {
    if (!address) return;
    try {
      const profile = await readContract(config, {
        address: VITE_RISK_NFT_ADDRESS,
        abi: VITE_RISK_NFT_ABI,
        functionName: "getRiskProfile", // Replace with actual function name
        args: [address],
      });
      console.log("Risk Profile:", profile);
    } catch (err) {
      console.error(err);
    }
  };

  const withdraw = async () => {
    if (!address) return;
    try { 
      const tx = await writeContract(config, {
        address: VITE_AURA_VAULT_ADDRESS,
        abi: VITE_AURA_VAULT_ABI,
        functionName: "withdraw",
        args: [100 * 1e18],
      });
      alert("Withdraw transaction sent. Waiting for confirmation...");
      const receipt = await waitForTransactionReceipt(config, { hash: tx });
      if (receipt.status === "success") {
        alert("Withdraw successful 🚀");
      } else { 
        alert("Withdraw failed");
      }
      
    } catch (err) {   
      console.error(err);
    }
  };

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <button
          onClick={airdrop}
          className="px-6 py-3 rounded-lg bg-green-600 text-white"
        >
          Claim 10,000 vUSDT Airdrop
        </button>
        <button
          onClick={deposit}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white"
        >
          Deposit 1000$
        </button>
        <button
          onClick={userbalance}
          className="px-6 py-3 rounded-lg bg-yellow-600 text-white"
        >
          Check vUSDT Balance
        </button>
        <button
          onClick={mintNFT}
          className="px-6 py-3 rounded-lg bg-purple-600 text-white"
        >
          Mint Risk NFT
        </button>

        <button
          onClick={getRiskProfile}
          className="px-6 py-3 rounded-lg bg-pink-600 text-white"
        >
          Get Risk Profile
        </button>
        <button
          onClick={withdraw}
          className="px-6 py-3 rounded-lg bg-red-600 text-white"
        >
          Withdraw 100$
        </button>
      </section>
    </DefaultLayout>
  );
}
