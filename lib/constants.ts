// S&P 100 constituent tickers (as of 2025)
export const SP100_TICKERS = [
  'AAPL', 'ABBV', 'ABT', 'ACN', 'ADBE', 'AIG', 'AMD', 'AMGN', 'AMT', 'AMZN',
  'AVGO', 'AXP', 'BA', 'BAC', 'BK', 'BKNG', 'BLK', 'BMY', 'BRK.B', 'C',
  'CAT', 'CHTR', 'CL', 'CMCSA', 'COF', 'COP', 'COST', 'CRM', 'CSCO', 'CVS',
  'CVX', 'DE', 'DHR', 'DIS', 'DUK', 'EMR', 'ELV', 'FDX', 'GD', 'GE',
  'GILD', 'GM', 'GOOG', 'GOOGL', 'GS', 'HD', 'HON', 'IBM', 'INTC', 'INTU',
  'ISRG', 'JNJ', 'JPM', 'KHC', 'KO', 'LIN', 'LLY', 'LMT', 'LOW', 'MA',
  'MCD', 'MDLZ', 'MDT', 'MET', 'META', 'MMM', 'MO', 'MRK', 'MS', 'MSFT',
  'NEE', 'NFLX', 'NKE', 'NVDA', 'ORCL', 'PEP', 'PFE', 'PG', 'PM', 'PYPL',
  'QCOM', 'RTX', 'SBUX', 'SCHW', 'SO', 'SPG', 'T', 'TGT', 'TMO', 'TMUS',
  'TSLA', 'TXN', 'UNH', 'UNP', 'UPS', 'USB', 'V', 'VZ', 'WFC', 'WMT', 'XOM'
] as const;

export type SP100Ticker = typeof SP100_TICKERS[number];

/**
 * Validates if a ticker is in the S&P 100 list
 * @param ticker - Stock ticker symbol (case-insensitive)
 * @returns true if ticker is in S&P 100, false otherwise
 */
export function isValidSP100Ticker(ticker: string): boolean {
  return SP100_TICKERS.includes(ticker.toUpperCase() as SP100Ticker);
}
