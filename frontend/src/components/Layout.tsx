import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../api";
import { formatNumber } from "../lib/format";

export default function Layout({ children }: { children: ReactNode }) {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white hover:text-gray-200 transition-colors">
            Poly Dearboard
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-400">
            <Link to="/" className="hover:text-white transition-colors">
              Leaderboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">{children}</main>

      <footer className="border-t border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-gray-500">
          <span>Polymarket On-Chain Leaderboard</span>
          {health && (
            <div className="flex items-center gap-4">
              <span>{formatNumber(health.trade_count)} trades</span>
              <span>{formatNumber(health.trader_count)} traders</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                #{formatNumber(health.latest_block)}
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
