import Hero from "@/components/hero";
import { HeroSection } from "@/components/hero-4";
import DefaultLayout from "@/layouts/default";
import { createWallet } from "thirdweb/wallets";

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

const avatarData = [
  {
    src: "https://i.pravatar.cc/150?img=1",
    alt: "User 1",
    fallback: "U1",
  },
  {
    src: "https://i.pravatar.cc/150?img=2",
    alt: "User 2",
    fallback: "U2",
  },
  {
    src: "https://i.pravatar.cc/150?img=3",
    alt: "User 3",
    fallback: "U3",
  },
];

const Index = () => {
  return (
    <DefaultLayout>
      {/* ===========================
         HERO SECTION WITH SKIPER19
         =========================== */}
      <HeroSection
        title={<>AURA FARM</>}
        animatedTexts={[
          "NFT based risk profiles",
          "with AI-driven dynamic asset allocation",
          "zero liquidations !",
        ]}
        subtitle="Deposit once. Let Aura Farm optimize, rebalance, and compound your capital on-chain."
        infoBadgeText="Average DeFi yield strategies target 30% APY*"
        ctaButtonText="Start farming"
        socialProofText="Trusted by 4+ DeFi users"
        avatars={avatarData}
      />

      {/* <Hero /> */}
    </DefaultLayout>
  );
};

export default Index;
