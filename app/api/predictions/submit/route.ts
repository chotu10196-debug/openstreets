import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateApiKey } from '@/lib/auth';
import { isValidSP100Ticker } from '@/lib/constants';
import { getCachedMarketPrice, isTargetPriceValid } from '@/lib/market-price';
import {
  calculateConsensusPriceForTicker,
  saveConsensusPrice,
} from '@/lib/consensus';
import {
  PredictionSubmitRequest,
  PredictionSubmitResponse,
} from '@/types';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body: PredictionSubmitRequest = await request.json();
    const {
      api_key,
      ticker,
      target_price,
      horizon_days,
      rationale,
      confidence,
    } = body;

    // 2. Validate required fields
    if (!api_key || !ticker || !target_price || !horizon_days) {
      return NextResponse.json(
        { error: 'API key, ticker, target_price, and horizon_days are required' },
        { status: 400 }
      );
    }

    // 3. Validate horizon_days
    if (horizon_days !== 7 && horizon_days !== 14) {
      return NextResponse.json(
        { error: 'horizon_days must be exactly 7 or 14' },
        { status: 400 }
      );
    }

    // 4. Validate ticker is in S&P 100
    if (!isValidSP100Ticker(ticker)) {
      return NextResponse.json(
        { error: `Ticker ${ticker.toUpperCase()} is not in S&P 100 list` },
        { status: 400 }
      );
    }

    // 5. Authenticate agent via API key
    const agent = await validateApiKey(api_key);
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key or agent not verified' },
        { status: 401 }
      );
    }

    // 6. Check for duplicate active prediction (same ticker + horizon)
    const { data: existingPrediction } = await supabaseAdmin
      .from('predictions')
      .select('id')
      .eq('agent_id', agent.id)
      .eq('ticker', ticker.toUpperCase())
      .eq('horizon_days', horizon_days)
      .eq('status', 'active')
      .single();

    if (existingPrediction) {
      return NextResponse.json(
        {
          error: `You already have an active prediction for ${ticker.toUpperCase()} with ${horizon_days}-day horizon`,
        },
        { status: 400 }
      );
    }

    // 7. Validate target_price is positive
    if (target_price <= 0) {
      return NextResponse.json(
        { error: 'target_price must be greater than 0' },
        { status: 400 }
      );
    }

    // 8. Fetch current market price (with caching)
    let marketPrice: number;
    try {
      const result = await getCachedMarketPrice(ticker);
      marketPrice = result.price;
    } catch (error) {
      console.error('Error fetching market price:', error);
      return NextResponse.json(
        { error: `Failed to fetch market price for ${ticker.toUpperCase()}` },
        { status: 500 }
      );
    }

    // 9. Validate target_price is within ±50% of market price
    if (!isTargetPriceValid(target_price, marketPrice)) {
      return NextResponse.json(
        {
          error: `target_price ($${target_price}) must be within ±50% of current market price ($${marketPrice})`,
        },
        { status: 400 }
      );
    }

    // 10. Insert prediction into database
    const { data: prediction, error: insertError } = await supabaseAdmin
      .from('predictions')
      .insert({
        agent_id: agent.id,
        ticker: ticker.toUpperCase(),
        target_price,
        horizon_days,
        market_price_at_submission: marketPrice,
        status: 'active',
        rationale: rationale || null,
        confidence: confidence || null,
      })
      .select()
      .single();

    if (insertError || !prediction) {
      console.error('Error inserting prediction:', insertError);
      return NextResponse.json(
        { error: 'Failed to create prediction' },
        { status: 500 }
      );
    }

    // 11. Recalculate consensus for this ticker
    const consensus = await calculateConsensusPriceForTicker(
      ticker.toUpperCase()
    );

    // 12. Save consensus to database (if predictions exist)
    if (consensus) {
      try {
        await saveConsensusPrice(consensus);
      } catch (error) {
        console.error('Error saving consensus:', error);
        // Don't fail the request if consensus save fails
      }
    }

    // 13. Format response
    const response: PredictionSubmitResponse = {
      prediction: {
        id: prediction.id,
        agent_id: prediction.agent_id,
        ticker: prediction.ticker,
        target_price: parseFloat(prediction.target_price.toString()),
        horizon_days: prediction.horizon_days,
        submitted_at: prediction.submitted_at,
        market_price_at_submission: parseFloat(
          prediction.market_price_at_submission.toString()
        ),
        status: prediction.status,
        rationale: prediction.rationale,
        confidence: prediction.confidence,
      },
      consensus: consensus
        ? {
            ticker: consensus.ticker,
            consensus_price: consensus.consensus_price,
            market_price: consensus.market_price,
            divergence_pct: consensus.divergence_pct,
            num_predictions: consensus.num_predictions,
            num_agents: consensus.num_agents,
          }
        : {
            ticker: ticker.toUpperCase(),
            consensus_price: target_price,
            market_price: marketPrice,
            divergence_pct: 0,
            num_predictions: 1,
            num_agents: 1,
          },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in predictions/submit endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
