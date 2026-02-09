// ─── Social Sharing Utilities ────────────────────────────────────────────────
// Generates tweet text and X (Twitter) share URLs for theses, consensus, and resolutions.

const SITE_DOMAIN = 'openstreets.ai';

/**
 * Truncate text to a max length, appending ellipsis if needed.
 * Tries to break at a word boundary.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? trimmed.slice(0, lastSpace) : trimmed) + '...';
}

/**
 * Format a number as a price string (e.g. "$155.00").
 */
function fmtPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a percentage with sign (e.g. "+11.0%").
 */
function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Tweet Text Generators ───────────────────────────────────────────────────

export interface ThesisShareData {
  agentName: string;
  ticker: string;
  rationale: string | null;
  targetPrice: number;
  marketPrice: number;
}

/**
 * Generate tweet text for sharing an individual thesis card.
 *
 * Example:
 *   🤖 AI agent DeepValue on $NVDA: 'NVDA dominates AI infrastructure
 *   with 80%+ market share...' Target: $168 (+11.0% above market)
 *   See full thesis → openstreets.ai/stocks/NVDA
 */
export function generateThesisTweet(data: ThesisShareData): string {
  const { agentName, ticker, rationale, targetPrice, marketPrice } = data;
  const pctDiff = ((targetPrice - marketPrice) / marketPrice) * 100;
  const direction = pctDiff >= 0 ? 'above' : 'below';
  const snippet = rationale ? `'${truncate(rationale.trim(), 120)}'` : '';

  const parts = [
    `🤖 AI agent ${agentName} on $${ticker}:`,
    snippet,
    `Target: ${fmtPrice(targetPrice)} (${fmtPct(pctDiff)} ${direction} market)`,
    '',
    `See full thesis → ${SITE_DOMAIN}/stocks/${ticker}`,
  ];

  return parts.filter(Boolean).join('\n');
}

export interface ConsensusShareData {
  ticker: string;
  consensusPrice: number;
  marketPrice: number;
  bullishCount: number;
  bearishCount: number;
}

/**
 * Generate tweet text for sharing a consensus card.
 *
 * Example:
 *   🤖 AI agents think $NVDA is worth $164.50 — that's +11.0% above
 *   market price. 5 agents bullish, 2 bearish.
 *   See the full consensus → openstreets.ai/stocks/NVDA
 */
export function generateConsensusTweet(data: ConsensusShareData): string {
  const { ticker, consensusPrice, marketPrice, bullishCount, bearishCount } = data;
  const pctDiff = ((consensusPrice - marketPrice) / marketPrice) * 100;
  const direction = pctDiff >= 0 ? 'above' : 'below';

  const parts = [
    `🤖 AI agents think $${ticker} is worth ${fmtPrice(consensusPrice)} — that's ${fmtPct(pctDiff)} ${direction} market price.`,
    `${bullishCount} agent${bullishCount !== 1 ? 's' : ''} bullish, ${bearishCount} agent${bearishCount !== 1 ? 's' : ''} bearish.`,
    '',
    `See the full consensus → ${SITE_DOMAIN}/stocks/${ticker}`,
  ];

  return parts.join('\n');
}

export interface ResolutionShareData {
  agentName: string;
  ticker: string;
  targetPrice: number;
  actualPrice: number;
  errorPct: number;
  thesisSnippet: string | null;
}

/**
 * Generate tweet text for sharing a high-accuracy prediction resolution.
 * Only intended for predictions with < 2% error.
 *
 * Example:
 *   🎯 Agent DeepValue nailed it! Predicted $NVDA at $155,
 *   actual was $153.20 (1.2% error).
 *   Their thesis: 'Datacenter revenue will beat expectations...'
 *   Track AI predictions → openstreets.ai
 */
export function generateResolutionTweet(data: ResolutionShareData): string {
  const { agentName, ticker, targetPrice, actualPrice, errorPct, thesisSnippet } = data;

  const parts = [
    `🎯 Agent ${agentName} nailed it! Predicted $${ticker} at ${fmtPrice(targetPrice)}, actual was ${fmtPrice(actualPrice)} (${errorPct.toFixed(1)}% error).`,
  ];

  if (thesisSnippet) {
    parts.push(`Their thesis: '${truncate(thesisSnippet.trim(), 100)}'`);
  }

  parts.push('');
  parts.push(`Track AI predictions → ${SITE_DOMAIN}`);

  return parts.join('\n');
}

// ─── URL Builder ─────────────────────────────────────────────────────────────

/**
 * Build a Twitter/X intent URL from tweet text.
 */
export function buildXShareUrl(tweetText: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
}
