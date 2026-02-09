// Market hours utility functions for NYSE/NASDAQ
// Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday

export interface MarketHoursStatus {
  isMarketOpen: boolean;
  isMarketDay: boolean; // Mon-Fri
  currentTimeET: Date;
  nextMarketClose: Date | null;
}

/**
 * Gets the current time in ET timezone
 */
export function getCurrentETTime(): Date {
  const now = new Date();

  // Convert to ET using Intl API
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = etFormatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Checks if the given date is a weekday (Mon-Fri)
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 1 = Monday, 5 = Friday
}

/**
 * Checks if the market is currently open
 * Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
 */
export function isMarketOpen(): boolean {
  const etTime = getCurrentETTime();

  // Check if it's a weekday
  if (!isWeekday(etTime)) {
    return false;
  }

  const hour = etTime.getHours();
  const minute = etTime.getMinutes();

  // Market opens at 9:30 AM
  const afterOpen = hour > 9 || (hour === 9 && minute >= 30);

  // Market closes at 4:00 PM (16:00)
  const beforeClose = hour < 16;

  return afterOpen && beforeClose;
}

/**
 * Gets the next market close time for today (if market is open or after hours today)
 * Returns null if not a market day
 */
export function getNextMarketClose(): Date | null {
  const etTime = getCurrentETTime();

  if (!isWeekday(etTime)) {
    return null;
  }

  // Set to 4:00 PM ET today
  const marketClose = new Date(etTime);
  marketClose.setHours(16, 0, 0, 0);

  return marketClose;
}

/**
 * Gets comprehensive market hours status
 */
export function getMarketHoursStatus(): MarketHoursStatus {
  const etTime = getCurrentETTime();
  const isMarketDay = isWeekday(etTime);
  const marketOpen = isMarketDay && isMarketOpen();
  const nextClose = isMarketDay ? getNextMarketClose() : null;

  return {
    isMarketOpen: marketOpen,
    isMarketDay,
    currentTimeET: etTime,
    nextMarketClose: nextClose
  };
}

/**
 * Determines if we should run the cron job now
 * During market hours: run every interval
 * Outside market hours: only run at market close
 */
export function shouldRunCron(lastRunTime?: Date): boolean {
  const status = getMarketHoursStatus();

  // If market is open, always run
  if (status.isMarketOpen) {
    return true;
  }

  // If not a market day, don't run
  if (!status.isMarketDay) {
    return false;
  }

  // Market is closed but it's a market day
  // Only run once at market close (4:00 PM ET)
  const etTime = status.currentTimeET;
  const hour = etTime.getHours();

  // Run between 4:00 PM and 4:15 PM ET (after market close)
  const isAfterMarketClose = hour === 16 && etTime.getMinutes() < 15;

  // If we have a last run time, check if we already ran today after close
  if (lastRunTime && isAfterMarketClose) {
    const lastRunET = new Date(lastRunTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const isSameDay = lastRunET.getDate() === etTime.getDate() &&
                      lastRunET.getMonth() === etTime.getMonth() &&
                      lastRunET.getFullYear() === etTime.getFullYear();

    // If we already ran today after close, don't run again
    if (isSameDay && lastRunET.getHours() >= 16) {
      return false;
    }
  }

  return isAfterMarketClose;
}
