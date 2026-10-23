import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";
import { SplashStatusEvent } from "@echo-lingo/contracts";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import en from "@/app/i18n/en.json";
import vi from "@/app/i18n/vi.json";

export const SplashScreen: React.FC = () => {
  const [locale, setLocale] = useState<string>("en");
  const [appVersion, setAppVersion] = useState<string>("1.0.1");
  const [status, setStatus] = useState<SplashStatusEvent>({
    message: "Starting EchoLingo...",
    step: 1,
    totalSteps: 4,
    progress: 15,
  });

  useEffect(() => {
    if (window.electronAPI?.settings?.get) {
      window.electronAPI.settings
        .get()
        .then((s) => {
          if (s?.locale) setLocale(s.locale);
        })
        .catch(() => {});
    }

    if (window.electronAPI?.app?.getSystemInfo) {
      window.electronAPI.app
        .getSystemInfo()
        .then((info) => {
          if (info?.appVersion) {
            setAppVersion(info.appVersion);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Listen for real-time initialization steps from Electron main process
    if (window.electronAPI?.splash?.onStatus) {
      const unsub = window.electronAPI.splash.onStatus((evt) => {
        setStatus((prev) => ({
          message: evt.message || prev.message,
          step: evt.step ?? prev.step,
          totalSteps: evt.totalSteps ?? prev.totalSteps,
          progress: evt.progress !== undefined ? evt.progress : prev.progress,
        }));
      });
      return () => {
        if (unsub) unsub();
      };
    }
  }, []);

  // Smooth fallback progress simulator in case initialization is very fast or waiting for IPC
  useEffect(() => {
    const timer = setInterval(() => {
      setStatus((prev) => {
        if (prev.progress !== undefined && prev.progress < 90) {
          return { ...prev, progress: Math.min(90, prev.progress + 3) };
        }
        return prev;
      });
    }, 120);

    return () => clearInterval(timer);
  }, []);

  const progressPercent = Math.min(100, Math.max(5, status.progress ?? 20));
  const dict = locale === "vi" ? vi : en;

  return (
    <div className="w-screen h-screen flex items-center justify-center p-3 bg-transparent select-none">
      <div className="w-full h-full relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0d1322]/95 via-[#0a0f1d]/95 to-[#060811]/95 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_40px_rgba(59,130,246,0.18)] backdrop-blur-2xl flex flex-col justify-between p-6">
        {/* Ambient Specular Background Flares */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header: App Branding */}
        <div className="flex items-center gap-4 relative z-10 pt-1">
          {/* Logo with pulsing glow halo */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-primary/25 blur-md animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 p-2 flex items-center justify-center shadow-lg shadow-black/40">
              <img
                src="/icon.png"
                alt="EchoLingo"
                className="w-full h-full object-contain filter drop-shadow"
                onError={(e) => {
                  // Fallback icon placeholder if image path fails
                  e.currentTarget.style.display = "none";
                }}
              />
              <Sparkles
                className="w-7 h-7 text-primary absolute"
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* App Title & Version & Tagline */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                EchoLingo
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-primary/20 text-primary border border-primary/30 rounded-full">
                v{appVersion}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/90 font-medium mt-0.5">
              {dict.splash.subtitle}
            </p>
          </div>
        </div>

        {/* Center / Bottom: Progress Track & Status */}
        <div className="space-y-3 relative z-10 pb-1">
          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800/80 border border-white/5 overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-primary transition-all duration-300 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Status Message and Privacy Badge */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-slate-300">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
              <span className="truncate max-w-[280px]">{status.message}</span>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-medium shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{dict.splash.offlineNotice}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SplashScreen />
    </React.StrictMode>,
  );
}
