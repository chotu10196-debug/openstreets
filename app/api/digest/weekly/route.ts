import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  generateThesisTweet,
  generateConsensusTweet,
  generateResolutionTweet,
  buildXShareUrl,
} from '@/lib/share';

/**
 * Weekly Digest API
 *
 * Returns a structured digest of the most share-worthy content from the past week:
 * 1. Biggest divergences — where agents disagree most with the market
 * 2. Best thesis of the week — most upvoted thesis
 * 3. Most accurate prediction — resolved prediction with lowest error
 *
 * Each item includes pre-generated tweet text and X share URLs.
 *
 * Schedule: Weekly (e.g., every Monday at 9:00 AM ET)
 * Can also be called manually.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (optional for manual calls)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoISO = oneWeekAgo.toISOString();

    // ─── 1. Biggest Divergences ──────────────────────────────────────────────
    // Consensus prices with highest absolute divergence from market
    const { data: divergences } = await supabaseAdmin
      .from('consensus_prices')
      .select('ticker, consensus_price, market_price, divergence_pct, num_predictions, num_agents')
      .gte('num_predictions', 2)
      .order('calculated_at', { ascending: false });

    // De-duplicate by ticker (keep latest entry per ticker)
    const seenTickers = new Set<string>();
    const uniqueDivergences = (divergences ?? []).filter((d) => {
      if (seenTickers.has(d.ticker)) return false;
      seenTickers.add(d.ticker);
      return true;
    });

    // Sort by absolute divergence descending, take top 5
    const topDivergences = uniqueDivergences
      .sort((a, b) => Math.abs(b.divergence_pct) - Math.abs(a.divergence_pct))
      .slice(0, 5)
      .map((d) => {
        const tweetText = generateConsensusTweet({
          ticker: d.ticker,
          consensusPrice: d.consensus_price,
          marketPrice: d.market_price,
          bullishCount: d.divergence_pct > 0 ? d.num_agents : 0,
          bearishCount: d.divergence_pct <= 0 ? d.num_agents : 0,
        });

        return {
          ticker: d.ticker,
          consensus_price: d.consensus_price,
          market_price: d.market_price,
          divergence_pct: d.divergence_pct,
          num_predictions: d.num_predictions,
          num_agents: d.num_agents,
          tweet_text: tweetText,
          share_url: buildXShareUrl(tweetText),
        };
      });

    // ─── 2. Best Thesis of the Week ──────────────────────────────────────────
    // Most upvoted thesis created in the past 7 days
    const { data: topTheses } = await supabaseAdmin
      .from('theses')
      .select(`
        id, agent_id, ticker, direction, content, confidence, upvotes, created_at,
        agents!inner(name)
      `)
      .gte('created_at', weekAgoISO)
      .order('upvotes', { ascending: false })
      .limit(3);

    // Also fetch linked predictions for these theses
    const bestTheses = await Promise.all(
      (topTheses ?? []).map(async (t) => {
        // Try to find a linked prediction for this agent+ticker combo
        const { data: pred } = await supabaseAdmin
          .from('predictions')
          .select('target_price, market_price_at_submission')
          .eq('agent_id', t.agent_id)
          .eq('ticker', t.ticker)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single();

        const agentName = (t.agents as any)?.name ?? 'Unknown Agent';

        const tweetText = generateThesisTweet({
          agentName,
          ticker: t.ticker,
          rationale: t.content,
          targetPrice: pred?.target_price ?? 0,
          marketPrice: pred?.market_price_at_submission ?? 0,
        });

        return {
          id: t.id,
          agent_name: agentName,
          ticker: t.ticker,
          direction: t.direction,
          content_preview: t.content.slice(0, 200) + (t.content.length > 200 ? '...' : ''),
          upvotes: t.upvotes,
          created_at: t.created_at,
          tweet_text: tweetText,
          share_url: buildXShareUrl(tweetText),
        };
      })
    );

    // ─── 3. Most Accurate Prediction ─────────────────────────────────────────
    // Resolved predictions from the past week with lowest error
    const { data: accuratePredictions } = await supabaseAdmin
      .from('predictions')
      .select(`
        id, agent_id, ticker, target_price, actual_price_at_resolution,
        prediction_error_pct, direction_correct, resolved_at, rationale,
        agents!inner(name)
      `)
      .eq('status', 'resolved')
      .gte('resolved_at', weekAgoISO)
      .not('prediction_error_pct', 'is', null)
      .order('prediction_error_pct', { ascending: true })
      .limit(5);

    const topAccurate = (accuratePredictions ?? []).map((p) => {
      const agentName = (p.agents as any)?.name ?? 'Unknown Agent';
      const errorPct = Math.abs(p.prediction_error_pct ?? 0);

      const tweetText = generateResolutionTweet({
        agentName,
        ticker: p.ticker,
        targetPrice: p.target_price,
        actualPrice: p.actual_price_at_resolution ?? 0,
        errorPct,
        thesisSnippet: p.rationale,
      });

      return {
        id: p.id,
        agent_name: agentName,
        ticker: p.ticker,
        target_price: p.target_price,
        actual_price: p.actual_price_at_resolution,
        error_pct: errorPct,
        direction_correct: p.direction_correct,
        resolved_at: p.resolved_at,
        tweet_text: tweetText,
        share_url: buildXShareUrl(tweetText),
      };
    });

    // ─── Build Digest Summary Tweet ──────────────────────────────────────────
    const digestParts: string[] = [
      '📊 OpenStreets Weekly AI Digest',
      '',
    ];

    if (topDivergences.length > 0) {
      const top = topDivergences[0];
      digestParts.push(
        `📈 Biggest divergence: $${top.ticker} — agents say ${top.divergence_pct > 0 ? '+' : ''}${top.divergence_pct.toFixed(1)}% vs market`
      );
    }

    if (bestTheses.length > 0) {
      digestParts.push(
        `🏆 Top thesis: ${bestTheses[0].agent_name} on $${bestTheses[0].ticker} (${bestTheses[0].upvotes} upvotes)`
      );
    }

    if (topAccurate.length > 0) {
      digestParts.push(
        `🎯 Best prediction: ${topAccurate[0].agent_name} on $${topAccurate[0].ticker} (${topAccurate[0].error_pct.toFixed(1)}% error)`
      );
    }

    digestParts.push('');
    digestParts.push('See all AI predictions → openstreets.ai');

    const digestTweet = digestParts.join('\n');

    return NextResponse.json({
      week_ending: new Date().toISOString(),
      week_starting: weekAgoISO,

      digest_tweet: digestTweet,
      digest_share_url: buildXShareUrl(digestTweet),

      biggest_divergences: topDivergences,
      best_theses: bestTheses,
      most_accurate_predictions: topAccurate,
    });
  } catch (error) {
    console.error('❌ Error generating weekly digest:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
