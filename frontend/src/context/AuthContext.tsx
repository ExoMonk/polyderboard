import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAccount, useDisconnect, useSignTypedData, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";
import { fetchNonce, verifySignature } from "../api";

const JWT_KEY = "pd_jwt";
const ADDR_KEY = "pd_address";

interface AuthState {
  address: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  address: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// EIP-712 domain matching the backend
const DOMAIN = {
  name: "PolyDerboard",
  version: "1",
  chainId: 137,
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

const SIGN_IN_TYPES = {
  SignIn: [
    { name: "wallet", type: "address" },
    { name: "nonce", type: "string" },
    { name: "issuedAt", type: "string" },
  ],
} as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { address: walletAddress, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  // Check for existing JWT on mount
  useEffect(() => {
    const token = localStorage.getItem(JWT_KEY);
    const storedAddr = localStorage.getItem(ADDR_KEY);
    if (token && storedAddr) {
      // Decode JWT to check expiry (no server round-trip)
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 > Date.now()) {
          setAddress(storedAddr);
        } else {
          localStorage.removeItem(JWT_KEY);
          localStorage.removeItem(ADDR_KEY);
        }
      } catch {
        localStorage.removeItem(JWT_KEY);
        localStorage.removeItem(ADDR_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async () => {
    if (!walletAddress) return;

    const addr = walletAddress.toLowerCase();

    // 0. Switch to Polygon if needed
    if (chainId !== polygon.id) {
      await switchChainAsync({ chainId: polygon.id });
    }

    // 1. Fetch nonce from backend
    const { nonce, issuedAt } = await fetchNonce(addr);

    // 2. Sign EIP-712 typed data (wallet field lowercased)
    const signature = await signTypedDataAsync({
      domain: DOMAIN,
      types: SIGN_IN_TYPES,
      primaryType: "SignIn",
      message: {
        wallet: addr as `0x${string}`,
        nonce,
        issuedAt,
      },
    });

    // 3. Verify signature with backend, get JWT
    const { token, address: verifiedAddr } = await verifySignature({
      address: addr,
      signature,
      nonce,
      issued_at: issuedAt,
    });

    // 4. Store JWT + address
    localStorage.setItem(JWT_KEY, token);
    localStorage.setItem(ADDR_KEY, verifiedAddr);
    setAddress(verifiedAddr);
  }, [walletAddress, chainId, signTypedDataAsync, switchChainAsync]);

  const signOut = useCallback(() => {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(ADDR_KEY);
    setAddress(null);
    disconnect();
  }, [disconnect]);

  return (
    <AuthContext.Provider
      value={{
        address,
        isAuthenticated: !!address,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
