import { useState, useEffect, useRef, useCallback } from "react";
import type { PricePoint, MarketWsStatus, BidAsk, FeedTrade } from "../types";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const PING_INTERVAL_MS = 10_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_POINTS = 500;

interface Params {
  yesTokenId: string | null;
  noTokenId: string | null;
  /** Trades from our backend (updated on each poll) */
  trades?: FeedTrade[];
}

interface Result {
  priceHistory: PricePoint[];
  /** Timestamps where our indexer captured a trade (for chart markers) */
  tradeMarkers: Set<number>;
  bidAsk: BidAsk;
  status: MarketWsStatus;
  latestYesPrice: number | null;
}

function parseTradeTimestamp(ts: string): number {
  return new Date(ts.endsWith("Z") ? ts : ts + "Z").getTime();
}

export default function useMarketWs({ yesTokenId, noTokenId, trades }: Params): Result {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [tradeMarkers, setTradeMarkers] = useState<Set<number>>(new Set());
  const [bidAsk, setBidAsk] = useState<BidAsk>({ bestBid: null, bestAsk: null, spread: null });
  const [status, setStatus] = useState<MarketWsStatus>("disconnected");
  const [latestYesPrice, setLatestYesPrice] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef(0);
  const processedRef = useRef<Set<string>>(new Set());
  const yesRef = useRef(yesTokenId);
  const noRef = useRef(noTokenId);

  yesRef.current = yesTokenId;
  noRef.current = noTokenId;

  // Continuously incorporate new trades from backend polls into priceHistory
  useEffect(() => {
    if (!trades?.length || !yesTokenId) return;

    const newPoints: PricePoint[] = [];
    const newMarkers: number[] = [];

    for (const t of trades) {
      if (processedRef.current.has(t.tx_hash)) continue;
      processedRef.current.add(t.tx_hash);

      const price = parseFloat(t.price);
      if (isNaN(price)) continue;

      const ts = parseTradeTimestamp(t.block_timestamp);
      const yesPrice = t.asset_id === yesTokenId ? price : 1 - price;

      newPoints.push({ timestamp: ts, yesPrice, noPrice: 1 - yesPrice });
      newMarkers.push(ts);
    }

    if (newPoints.length > 0) {
      setPriceHistory((prev) => {
        const merged = [...prev, ...newPoints];
        merged.sort((a, b) => a.timestamp - b.timestamp);
        return merged.slice(-MAX_POINTS);
      });
      setTradeMarkers((prev) => {
        const next = new Set(prev);
        for (const ts of newMarkers) next.add(ts);
        return next;
      });
      // Update latest price from the newest trade
      const sorted = [...newPoints].sort((a, b) => a.timestamp - b.timestamp);
      setLatestYesPrice(sorted[sorted.length - 1].yesPrice);
    }
  }, [trades, yesTokenId]);

  const connect = useCallback(() => {
    if (!yesTokenId) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      retryRef.current = 0;

      const ids = [yesTokenId, noTokenId].filter(Boolean);
      ws.send(
        JSON.stringify({
          type: "market",
          assets_ids: ids,
          custom_feature_enabled: true,
        }),
      );

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("PING");
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      const raw = event.data;
      if (raw === "PONG") return;

      try {
        const msg = JSON.parse(raw);

        if (msg.type === "last_trade_price") {
          const tokenId: string = msg.payload.market;
          const price = parseFloat(msg.payload.last_trade_price);
          if (isNaN(price)) return;

          const yesPrice = tokenId === yesRef.current ? price : 1 - price;
          const point: PricePoint = {
            timestamp: Date.now(),
            yesPrice,
            noPrice: 1 - yesPrice,
          };

          setPriceHistory((prev) => [...prev, point].slice(-MAX_POINTS));
          setLatestYesPrice(yesPrice);
        }

        if (msg.type === "best_bid_ask" && msg.payload.market === yesRef.current) {
          const bid = parseFloat(msg.payload.best_bid);
          const ask = parseFloat(msg.payload.best_ask);
          setBidAsk({
            bestBid: isNaN(bid) ? null : bid,
            bestAsk: isNaN(ask) ? null : ask,
            spread: !isNaN(bid) && !isNaN(ask) ? ask - bid : null,
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      if (pingRef.current) clearInterval(pingRef.current);
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, retryRef.current),
        RECONNECT_MAX_MS,
      );
      retryRef.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [yesTokenId, noTokenId]);

  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { priceHistory, tradeMarkers, bidAsk, status, latestYesPrice };
}
