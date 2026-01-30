import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/index";
import DocsPage from "@/pages/docs";
import PricingPage from "@/pages/pricing";
import BlogPage from "@/pages/deposit";
import AboutPage from "@/pages/about";
import Deposit from "@/pages/deposit";
import Profile from "./pages/profile";
import VaultDashboard from "./pages/vault";

function App() {
  return (
    <Routes>
      <Route element={<IndexPage />} path="/" />
      <Route element={<DocsPage />} path="/docs" />
      <Route element={<PricingPage />} path="/pricing" />
      <Route element={<BlogPage />} path="/blog" />
      <Route element={<AboutPage />} path="/about" />
      <Route element={<Deposit />} path="/deposit" />
      <Route element={<Profile />} path="/profile" />
      <Route element={<VaultDashboard />} path="/vault" />
    </Routes>
  );
}

export default App;
