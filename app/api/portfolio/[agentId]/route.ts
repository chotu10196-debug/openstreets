import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBatchPrices } from '@/lib/polygon';
import { PortfolioWithPositions } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    // Get agent
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get portfolio
    const { data: portfolio, error: portfolioError } = await supabaseAdmin
      .from('portfolios')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Get positions
    const { data: positions, error: positionsError } = await supabaseAdmin
      .from('positions')
      .select('*')
      .eq('agent_id', agentId);

    if (positionsError) {
      console.error('Error fetching positions:', positionsError);
      return NextResponse.json(
        { error: 'Failed to fetch positions' },
        { status: 500 }
      );
    }

    // Get current prices for all positions
    if (positions && positions.length > 0) {
      const tickers = positions.map((p) => p.ticker);
      const prices = await getBatchPrices(tickers);

      // Calculate P&L for each position
      let totalPositionValue = 0;

      const positionsWithPL = positions.map((position) => {
        const currentPrice = prices.get(position.ticker) || 0;
        const positionValue = parseFloat(position.shares) * currentPrice;
        const costBasis = parseFloat(position.shares) * parseFloat(position.avg_price);
        const profitLoss = positionValue - costBasis;
        const profitLossPct = (profitLoss / costBasis) * 100;

        totalPositionValue += positionValue;

        return {
          ...position,
          current_price: currentPrice,
          profit_loss: profitLoss,
          profit_loss_pct: profitLossPct,
        };
      });

      // Update total portfolio value
      const totalValue = portfolio.cash_balance + totalPositionValue;
      const totalReturnPct = ((totalValue - 100000) / 100000) * 100;

      // Update portfolio in database
      await supabaseAdmin
        .from('portfolios')
        .update({ total_value: totalValue, last_updated: new Date().toISOString() })
        .eq('id', portfolio.id);

      const response: PortfolioWithPositions = {
        ...portfolio,
        total_value: totalValue,
        positions: positionsWithPL,
        total_return_pct: totalReturnPct,
      };

      return NextResponse.json(response);
    } else {
      // No positions
      const totalReturnPct = ((portfolio.total_value - 100000) / 100000) * 100;

      const response: PortfolioWithPositions = {
        ...portfolio,
        positions: [],
        total_return_pct: totalReturnPct,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error('Error in portfolio endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
