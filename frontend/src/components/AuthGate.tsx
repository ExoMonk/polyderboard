import { useState, useEffect, type ReactNode } from "react";
import { motion } from "motion/react";

const STORAGE_KEY = "pd_access_code";
const BASE = import.meta.env.VITE_API_URL || "/api";

async function verifyCode(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check stored code on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setAuthed(false);
      return;
    }
    verifyCode(stored).then((ok) => {
      if (ok) {
        setAuthed(true);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setAuthed(false);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    const ok = await verifyCode(code.trim());
    if (ok) {
      localStorage.setItem(STORAGE_KEY, code.trim());
      setAuthed(true);
    } else {
      setError("Invalid access code");
    }
    setLoading(false);
  };

  // Still checking stored code
  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="glass p-8 rounded-xl w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-blue-500/20">
            PD
          </div>
          <h1 className="text-xl font-bold gradient-text">PolyDerboard</h1>
          <p className="text-sm text-[var(--text-secondary)]">Enter access code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-[var(--surface-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
          />
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-400 text-center"
            >
              {error}
            </motion.p>
          )}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
