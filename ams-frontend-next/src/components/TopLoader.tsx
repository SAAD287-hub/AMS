"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Listener = () => void;

/**
 * Lightweight top progress bar that appears on route changes and whenever
 * a long request is in flight. Exposes a global `topLoader` object so
 * other modules (like `apiFetch`) can start/finish a tick.
 */
class TopLoaderController {
  private inflight = 0;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit() { this.listeners.forEach(fn => fn()); }

  isBusy() { return this.inflight > 0; }

  start() {
    this.inflight += 1;
    this.emit();
  }

  done() {
    this.inflight = Math.max(0, this.inflight - 1);
    this.emit();
  }
}

export const topLoader = new TopLoaderController();

if (typeof window !== "undefined") {
  (window as unknown as { __topLoader?: TopLoaderController }).__topLoader = topLoader;
}

export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Route-change tick: run a fast scripted animation.
  useEffect(() => {
    clear();
    setVisible(true);
    setProgress(8);
    timers.current.push(setTimeout(() => setProgress(40), 60));
    timers.current.push(setTimeout(() => setProgress(72), 180));
    timers.current.push(setTimeout(() => setProgress(92), 420));
    timers.current.push(setTimeout(() => setProgress(100), 650));
    timers.current.push(setTimeout(() => setVisible(false), 900));
    timers.current.push(setTimeout(() => setProgress(0), 1050));
    return clear;
  }, [pathname, searchParams]);

  // In-flight API tick: show the bar while any apiFetch is pending.
  useEffect(() => {
    return topLoader.subscribe(() => {
      if (topLoader.isBusy()) {
        setVisible(true);
        setProgress(prev => (prev < 70 ? Math.max(prev, 25) : Math.min(prev + 5, 92)));
      } else {
        setProgress(100);
        timers.current.push(setTimeout(() => setVisible(false), 250));
        timers.current.push(setTimeout(() => setProgress(0), 400));
      }
    });
  }, []);

  return (
    <div className="top-loader" data-visible={visible ? "true" : "false"} aria-hidden="true">
      <div className="top-loader-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
