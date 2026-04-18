/**
 * API service layer - connects to the FastAPI backend
 * Base URL: http://localhost:8000
 */

import type { FullData } from "@/lib/gridData";

// Vite proxies /api/* → http://localhost:8000 in dev
// In production, point to your deployed backend
const BASE_URL = "";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch complete detection data */
export async function fetchAllHouses(): Promise<FullData> {
  return fetchJSON<FullData>(`${BASE_URL}/api/houses`);
}

/** Fetch insights only */
export async function fetchInsights() {
  return fetchJSON(`${BASE_URL}/api/insights`);
}

/** Fetch transformer data */
export async function fetchTransformer() {
  return fetchJSON(`${BASE_URL}/api/transformer`);
}

/** Run simulation with theft increase percent (0–100) */
export async function runSimulation(percent: number): Promise<FullData> {
  return fetchJSON<FullData>(`${BASE_URL}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ percent }),
  });
}
