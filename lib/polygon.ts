// Polygon.io API client

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

export interface PolygonQuote {
  ticker: string;
  price: number;
  timestamp: number;
}

export async function getCurrentPrice(ticker: string): Promise<number> {
  if (!POLYGON_API_KEY) {
    throw new Error('POLYGON_API_KEY not configured');
  }

  try {
    // Using Polygon.io v2 snapshot endpoint for real-time quotes
    const response = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status !== 'OK' || !data.ticker) {
      throw new Error(`Invalid ticker: ${ticker}`);
    }

    // Return the last trade price
    return data.ticker.lastTrade.p;
  } catch (error) {
    console.error('Error fetching price from Polygon:', error);
    throw error;
  }
}

export async function getBatchPrices(tickers: string[]): Promise<Map<string, number>> {
  if (!POLYGON_API_KEY) {
    throw new Error('POLYGON_API_KEY not configured');
  }

  const prices = new Map<string, number>();

  // Fetch prices in parallel
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const price = await getCurrentPrice(ticker);
        prices.set(ticker, price);
      } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error);
        // Set to 0 if we can't fetch the price
        prices.set(ticker, 0);
      }
    })
  );

  return prices;
}
