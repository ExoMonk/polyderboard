import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchLeaderboard } from "../api";
import type { SortColumn, SortOrder } from "../types";
import Spinner from "../components/Spinner";
import Pagination from "../components/Pagination";
import AddressCell from "../components/AddressCell";
import SortHeader from "../components/SortHeader";
import PnlDistribution from "../charts/PnlDistribution";
import { formatUsd, formatNumber, formatDate } from "../lib/format";

const PAGE_SIZE = 25;

export default function Dashboard() {
  const [sort, setSort] = useState<SortColumn>("realized_pnl");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard", sort, order, offset],
    queryFn: () => fetchLeaderboard({ sort, order, limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  });

  function handleSort(col: SortColumn) {
    if (col === sort) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(col);
      setOrder("desc");
    }
    setOffset(0);
  }

  if (isLoading) return <Spinner />;
  if (error) return <div className="text-red-400 text-center py-10">Failed to load leaderboard</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <span className="text-sm text-gray-500">{data.total.toLocaleString()} traders</span>
      </div>

      {data.traders.length > 0 && <PnlDistribution traders={data.traders.slice(0, 15)} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-3 py-2 text-left w-12">#</th>
              <th className="px-3 py-2 text-left">Trader</th>
              <SortHeader label="PnL" column="realized_pnl" currentSort={sort} currentOrder={order} onSort={handleSort} />
              <SortHeader label="Volume" column="total_volume" currentSort={sort} currentOrder={order} onSort={handleSort} />
              <SortHeader label="Trades" column="trade_count" currentSort={sort} currentOrder={order} onSort={handleSort} />
              <th className="px-3 py-2 text-right">Markets</th>
              <th className="px-3 py-2 text-right hidden lg:table-cell">First</th>
              <th className="px-3 py-2 text-right hidden lg:table-cell">Last</th>
            </tr>
          </thead>
          <tbody>
            {data.traders.map((t, i) => {
              const pnl = parseFloat(t.realized_pnl);
              return (
                <tr key={t.address} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 font-mono">{offset + i + 1}</td>
                  <td className="px-3 py-2.5">
                    <AddressCell address={t.address} />
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatUsd(t.realized_pnl)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-300">{formatUsd(t.total_volume)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-300">{formatNumber(t.trade_count)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-400">{formatNumber(t.markets_traded)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500 hidden lg:table-cell">{formatDate(t.first_trade)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500 hidden lg:table-cell">{formatDate(t.last_trade)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
    </div>
  );
}
