// import { config } from "@/config/wagmiConfig";
// import DefaultLayout from "@/layouts/default";
// import {
//   readContract,
//   waitForTransactionReceipt,
//   writeContract,
// } from "@wagmi/core";
// import { useAccount } from "wagmi";

// import VITE_VIRTUAL_USDT_ABI from "@/abi/VirtualUSDC.json";
// import VITE_AURA_VAULT_ABI from "@/abi/AuraVault.json";
// import VITE_RISK_NFT_ABI from "@/abi/RiskNFT.json";

// const VITE_VIRTUAL_USDT_ADDRESS = import.meta.env
//   .VITE_VIRTUAL_USDT_ADDRESS as `0x${string}`;
// const VITE_RISK_NFT_ADDRESS = import.meta.env
//   .VITE_RISK_NFT_ADDRESS as `0x${string}`;
// const VITE_AURA_VAULT_ADDRESS = import.meta.env
//   .VITE_AURA_VAULT_ADDRESS as `0x${string}`;

// export default function IndexPage() {
//   const { address } = useAccount();
//   const deposit = async () => {
//     if (!address) return;

//     try {
//       const amount = 1_000 * 1e18; // 1000 USDT with 18 decimals

//       // 1. Check allowance
//       const allowance = (await readContract(config, {
//         address: VITE_VIRTUAL_USDT_ADDRESS,
//         abi: VITE_VIRTUAL_USDT_ABI,
//         functionName: "allowance",
//         args: [address, VITE_AURA_VAULT_ADDRESS],
//       })) as bigint;

//       // 2. Approve if needed
//       if (allowance < amount) {
//         const approveTx = await writeContract(config, {
//           address: VITE_VIRTUAL_USDT_ADDRESS,
//           abi: VITE_VIRTUAL_USDT_ABI,
//           functionName: "approve",
//           args: [VITE_AURA_VAULT_ADDRESS, amount],
//         });

//         await waitForTransactionReceipt(config, { hash: approveTx });
//       }

//       // 3. Deposit into AuraVault (ERC4626)
//       const depositTx = await writeContract(config, {
//         address: VITE_AURA_VAULT_ADDRESS,
//         abi: VITE_AURA_VAULT_ABI,
//         functionName: "deposit",
//         args: [amount],
//       });

//       alert("Deposit sent. Waiting for confirmation...");
//       await waitForTransactionReceipt(config, { hash: depositTx });

//       alert("Deposit successful 🚀");
//     } catch (err) {
//       console.error(err);
//       alert("Deposit failed");
//     }
//   };

//   const airdrop = async () => {
//     if (!address) return;
//     try {
//       const tx = await writeContract(config, {
//         address: VITE_VIRTUAL_USDT_ADDRESS,
//         abi: VITE_VIRTUAL_USDT_ABI,
//         functionName: "mint",
//         args: [address, 10_000 * 1e18],
//       });

//       alert("Transaction sent. Waiting for confirmation...");
//       const receipt = await waitForTransactionReceipt(config, { hash: tx });
//     } catch (err) {
//       console.error(err);
//       alert("Airdrop failed.");
//     }
//   };

//   const userbalance = async () => {
//     if (!address) return;
//     try {
//       const balance = (await readContract(config, {
//         address: VITE_VIRTUAL_USDT_ADDRESS,
//         abi: VITE_VIRTUAL_USDT_ABI,
//         functionName: "balanceOf",
//         args: [address],
//       })) as bigint;
//       console.log("User balance:", Number(balance) / 1e18);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const mintNFT = async () => {
//     if (!address) return;
//     try {
//       const tx = await writeContract(config, {
//         address: VITE_RISK_NFT_ADDRESS,
//         abi: VITE_RISK_NFT_ABI,
//         functionName: "mint", // Replace with actual function name
//         args: [address, 20, 50, 30],
//       });
//       alert("NFT mint transaction sent. Waiting for confirmation...");
//       await waitForTransactionReceipt(config, { hash: tx });
//       alert("NFT minted successfully 🚀");
//     } catch (err) {
//       console.error(err);
//       alert("NFT minting failed");
//     }
//   };

//   const getRiskProfile = async () => {
//     if (!address) return;
//     try {
//       const profile = await readContract(config, {
//         address: VITE_RISK_NFT_ADDRESS,
//         abi: VITE_RISK_NFT_ABI,
//         functionName: "getRiskProfile", // Replace with actual function name
//         args: [address],
//       });
//       console.log("Risk Profile:", profile);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const withdraw = async () => {
//     if (!address) return;
//     try { 
//       const tx = await writeContract(config, {
//         address: VITE_AURA_VAULT_ADDRESS,
//         abi: VITE_AURA_VAULT_ABI,
//         functionName: "withdraw",
//         args: [100 * 1e18],
//       });
//       alert("Withdraw transaction sent. Waiting for confirmation...");
//       const receipt = await waitForTransactionReceipt(config, { hash: tx });
//       if (receipt.status === "success") {
//         alert("Withdraw successful 🚀");
//       } else { 
//         alert("Withdraw failed");
//       }
      
//     } catch (err) {   
//       console.error(err);
//     }
//   };



//   return (
//     <DefaultLayout>
//       <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
//         <button
//           onClick={airdrop}
//           className="px-6 py-3 rounded-lg bg-green-600 text-white"
//         >
//           Claim 10,000 vUSDT Airdrop
//         </button>
//         <button
//           onClick={deposit}
//           className="px-6 py-3 rounded-lg bg-blue-600 text-white"
//         >
//           Deposit 1000$
//         </button>
//         <button
//           onClick={userbalance}
//           className="px-6 py-3 rounded-lg bg-yellow-600 text-white"
//         >
//           Check vUSDT Balance
//         </button>
//         <button
//           onClick={mintNFT}
//           className="px-6 py-3 rounded-lg bg-purple-600 text-white"
//         >
//           Mint Risk NFT
//         </button>

//         <button
//           onClick={getRiskProfile}
//           className="px-6 py-3 rounded-lg bg-pink-600 text-white"
//         >
//           Get Risk Profile
//         </button>
//         <button
//           onClick={withdraw}
//           className="px-6 py-3 rounded-lg bg-red-600 text-white"
//         >
//           Withdraw 100$
//         </button>
//       </section>
//     </DefaultLayout>
//   );
// }
import { config } from "@/config/wagmiConfig";
import DefaultLayout from "@/layouts/default";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { useAccount } from "wagmi";

import USDT_ABI from "@/abi/VirtualUSDC.json";
import VAULT_ABI from "@/abi/AuraVault.json";
import RISK_ABI from "@/abi/RiskNFT.json";

const USDT = import.meta.env.VITE_VIRTUAL_USDT_ADDRESS as `0x${string}`;
const RISK = import.meta.env.VITE_RISK_NFT_ADDRESS as `0x${string}`;
const VAULT = import.meta.env.VITE_AURA_VAULT_ADDRESS as `0x${string}`;

const ONE = 10n ** 18n;

export default function IndexPage() {
  const { address } = useAccount();
  if (!address) return null;

  /* ---------------- AIRDROP ---------------- */
  const airdrop = async () => {
    const tx = await writeContract(config, {
      address: USDT,
      abi: USDT_ABI,
      functionName: "mint",
      args: [address, 10_000n * ONE],
    });
    await waitForTransactionReceipt(config, { hash: tx });
    alert("10,000 vUSDT minted");
  };

  /* ---------------- MINT RISK NFT ---------------- */
  const mintNFT = async () => {
    const tx = await writeContract(config, {
      address: RISK,
      abi: RISK_ABI,
      functionName: "mint",
      args: ["0x0757836242234fbbfD6A0967cDb089A521276dA3", 20, 50, 30],
    });
    await waitForTransactionReceipt(config, { hash: tx });
    alert("Risk NFT minted");
  };

  /* ---------------- DEPOSIT ---------------- */
  const deposit = async () => {
    const amount = 1_000n * ONE;

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
    alert("Deposited 1000 vUSDT");
  };

  /* ---------------- WITHDRAW ---------------- */
  const withdraw = async () => {
    const tx = await writeContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [100n * ONE],
    });
    await waitForTransactionReceipt(config, { hash: tx });
    alert("Withdrawn 100 AURA");
  };

  /* ---------------- READ USER STATE ---------------- */
  const readUser = async () => {
    const aura = await readContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    const deposit = await readContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "getUserDeposit",
      args: [address],
    });

    console.log("AURA Balance:", Number(aura) / 1e18);
    console.log("User Deposit:", deposit);
  };

  /* ---------------- READ VAULT STATE ---------------- */
  const readVault = async () => {
    const tvl = await readContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    });

    const apy = await readContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "estimatedVaultAPY",
    });

    console.log("TVL:", Number(tvl) / 1e18);
    console.log("APY:", Number(apy) / 100, "%");
  };

  /* ---------------- OWNER ACTIONS ---------------- */
  const harvest = async () => {
    const tx = await writeContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "harvestAll",
      account: address,
          gas: 5_000_000n,
    });
    await waitForTransactionReceipt(config, { hash: tx });
    alert("Harvested");
  };

  const rebalance = async () => {
    const tx = await writeContract(config, {
      address: VAULT,
      abi: VAULT_ABI,
      functionName: "rebalance",
    });
    await waitForTransactionReceipt(config, { hash: tx });
    alert("Rebalanced");
  };

  return (
    <DefaultLayout>
      <div className="flex flex-col gap-3 p-10">
        <button onClick={airdrop}>Airdrop vUSDT</button>
        <button onClick={mintNFT}>Mint Risk NFT</button>
        <button onClick={deposit}>Deposit 1000</button>
        <button onClick={withdraw}>Withdraw 100</button>

        <hr />

        <button onClick={readUser}>Read User</button>
        <button onClick={readVault}>Read Vault</button>

        <hr />

        <button onClick={harvest}>Harvest (Owner)</button>
        <button onClick={rebalance}>Rebalance (Owner)</button>
      </div>
    </DefaultLayout>
  );
}
