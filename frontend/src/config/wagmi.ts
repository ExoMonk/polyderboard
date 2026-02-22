import { http, createConfig } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected, coinbaseWallet } from "@wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [polygon],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "PolyDerboard" }),
  ],
  transports: {
    [polygon.id]: http(),
  },
});
