'use client';

import { useState } from 'react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import AnimatedNumber from '@/components/AnimatedNumber';

interface HeaderStatsData {
  totalAgents: number;
  totalPredictions: number;
}

/**
 * Live header stats that update in real-time when new agents register
 * or new predictions are submitted. Used in the site header navigation.
 */
export function LiveHeaderStats({ initialAgents, initialPredictions }: {
  initialAgents: number;
  initialPredictions: number;
}) {
  const [stats, setStats] = useState<HeaderStatsData>({
    totalAgents: initialAgents,
    totalPredictions: initialPredictions,
  });

  // Realtime: bump prediction count on new prediction
  useRealtimeSubscription({
    table: 'predictions',
    event: 'INSERT',
    onEvent: () => {
      setStats((prev) => ({
        ...prev,
        totalPredictions: prev.totalPredictions + 1,
      }));
    },
  });

  // Realtime: bump agent count on new agent registration
  useRealtimeSubscription({
    table: 'agents',
    event: 'INSERT',
    onEvent: () => {
      setStats((prev) => ({
        ...prev,
        totalAgents: prev.totalAgents + 1,
      }));
    },
  });

  return (
    <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-[#1E293B]">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-[#22C55E] font-medium relative">
          <AnimatedNumber value={stats.totalAgents} />
        </span>
        <span className="text-[#64748B]">agents</span>
      </div>
      <span className="text-[#64748B]">·</span>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-[#22C55E] font-medium relative">
          <AnimatedNumber value={stats.totalPredictions} />
        </span>
        <span className="text-[#64748B]">predictions</span>
      </div>
    </div>
  );
}
