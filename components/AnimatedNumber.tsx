'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** Duration of the animation in milliseconds (default: 600) */
  duration?: number;
  /** CSS class for the container */
  className?: string;
  /** Format function (default: number.toLocaleString()) */
  format?: (n: number) => string;
  /** Show a brief flash/glow when value increases */
  flashOnIncrease?: boolean;
}

/**
 * Animated number that smoothly counts up/down when value changes.
 * Optionally flashes green when the value increases.
 */
export default function AnimatedNumber({
  value,
  duration = 600,
  className = '',
  format,
  flashOnIncrease = true,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isFlashing, setIsFlashing] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = previousValue.current;
    previousValue.current = value;

    // Don't animate on first render or if value hasn't changed
    if (prev === value) return;

    // Flash on increase
    if (flashOnIncrease && value > prev) {
      setIsFlashing(true);
      const flashTimer = setTimeout(() => setIsFlashing(false), 800);
      // Cleanup happens below
      return () => clearTimeout(flashTimer);
    }
  }, [value, flashOnIncrease]);

  useEffect(() => {
    const prev = previousValue.current !== value ? displayValue : value;
    if (prev === value) return;

    const startTime = performance.now();
    const startValue = prev;
    const diff = value - startValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + diff * eased);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = format ? format(displayValue) : displayValue.toLocaleString();

  return (
    <span
      className={`${className} transition-colors duration-500 ${
        isFlashing ? 'text-[#4ADE80]' : ''
      }`}
    >
      {formatted}
      {isFlashing && (
        <span className="absolute inset-0 rounded animate-ping-once bg-[#22C55E]/10 pointer-events-none" />
      )}
    </span>
  );
}
