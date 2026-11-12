"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CapabilitiesProvider } from "@/contexts/CapabilitiesContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { AppSidebar } from "@/components/AppSidebar";
import { CopilotSidePanel } from "@/components/CopilotSidePanel";
import { CopilotProvider } from "@/contexts/CopilotContext";
import { NotificationToastHost } from "@/components/NotificationToastHost";
import { ToastProvider, ToastBridgeInstaller } from "@/components/Toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Global behavior fix for every .search-input: clicking anywhere inside
  // (padding, icon, empty space) forwards focus to the inner input, and
  // when the input is empty the caret always lands at position 0.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const container = target.closest(".search-input");
      if (!container) return;
      if (target instanceof HTMLInputElement) return;
      if (target instanceof HTMLButtonElement) return;
      const input = container.querySelector("input");
      if (!input) return;
      event.preventDefault();
      input.focus();
      if (!input.value) input.setSelectionRange(0, 0);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.closest(".search-input")) return;
      if (!target.value) target.setSelectionRange(0, 0);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="app-frame">
        <div style={{ width: 248, background: "var(--card)", borderRight: "1px solid var(--hairline)", height: "100dvh" }} />
        <div style={{ flex: 1, padding: 24 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 40, background: "var(--surface-2)", borderRadius: 6, marginBottom: 12, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <CapabilitiesProvider>
      <NotificationsProvider>
        <CopilotProvider>
          <ToastProvider>
            <ToastBridgeInstaller />
            <div className="app-frame">
              <AppSidebar />
              <div className="main-col">
                {children}
                {user?.ai_enabled === true && <CopilotSidePanel key={user.id} />}
                <NotificationToastHost />
              </div>
            </div>
          </ToastProvider>
        </CopilotProvider>
      </NotificationsProvider>
    </CapabilitiesProvider>
  );
}
