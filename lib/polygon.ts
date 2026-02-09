// Stock price API with Polygon.io + Yahoo Finance fallback
// No mock data - fail if both APIs fail

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

export interface PolygonQuote {
  ticker: string;
  price: number;
  timestamp: number;
}

// Try Polygon.io API
async function getPolygonPrice(ticker: string): Promise<number> {
  if (!POLYGON_API_KEY) {
    throw new Error('Polygon API key not configured');
  }

  try {
    // Using Polygon.io v2 previous day aggregates (more reliable)
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLYGON_API_KEY}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`No data for ticker: ${ticker}`);
    }

    // Return the closing price from previous day
    return data.results[0].c;
  } catch (error) {
    // Only log if it's not a rate limit error (we'll fallback to Yahoo Finance)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('Too Many Requests') && !errorMessage.includes('429')) {
      console.error('Polygon API failed:', error);
    }
    throw error;
  }
}

// Fallback: Yahoo Finance (no API key needed)
async function getYahooPrice(ticker: string): Promise<number> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { 
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      throw new Error('No price data from Yahoo Finance');
    }

    return data.chart.result[0].meta.regularMarketPrice;
  } catch (error) {
    console.error('Yahoo Finance failed:', error);
    throw error;
  }
}

// Main function: Polygon → Yahoo → Fail
export async function getCurrentPrice(ticker: string): Promise<number> {
  const upperTicker = ticker.toUpperCase();
  
  // Try 1: Polygon.io (real-time, requires API key)
  if (POLYGON_API_KEY) {
    try {
      const price = await getPolygonPrice(upperTicker);
      // Only log successful Polygon calls in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Polygon price for ${upperTicker}: $${price}`);
      }
      return price;
    } catch (polygonError) {
      // Only log non-rate-limit errors (rate limits are expected and handled gracefully)
      const errorMessage = polygonError instanceof Error ? polygonError.message : String(polygonError);
      if (!errorMessage.includes('Too Many Requests') && !errorMessage.includes('429')) {
        console.warn(`⚠️ Polygon failed for ${upperTicker}:`, polygonError);
      }
    }
  } else {
    console.warn('⚠️ POLYGON_API_KEY not configured, skipping Polygon');
  }
  
  // Try 2: Yahoo Finance (free, no API key)
  try {
    const price = await getYahooPrice(upperTicker);
    // Only log successful Yahoo Finance calls in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Yahoo Finance price for ${upperTicker}: $${price}`);
    }
    return price;
  } catch (yahooError) {
    console.error(`❌ Yahoo Finance failed for ${upperTicker}:`, yahooError);
  }
  
  // Both failed - throw error
  throw new Error(`Failed to fetch price for ${upperTicker}. Both Polygon.io and Yahoo Finance are unavailable.`);
}

export async function getBatchPrices(tickers: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  // Fetch prices with a small delay between Polygon calls to avoid rate limits
  // Process sequentially with delay if using Polygon, otherwise parallel is fine
  for (const ticker of tickers) {
    try {
      const price = await getCurrentPrice(ticker);
      prices.set(ticker, price);
      // Small delay between requests to avoid Polygon rate limits
      if (POLYGON_API_KEY && tickers.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      }
    } catch (error) {
      console.error(`Failed to get price for ${ticker}:`, error);
      // Don't add to map - will be handled by caller
    }
  }

  return prices;
}
