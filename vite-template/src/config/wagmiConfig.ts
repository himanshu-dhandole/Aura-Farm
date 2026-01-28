import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [sepolia.id]: http(
      'https://rpc.ankr.com/eth_sepolia/e1368674b6a38d7ca1b503d1b995764cd946b33c5b14ac861a09b0689fa16449'
    ),
  },
})
