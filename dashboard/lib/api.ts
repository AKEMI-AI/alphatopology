export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface MarketData {
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  currency: string | null;
  live: boolean;
  provider?: string | null;
  as_of?: string | null;
}

export interface Telemetry {
  metric: string;
  value: string;
  status: string;
  lead_time_trend: string;
  data_source?: 'FIXTURE_ESTIMATE' | string;
}

export interface TelemetryNode {
  id: string;
  ticker: string;
  name: string;
  market_data: MarketData;
  telemetry: Telemetry;
}

export interface Forecast {
  ticker: string;
  provider: string;
  as_of: string;
  current_price: number | null;
  target_mean: number | null;
  target_high: number | null;
  target_low: number | null;
  analyst_count: number | null;
  recommendation: string | null;
  forward_pe: number | null;
  trailing_pe: number | null;
  forward_eps: number | null;
  revenue_growth: number | null;
  earnings_growth: number | null;
  ev_to_ebitda: number | null;
}

export interface HistoryPoint {
  time: string | number;
  value: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // API down — callers fall back gracefully
  }
}

export const fetchTelemetry = () =>
  getJson<{ metadata: Record<string, unknown>; nodes: TelemetryNode[] }>('/market/telemetry');

export const fetchHistory = (ticker: string, period = '1mo') =>
  getJson<{ data: HistoryPoint[] }>(
    `/market/history/${encodeURIComponent(ticker)}?period=${period}`
  );

export const fetchForecast = (ticker: string) =>
  getJson<Forecast>(`/market/forecast/${encodeURIComponent(ticker)}`);
