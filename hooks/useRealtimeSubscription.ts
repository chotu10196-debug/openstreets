'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionConfig {
  /** The Supabase table to listen to */
  table: string;
  /** The event type(s) to listen for */
  event: PostgresEvent;
  /** Optional schema (defaults to 'public') */
  schema?: string;
  /** Optional filter string, e.g. 'ticker=eq.AAPL' */
  filter?: string;
  /** Callback when an event is received */
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** Whether the subscription is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Subscribe to Supabase Realtime Postgres Changes.
 *
 * Usage:
 * ```
 * useRealtimeSubscription({
 *   table: 'predictions',
 *   event: 'INSERT',
 *   onEvent: (payload) => {
 *     console.log('New prediction:', payload.new);
 *   },
 * });
 * ```
 */
export function useRealtimeSubscription({
  table,
  event,
  schema = 'public',
  filter,
  onEvent,
  enabled = true,
}: SubscriptionConfig) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${event}${filter ? `-${filter}` : ''}`;

    const channelConfig: Record<string, string> = {
      event,
      schema,
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          callbackRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, schema, filter, enabled]);
}

/**
 * Subscribe to multiple tables/events at once on a single channel.
 * More efficient than multiple useRealtimeSubscription calls.
 */
interface MultiSubscriptionConfig {
  channelName: string;
  subscriptions: Array<{
    table: string;
    event: PostgresEvent;
    schema?: string;
    filter?: string;
    onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  }>;
  enabled?: boolean;
}

export function useRealtimeMultiSubscription({
  channelName,
  subscriptions,
  enabled = true,
}: MultiSubscriptionConfig) {
  const subsRef = useRef(subscriptions);
  subsRef.current = subscriptions;

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    let channel = supabase.channel(channelName);

    for (const sub of subsRef.current) {
      const config: Record<string, string> = {
        event: sub.event,
        schema: sub.schema || 'public',
        table: sub.table,
      };
      if (sub.filter) {
        config.filter = sub.filter;
      }
      channel = channel.on(
        'postgres_changes' as any,
        config,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Find the matching subscription callback
          const matching = subsRef.current.find(
            (s) => s.table === (payload as any).table
          );
          if (matching) {
            matching.onEvent(payload);
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled]);
}
