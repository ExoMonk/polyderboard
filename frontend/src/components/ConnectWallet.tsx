import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";

export default function ConnectWallet() {
  const { address, isAuthenticated, signIn, signOut, isLoading } = useAuth();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const connectors = useConnectors();
  const [showConnectors, setShowConnectors] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  // Track whether we triggered sign-in for this connection — prevents retry loop
  const signInTriggered = useRef(false);

  // Reset trigger when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      signInTriggered.current = false;
    }
  }, [isConnected]);

  // Auto-trigger sign-in when wallet connects but not yet authenticated
  useEffect(() => {
    if (isConnected && !isAuthenticated && !signing && !isLoading && !signInTriggered.current) {
      signInTriggered.current = true;
      setSigning(true);
      setError("");
      signIn()
        .catch((err) => {
          const msg = err?.message || "Sign-in failed";
          if (msg.includes("User rejected") || msg.includes("user rejected")) {
            setError("Signature rejected");
          } else {
            setError("Sign-in failed");
          }
        })
        .finally(() => setSigning(false));
    }
  }, [isConnected, isAuthenticated, signing, isLoading, signIn]);

  if (isLoading) return null;

  // Authenticated: show address + disconnect
  if (isAuthenticated && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-[var(--accent-blue)]">{short}</span>
        <motion.button
          whileHover={{ y: -1 }}
          transition={{ duration: 0.15 }}
          onClick={signOut}
          title="Disconnect wallet"
          className="text-[var(--text-secondary)] hover:text-red-400 transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </motion.button>
      </div>
    );
  }

  // Signing in progress
  if (signing) {
    return (
      <span className="text-sm text-[var(--text-secondary)]">
        Signing...
      </span>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15 }}
        onClick={() => setShowConnectors(!showConnectors)}
        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold transition-all hover:brightness-110"
      >
        Connect Wallet
      </motion.button>

      <AnimatePresence>
        {showConnectors && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 glass rounded-lg p-2 min-w-[180px] z-50"
          >
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => {
                  setShowConnectors(false);
                  setError("");
                  connect({ connector });
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--surface-primary)] transition-colors"
              >
                {connector.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute right-0 top-full mt-2 text-xs text-red-400 whitespace-nowrap"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
