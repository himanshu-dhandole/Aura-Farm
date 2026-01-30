import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config/wagmiConfig.ts";
import { WagmiProvider } from "wagmi";
import { ThirdwebProvider } from "thirdweb/react";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(

    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider>
          <BrowserRouter>
            <Provider>
              <App />
            </Provider>
          </BrowserRouter>
        </ThirdwebProvider>
      </QueryClientProvider>
    </WagmiProvider>

);
