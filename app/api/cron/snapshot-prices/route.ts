import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBatchPrices } from '@/lib/polygon';
import { getMarketHoursStatus } from '@/lib/market-hours';

/**
 * Cron job to snapshot stock prices for S&P 100 tickers with active predictions
 *
 * Schedule:
 * - During market hours (9:30 AM - 4:00 PM ET, Mon-Fri): Every 15 minutes
 * - Outside market hours: Once at market close (4:00 PM ET)
 *
 * Actions:
 * 1. Fetch current prices from Polygon API (batch mode)
 * 2. Insert into market_price_snapshots table
 * 3. Update current_price on active positions
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, require CRON_SECRET authentication
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Check market hours status
    const marketStatus = getMarketHoursStatus();
    console.log('🕒 Market Status:', {
      isOpen: marketStatus.isMarketOpen,
      isMarketDay: marketStatus.isMarketDay,
      currentTimeET: marketStatus.currentTimeET.toISOString()
    });

    // If not a market day, skip
    if (!marketStatus.isMarketDay) {
      return NextResponse.json({
        message: 'Not a market day',
        skipped: true,
        marketStatus
      });
    }

    // Get all unique tickers with active predictions
    const { data: activePredictions, error: predictionsError } = await supabaseAdmin
      .from('predictions')
      .select('ticker')
      .eq('status', 'active');

    if (predictionsError) {
      console.error('Error fetching active predictions:', predictionsError);
      return NextResponse.json(
        { error: 'Failed to fetch active predictions' },
        { status: 500 }
      );
    }

    // Get unique tickers
    const uniqueTickers = [...new Set(activePredictions?.map(p => p.ticker) || [])];

    if (uniqueTickers.length === 0) {
      return NextResponse.json({
        message: 'No active predictions found',
        tickersProcessed: 0,
        marketStatus
      });
    }

    console.log(`📊 Fetching prices for ${uniqueTickers.length} tickers with active predictions`);

    // Fetch prices in batch from Polygon API
    const prices = await getBatchPrices(uniqueTickers);

    if (prices.size === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch any prices' },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${prices.size} prices successfully`);

    // Prepare snapshots for bulk insert
    const snapshots = Array.from(prices.entries()).map(([ticker, price]) => ({
      ticker,
      price,
      captured_at: new Date().toISOString(),
      source: 'polygon'
    }));

    // Insert snapshots into database (upsert to handle duplicates)
    const { error: snapshotError } = await supabaseAdmin
      .from('market_price_snapshots')
      .upsert(snapshots, {
        onConflict: 'ticker,captured_at',
        ignoreDuplicates: false
      });

    if (snapshotError) {
      console.error('Error inserting snapshots:', snapshotError);
      return NextResponse.json(
        { error: 'Failed to insert price snapshots' },
        { status: 500 }
      );
    }

    console.log(`💾 Inserted ${snapshots.length} price snapshots`);

    // Update current_price on all active positions
    const { data: positions, error: positionsError } = await supabaseAdmin
      .from('positions')
      .select('id, ticker');

    if (positionsError) {
      console.error('Error fetching positions:', positionsError);
    } else if (positions && positions.length > 0) {
      // Update each position with its current price
      const positionUpdates = positions
        .filter(position => prices.has(position.ticker))
        .map(position => ({
          id: position.id,
          current_price: prices.get(position.ticker)!
        }));

      if (positionUpdates.length > 0) {
        for (const update of positionUpdates) {
          await supabaseAdmin
            .from('positions')
            .update({ current_price: update.current_price })
            .eq('id', update.id);
        }

        console.log(`🔄 Updated ${positionUpdates.length} position prices`);
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      tickersProcessed: prices.size,
      snapshotsInserted: snapshots.length,
      positionsUpdated: positions?.filter(p => prices.has(p.ticker)).length || 0,
      marketStatus: {
        isOpen: marketStatus.isMarketOpen,
        isMarketDay: marketStatus.isMarketDay,
        currentTimeET: marketStatus.currentTimeET.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in snapshot-prices cron:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
