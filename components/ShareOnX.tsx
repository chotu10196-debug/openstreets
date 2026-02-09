'use client';

import { useState, useCallback } from 'react';
import { buildXShareUrl } from '@/lib/share';

// ─── X (Twitter) Logo SVG ────────────────────────────────────────────────────

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ─── Variants ────────────────────────────────────────────────────────────────

type ShareVariant = 'icon' | 'compact' | 'full';

interface ShareOnXProps {
  /** The pre-built tweet text */
  tweetText: string;
  /** Visual variant */
  variant?: ShareVariant;
  /** Optional label override */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A reusable "Share on X" button.
 *
 * Variants:
 * - `icon`    — just the X logo icon
 * - `compact` — icon + "Share" text
 * - `full`    — icon + "Share on X" text
 */
export default function ShareOnX({
  tweetText,
  variant = 'compact',
  label,
  className = '',
}: ShareOnXProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const url = buildXShareUrl(tweetText);
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=400');
  }, [tweetText]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open share URL directly
      handleShare();
    }
  }, [tweetText, handleShare]);

  const displayLabel =
    label ?? (variant === 'full' ? 'Share on X' : variant === 'compact' ? 'Share' : '');

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Share button */}
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                   bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]
                   border border-[#334155]/50 hover:border-[#475569]
                   transition-all duration-200 cursor-pointer group"
        title="Share on X"
      >
        <XLogo className="w-3.5 h-3.5 group-hover:text-white transition-colors" />
        {displayLabel && <span>{displayLabel}</span>}
      </button>

      {/* Copy tweet text button */}
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs
                   text-[#64748B] hover:text-[#94A3B8] hover:bg-[#1E293B]/50
                   transition-all duration-200 cursor-pointer"
        title="Copy tweet text"
      >
        {copied ? (
          <span className="text-[#22C55E] font-medium">Copied!</span>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Resolution Share Card ───────────────────────────────────────────────────
// A special card displayed for high-accuracy resolutions (< 2% error).

interface ResolutionShareCardProps {
  agentName: string;
  ticker: string;
  targetPrice: number;
  actualPrice: number;
  errorPct: number;
  thesisSnippet: string | null;
  tweetText: string;
}

export function ResolutionShareCard({
  agentName,
  ticker,
  targetPrice,
  actualPrice,
  errorPct,
  tweetText,
}: ResolutionShareCardProps) {
  return (
    <div className="bg-gradient-to-r from-[#22C55E]/10 via-[#22C55E]/5 to-transparent border border-[#22C55E]/25 rounded-xl p-5 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <div className="text-sm font-semibold text-[#F8FAFC]">
              {agentName} nailed it!
            </div>
            <div className="text-xs text-[#94A3B8] mt-0.5">
              ${ticker} predicted at ${targetPrice.toFixed(2)}, actual ${actualPrice.toFixed(2)} —{' '}
              <span className="text-[#22C55E] font-semibold">{errorPct.toFixed(1)}% error</span>
            </div>
          </div>
        </div>
        <ShareOnX tweetText={tweetText} variant="full" />
      </div>
    </div>
  );
}
