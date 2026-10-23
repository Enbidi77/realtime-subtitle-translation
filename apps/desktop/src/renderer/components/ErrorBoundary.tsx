import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { createRendererLogger } from "@echo-lingo/logger";
import { useSettingsStore } from "@/stores/settings-store.js";
import en from "@/app/i18n/en.json";
import vi from "@/app/i18n/vi.json";

const log = createRendererLogger("ErrorBoundary");

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    log.error("Caught render error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      const locale = useSettingsStore.getState()?.settings?.locale || "en";
      const dict = locale === "vi" ? vi : en;

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-background text-foreground select-none">
          <div className="glass-modal max-w-md w-full p-6 text-center space-y-4 border border-destructive/40 shadow-glass-elevated">
            <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                {this.props.fallbackTitle ||
                  (locale === "vi" ? "Thông báo ứng dụng" : "Application Notice")}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {locale === "vi"
                  ? "Đã xảy ra sự cố giao diện ngoài ý muốn. Bạn có thể tải lại cửa sổ để khôi phục trạng thái bình thường."
                  : "An unexpected UI state occurred. You can reload the window to restore normal state."}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-glass-subtle border border-glass-border font-mono text-[11px] text-destructive/90 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{dict.common?.reload || "Reload Application"}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
