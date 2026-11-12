"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
const KEY = "ams.theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== "undefined" && window.localStorage.getItem(KEY)) as Theme | null;
    const initial: Theme = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try { window.localStorage.setItem(KEY, next); } catch { /* noop */ }
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="tb-theme-trigger" aria-label="Theme" disabled>
        <Sun aria-hidden="true" />
      </Button>
    );
  }

  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="tb-theme-trigger"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      data-theme={theme}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
