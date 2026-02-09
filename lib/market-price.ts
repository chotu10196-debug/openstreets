import { supabaseAdmin } from './supabase-admin';
import { getCurrentPrice } from './polygon';

const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface MarketPriceSnapshot {
  ticker: string;
  price: number;
  captured_at: string;
  source: string;
}

/**
 * Get current market price with smart caching
 * - Checks market_price_snapshots table first
 * - Returns cached price if < 15 minutes old
 * - Fetches fresh price from Polygon/Yahoo if stale
 * - Saves new snapshot to database
 *
 * @param ticker - Stock ticker symbol
 * @returns Price and source indicator (cache or fresh)
 */
export async function getCachedMarketPrice(
  ticker: string
): Promise<{ price: number; source: 'cache' | 'fresh' }> {
  const upperTicker = ticker.toUpperCase();

  // Check for recent snapshot
  const { data: snapshot, error } = await supabaseAdmin
    .from('market_price_snapshots')
    .select('*')
    .eq('ticker', upperTicker)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  // If we have a recent snapshot (< 15 minutes old), use it
  if (snapshot && !error) {
    const capturedAt = new Date(snapshot.captured_at).getTime();
    const now = Date.now();
    const age = now - capturedAt;

    if (age < CACHE_DURATION_MS) {
      console.log(`✅ Cache hit for ${upperTicker}: $${snapshot.price} (age: ${Math.floor(age / 1000)}s)`);
      return { price: parseFloat(snapshot.price), source: 'cache' };
    }
  }

  // Cache miss or stale - fetch fresh price
  console.log(`⏳ Cache miss for ${upperTicker}, fetching fresh price...`);
  const freshPrice = await getCurrentPrice(upperTicker);

  // Save new snapshot
  const { error: insertError } = await supabaseAdmin
    .from('market_price_snapshots')
    .insert({
      ticker: upperTicker,
      price: freshPrice,
      captured_at: new Date().toISOString(),
      source: 'polygon',
    });

  if (insertError) {
    console.error('Error saving market price snapshot:', insertError);
    // Don't fail the request if snapshot save fails
  }

  console.log(`✅ Fresh price for ${upperTicker}: $${freshPrice}`);
  return { price: freshPrice, source: 'fresh' };
}

/**
 * Validate if target price is within acceptable range
 * Target must be within ±50% of current market price
 *
 * @param targetPrice - Predicted target price
 * @param marketPrice - Current market price
 * @returns true if valid, false otherwise
 */
export function isTargetPriceValid(
  targetPrice: number,
  marketPrice: number
): boolean {
  const lowerBound = marketPrice * 0.5; // -50%
  const upperBound = marketPrice * 1.5; // +50%
  return targetPrice >= lowerBound && targetPrice <= upperBound;
}

/**
 * Calculate percentage change between two prices
 *
 * @param currentPrice - Current or target price
 * @param originalPrice - Original or baseline price
 * @returns Percentage change
 */
export function calculatePriceChange(
  currentPrice: number,
  originalPrice: number
): number {
  return ((currentPrice - originalPrice) / originalPrice) * 100;
}
