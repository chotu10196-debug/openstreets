import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentPrice } from '@/lib/polygon';
import { validateApiKey } from '@/lib/auth';
import { TradeRequest, TradeResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: TradeRequest = await request.json();
    const { api_key, ticker, action, amount, thesis, confidence } = body;

    // Validate input
    if (!api_key || !ticker || !action || !amount) {
      return NextResponse.json(
        { error: 'API key, ticker, action, and amount are required' },
        { status: 400 }
      );
    }

    if (action !== 'BUY' && action !== 'SELL') {
      return NextResponse.json(
        { error: 'Action must be BUY or SELL' },
        { status: 400 }
      );
    }

    // Validate API key and get agent
    const agent = await validateApiKey(api_key);
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key or agent not verified' },
        { status: 401 }
      );
    }

    // Get current price from Polygon.io
    let currentPrice: number;
    try {
      currentPrice = await getCurrentPrice(ticker.toUpperCase());
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to fetch price for ${ticker}. Make sure it's a valid ticker.` },
        { status: 400 }
      );
    }

    // Get agent's portfolio
    const { data: portfolio, error: portfolioError } = await supabaseAdmin
      .from('portfolios')
      .select('*')
      .eq('agent_id', agent.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    let shares: number;
    let totalValue: number;

    if (action === 'BUY') {
      // Calculate shares to buy
      shares = amount / currentPrice;
      totalValue = amount;

      // Check if agent has enough cash
      if (portfolio.cash_balance < totalValue) {
        return NextResponse.json(
          { error: 'Insufficient cash balance' },
          { status: 400 }
        );
      }

      // Update or create position
      const { data: existingPosition } = await supabaseAdmin
        .from('positions')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('ticker', ticker.toUpperCase())
        .single();

      if (existingPosition) {
        // Update existing position
        const newShares = parseFloat(existingPosition.shares) + shares;
        const newAvgPrice =
          (parseFloat(existingPosition.avg_price) * parseFloat(existingPosition.shares) +
            currentPrice * shares) /
          newShares;

        await supabaseAdmin
          .from('positions')
          .update({
            shares: newShares,
            avg_price: newAvgPrice,
            current_price: currentPrice,
          })
          .eq('id', existingPosition.id);
      } else {
        // Create new position
        await supabaseAdmin.from('positions').insert({
          agent_id: agent.id,
          ticker: ticker.toUpperCase(),
          shares,
          avg_price: currentPrice,
          current_price: currentPrice,
        });
      }

      // Update portfolio
      await supabaseAdmin
        .from('portfolios')
        .update({
          cash_balance: portfolio.cash_balance - totalValue,
        })
        .eq('id', portfolio.id);
    } else {
      // SELL
      // Get existing position
      const { data: position, error: positionError } = await supabaseAdmin
        .from('positions')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('ticker', ticker.toUpperCase())
        .single();

      if (positionError || !position) {
        return NextResponse.json(
          { error: `No position found for ${ticker}` },
          { status: 400 }
        );
      }

      // Calculate shares to sell
      shares = amount / currentPrice;

      // Check if agent has enough shares
      if (parseFloat(position.shares) < shares) {
        return NextResponse.json(
          { error: 'Insufficient shares' },
          { status: 400 }
        );
      }

      totalValue = shares * currentPrice;

      // Update or delete position
      const remainingShares = parseFloat(position.shares) - shares;

      if (remainingShares < 0.0001) {
        // Delete position if all shares sold
        await supabaseAdmin
          .from('positions')
          .delete()
          .eq('id', position.id);
      } else {
        // Update position
        await supabaseAdmin
          .from('positions')
          .update({
            shares: remainingShares,
            current_price: currentPrice,
          })
          .eq('id', position.id);
      }

      // Update portfolio
      await supabaseAdmin
        .from('portfolios')
        .update({
          cash_balance: portfolio.cash_balance + totalValue,
        })
        .eq('id', portfolio.id);
    }

    // Record trade
    const { data: trade, error: tradeError } = await supabaseAdmin
      .from('trades')
      .insert({
        agent_id: agent.id,
        ticker: ticker.toUpperCase(),
        action,
        shares,
        price: currentPrice,
        total_value: totalValue,
        thesis: thesis || null,
        confidence: confidence || null,
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error recording trade:', tradeError);
    }

    // Record thesis if provided
    if (thesis) {
      const direction = action === 'BUY' ? 'BULLISH' : 'BEARISH';
      await supabaseAdmin.from('theses').insert({
        agent_id: agent.id,
        ticker: ticker.toUpperCase(),
        direction,
        content: thesis,
        confidence: confidence || 'MEDIUM',
      });
    }

    // Get updated portfolio
    const { data: updatedPortfolio } = await supabaseAdmin
      .from('portfolios')
      .select('*')
      .eq('agent_id', agent.id)
      .single();

    // Get updated position
    const { data: updatedPosition } = await supabaseAdmin
      .from('positions')
      .select('*')
      .eq('agent_id', agent.id)
      .eq('ticker', ticker.toUpperCase())
      .single();

    const response: TradeResponse = {
      trade_id: trade?.id || '',
      new_position: updatedPosition || undefined,
      portfolio_value: updatedPortfolio?.total_value || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in trade endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
