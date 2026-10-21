import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/globals.css';
import { RadialMenuActionId, RadialMenuState } from '@echo-lingo/contracts';
import { createLogger } from '@echo-lingo/logger';
import {
  Settings,
  EyeOff,
  Eye,
  Wand2,
  Mic,
  MicOff,
  Maximize2,
  FileText,
  Zap,
  Smile,
  Sparkles,
  Layers,
  RotateCcw,
  Copy,
  Check,
  Pause,
  Play,
  Scissors,
  Bot,
} from 'lucide-react';

interface MenuItemConfig {
  id: RadialMenuActionId;
  angleIndex: number;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  shortcut: string;
  description: string;
  callouts: (state: RadialMenuState | null) => string[];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  // 0 deg = 12 o'clock (subtract 90 deg)
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createPetalPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startAngle: number,
  endAngle: number,
  cornerRadius = 7
): string {
  const maxCr = Math.min((rOut - rIn) / 2, 10);
  const cr = Math.min(cornerRadius, maxCr);

  const deltaOutDeg = (cr / rOut) * (180 / Math.PI);
  const deltaInDeg = (cr / rIn) * (180 / Math.PI);

  const a0 = startAngle;
  const a1 = endAngle;

  const pOuterStart = polarToCartesian(cx, cy, rOut, a0 + deltaOutDeg);
  const pOuterEnd = polarToCartesian(cx, cy, rOut, a1 - deltaOutDeg);

  const pRayOutEnd = polarToCartesian(cx, cy, rOut - cr, a1);
  const pRayInEnd = polarToCartesian(cx, cy, rIn + cr, a1);

  const pInnerEnd = polarToCartesian(cx, cy, rIn, a1 - deltaInDeg);
  const pInnerStart = polarToCartesian(cx, cy, rIn, a0 + deltaInDeg);

  const pRayInStart = polarToCartesian(cx, cy, rIn + cr, a0);
  const pRayOutStart = polarToCartesian(cx, cy, rOut - cr, a0);

  return [
    `M ${pOuterStart.x.toFixed(2)} ${pOuterStart.y.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 0 1 ${pOuterEnd.x.toFixed(2)} ${pOuterEnd.y.toFixed(2)}`,
    `A ${cr} ${cr} 0 0 1 ${pRayOutEnd.x.toFixed(2)} ${pRayOutEnd.y.toFixed(2)}`,
    `L ${pRayInEnd.x.toFixed(2)} ${pRayInEnd.y.toFixed(2)}`,
    `A ${cr} ${cr} 0 0 1 ${pInnerEnd.x.toFixed(2)} ${pInnerEnd.y.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 0 0 ${pInnerStart.x.toFixed(2)} ${pInnerStart.y.toFixed(2)}`,
    `A ${cr} ${cr} 0 0 1 ${pRayInStart.x.toFixed(2)} ${pRayInStart.y.toFixed(2)}`,
    `L ${pRayOutStart.x.toFixed(2)} ${pRayOutStart.y.toFixed(2)}`,
    `A ${cr} ${cr} 0 0 1 ${pOuterStart.x.toFixed(2)} ${pOuterStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// 12 Items aligned around 360 degrees (each 30 degrees apart)
const MENU_ITEMS: MenuItemConfig[] = [
  {
    id: 'open-settings',
    angleIndex: 0, // 12 o'clock (0°)
    label: 'Preferences',
    category: 'System',
    icon: Settings,
    accentColor: '#3b82f6',
    shortcut: 'Settings',
    description: 'Configure languages, models & shortcuts',
    callouts: () => ['System Settings', 'Ctrl+,', 'Voice & AI Config'],
  },
  {
    id: 'toggle-click-through',
    angleIndex: 1, // 1 o'clock (30°)
    label: 'Click-Through',
    category: 'Overlay',
    icon: EyeOff,
    accentColor: '#0ea5e9',
    shortcut: 'Mouse Bypass',
    description: 'Allow mouse clicks to pass through overlay',
    callouts: (state) => [
      `Overlay: ${state?.isOverlayVisible ? 'Visible' : 'Hidden'}`,
      `Click-Through: ${state?.isClickThrough ? 'Active' : 'Off'}`,
      'Gaming / Video Mode',
    ],
  },
  {
    id: 'capture-translate',
    angleIndex: 2, // 2 o'clock (60°)
    label: 'Screen OCR',
    category: 'Translate',
    icon: Wand2,
    accentColor: '#06b6d4',
    shortcut: 'Ctrl+Shift+T',
    description: 'Snip screen region to extract & translate text',
    callouts: () => ['Snip Screen Region', 'Ctrl+Shift+T', 'Floating Card Result'],
  },
  {
    id: 'pause-listening',
    angleIndex: 3, // 3 o'clock (90°)
    label: 'Pause Speech',
    category: 'Audio',
    icon: MicOff,
    accentColor: '#ec4899',
    shortcut: 'Ctrl+Shift+P',
    description: 'Pause or resume live microphone capture',
    callouts: (state) => [
      state?.isPaused ? 'Speech: Paused' : state?.isListening ? 'Speech: Active' : 'Speech: Idle',
      'Ctrl+Shift+P',
      'VAD Audio Gate',
    ],
  },
  {
    id: 'open-app',
    angleIndex: 4, // 4 o'clock (120°)
    label: 'Open EchoLingo',
    category: 'App',
    icon: Maximize2,
    accentColor: '#10b981',
    shortcut: 'Dashboard',
    description: 'Bring the main EchoLingo application to front',
    callouts: () => ['Full Application', 'Dashboard & History', 'Session Analytics'],
  },
  {
    id: 'show-ocr-panel',
    angleIndex: 5, // 5 o'clock (150°)
    label: 'OCR Results',
    category: 'Panel',
    icon: FileText,
    accentColor: '#6366f1',
    shortcut: 'Ctrl+Shift+H',
    description: 'Toggle floating OCR translation card',
    callouts: (state) => [
      state?.isOcrPanelVisible ? 'Panel: Open' : 'Panel: Hidden',
      'Ctrl+Shift+H',
      'Recent OCR Extractions',
    ],
  },
  {
    id: 'continuous-ocr',
    angleIndex: 6, // 6 o'clock (180°)
    label: 'Continuous OCR',
    category: 'Automation',
    icon: Zap,
    accentColor: '#eab308',
    shortcut: 'Ctrl+Shift+R',
    description: 'Auto-scan on-screen text with difference detection',
    callouts: (state) => [
      state?.isContinuousOcr ? 'Scheduler: Running' : 'Scheduler: Standby',
      'Ctrl+Shift+R',
      'Smart Diff Tracker',
    ],
  },
  {
    id: 'toggle-listening',
    angleIndex: 7, // 7 o'clock (210°) - Signature blue active petal in reference image!
    label: 'Live Speech',
    category: 'Expressions',
    icon: Smile,
    accentColor: '#2563eb',
    shortcut: 'Ctrl+Shift+Space',
    description: 'Real-time speech transcription & live subtitles',
    callouts: (state) => [
      state?.isListening ? 'Status: Listening' : 'Status: Ready',
      'Ctrl+Shift+Space',
      '16kHz VAD Pipeline',
    ],
  },
  {
    id: 'translate-clipboard',
    angleIndex: 8, // 8 o'clock (240°)
    label: 'Clipboard',
    category: 'Translate',
    icon: Sparkles,
    accentColor: '#14b8a6',
    shortcut: 'Instant',
    description: 'Translate copied text in clipboard immediately',
    callouts: (state) => [
      `Target: ${state?.targetLanguages?.[0]?.toUpperCase() || 'VI'}`,
      'Instant Floating Card',
      'Direct Clipboard Snip',
    ],
  },
  {
    id: 'toggle-overlay',
    angleIndex: 9, // 9 o'clock (270°)
    label: 'Subtitles HUD',
    category: 'Overlay',
    icon: Layers,
    accentColor: '#8b5cf6',
    shortcut: 'Ctrl+Shift+O',
    description: 'Show or hide floating glass subtitle overlay',
    callouts: (state) => [
      state?.isOverlayVisible ? 'Overlay: Visible' : 'Overlay: Hidden',
      'Ctrl+Shift+O',
      'Glassmorphic HUD',
    ],
  },
  {
    id: 'clear-subtitles',
    angleIndex: 10, // 10 o'clock (300°)
    label: 'Clear Subtitles',
    category: 'Timeline',
    icon: RotateCcw,
    accentColor: '#f97316',
    shortcut: 'Reset',
    description: 'Clear all active subtitle lines from overlay',
    callouts: () => ['Clear Screen HUD', 'Reset Timeline', 'Empty Canvas'],
  },
  {
    id: 'copy-last',
    angleIndex: 11, // 11 o'clock (330°)
    label: 'Copy Latest',
    category: 'Clipboard',
    icon: Copy,
    accentColor: '#f43f5e',
    shortcut: 'Ctrl+Shift+C',
    description: 'Copy the most recent recognized subtitle',
    callouts: (state) => [
      state?.lastSubtitleText ? `"${state.lastSubtitleText.slice(0, 24)}..."` : 'No recent subtitle',
      'Ctrl+Shift+C',
      'Copy to Clipboard',
    ],
  },
];

// Mascot Bongo Cat typing on keyboard at top right
const BongoCatMascot: React.FC<{ isInteracting: boolean; animKey: number }> = ({ isInteracting, animKey }) => {
  return (
    <div
      key={`mascot-${animKey}`}
      className="absolute top-2 right-4 pointer-events-none select-none"
      style={{
        animation: 'mascotBloom 520ms cubic-bezier(0.34, 1.56, 0.64, 1) 140ms both',
        transform: isInteracting ? 'scale(1.04) rotate(-1deg)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}
    >
      <svg width="150" height="110" viewBox="0 0 150 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Drop shadow underneath */}
        <ellipse cx="80" cy="98" rx="55" ry="8" fill="rgba(0,0,0,0.18)" filter="blur(4px)" />

        {/* Cat Body & Head */}
        <path
          d="M 45 95 C 40 60 55 25 78 25 C 88 25 96 28 103 33 L 112 18 C 114 15 118 16 119 19 L 123 37 C 132 45 137 58 138 72 C 140 85 135 96 128 98 Z"
          fill="#FFFFFF"
          stroke="#1E293B"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />

        {/* Left Ear */}
        <path
          d="M 62 34 L 52 14 C 50 11 46 13 47 16 L 53 38 Z"
          fill="#FFFFFF"
          stroke="#1E293B"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M 55 24 L 52 17 L 58 28 Z" fill="#FBCFE8" />

        {/* Right Ear Inner */}
        <path d="M 115 25 L 118 20 L 121 32 Z" fill="#FBCFE8" />

        {/* Cat Eyes happy arcs ^ ^ */}
        <path
          d="M 75 45 Q 82 40 89 45"
          stroke="#1E293B"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 103 47 Q 110 42 117 47"
          stroke="#1E293B"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Pink Cheek Blushes */}
        <ellipse cx="70" cy="53" rx="5" ry="3.5" fill="#FDA4AF" opacity="0.8" />
        <ellipse cx="120" cy="55" rx="5" ry="3.5" fill="#FDA4AF" opacity="0.8" />

        {/* Cute Mouth :3 */}
        <path
          d="M 92 52 Q 96 56 100 52 Q 104 56 108 52"
          stroke="#1E293B"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Keyboard on the table */}
        <g transform="translate(48, 62) rotate(14)">
          {/* Keyboard base */}
          <rect
            x="0"
            y="0"
            width="82"
            height="32"
            rx="5"
            fill="#F1F5F9"
            stroke="#1E293B"
            strokeWidth="2.8"
          />
          {/* Key rows grid */}
          <line x1="3" y1="8" x2="79" y2="8" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="3" y1="16" x2="79" y2="16" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="3" y1="24" x2="79" y2="24" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Key columns */}
          <line x1="16" y1="2" x2="16" y2="30" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="32" y1="2" x2="32" y2="30" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="48" y1="2" x2="48" y2="30" stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1="64" y1="2" x2="64" y2="30" stroke="#CBD5E1" strokeWidth="1.2" />
        </g>

        {/* Left Paw tapping keyboard */}
        <g
          style={{
            transform: isInteracting
              ? 'translate(64px, 68px) rotate(-6deg)'
              : 'translate(66px, 62px)',
            transition: 'transform 0.12s ease',
          }}
        >
          <ellipse cx="0" cy="0" rx="11" ry="8" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.6" />
          <ellipse cx="-2" cy="0" rx="4" ry="3" fill="#F472B6" />
        </g>

        {/* Right Paw tapping keyboard */}
        <g
          style={{
            transform: isInteracting
              ? 'translate(108px, 64px) rotate(4deg)'
              : 'translate(106px, 70px)',
            transition: 'transform 0.12s ease',
          }}
        >
          <ellipse cx="0" cy="0" rx="11" ry="8" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.6" />
          <ellipse cx="0" cy="0" rx="4" ry="3" fill="#F472B6" />
        </g>
      </svg>
    </div>
  );
};

const log = createLogger('RadialMenu');

export const RadialMenuApp: React.FC = () => {
  const [state, setState] = useState<RadialMenuState | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(7); // Default to item 7 (Live Speech, like image)
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const [executedFeedback, setExecutedFeedback] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state and window open trigger from Electron main process
  useEffect(() => {
    if (window.electronAPI?.radialMenu) {
      window.electronAPI.radialMenu.getState().then(setState).catch((err) => log.error('Failed to get radial menu state:', err));

      const unsubState = window.electronAPI.radialMenu.onState((fresh) => {
        setState(fresh);
      });

      const unsubOpened = (window.electronAPI.radialMenu as any).onOpened?.(() => {
        // Re-trigger the progressive disclosure entrance animation on every show!
        setAnimKey((prev) => prev + 1);
        setHoveredIndex(7);
        setClickedIndex(null);
        setExecutedFeedback(null);
      });

      return () => {
        if (unsubState) unsubState();
        if (unsubOpened) unsubOpened();
      };
    }
  }, []);

  // Keyboard navigation & dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.electronAPI?.radialMenu?.hide();
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        setHoveredIndex((prev) => ((prev ?? 0) + 1) % MENU_ITEMS.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setHoveredIndex((prev) => ((prev ?? 0) - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hoveredIndex !== null) {
          triggerAction(MENU_ITEMS[hoveredIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredIndex]);

  const triggerAction = useCallback(async (item: MenuItemConfig) => {
    setClickedIndex(item.angleIndex);
    setExecutedFeedback(item.label);

    try {
      if (window.electronAPI?.radialMenu) {
        await window.electronAPI.radialMenu.executeAction(item.id);
      }
    } catch (err) {
      log.error('Failed to execute action:', err);
    }
  }, []);

  // Geometry constants
  const cx = 280;
  const cy = 280;
  const rIn = 76;
  const rOut = 176;
  const rMid = (rIn + rOut) / 2; // 126
  const gapDeg = 3.6;
  const sliceSpan = 360 / MENU_ITEMS.length; // 30 deg

  const currentItem = hoveredIndex !== null ? MENU_ITEMS[hoveredIndex] : null;

  // Calculate callout cards position for hovered slice
  const calloutInfo = useMemo(() => {
    if (!currentItem) return null;
    const midAngle = currentItem.angleIndex * sliceSpan + sliceSpan / 2;
    // Radial projection outwards beyond rOut
    const calloutRadius = rOut + 46;
    const pos = polarToCartesian(cx, cy, calloutRadius, midAngle);
    const callouts = currentItem.callouts(state);

    // Determine horizontal alignment based on angle
    const isLeft = pos.x < cx;
    const isTop = pos.y < cy;

    return {
      x: pos.x,
      y: pos.y,
      isLeft,
      isTop,
      callouts,
    };
  }, [currentItem, state, cx, cy, rOut, sliceSpan]);

  return (
    <div
      ref={containerRef}
      key={`radial-menu-root-${animKey}`}
      className="relative w-[560px] h-[560px] flex items-center justify-center select-none overflow-visible"
      onClick={(e) => {
        // If clicking on root container outside interactive elements, dismiss
        if (e.target === containerRef.current) {
          window.electronAPI?.radialMenu?.hide();
        }
      }}
    >
      {/* Global CSS keyframes for increasing progressive disclosure animation */}
      <style>{`
        @keyframes petalBloom {
          0% {
            opacity: 0;
            transform: scale(0.32) rotate(-14deg);
          }
          65% {
            opacity: 0.98;
            transform: scale(1.05) rotate(1deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes iconBloom {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.2) rotate(-20deg);
          }
          65% {
            opacity: 0.98;
            transform: translate(-50%, -50%) scale(1.18) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
          }
        }

        @keyframes hubBloom {
          0% {
            opacity: 0;
            transform: scale(0.25);
          }
          70% {
            opacity: 1;
            transform: scale(1.08);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes mascotBloom {
          0% {
            opacity: 0;
            transform: translateY(32px) scale(0.78);
          }
          65% {
            opacity: 1;
            transform: translateY(-5px) scale(1.04);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes calloutCascade {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes ambientPulse {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          100% {
            opacity: 0.65;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Background radial ambient glow */}
      <div
        className="absolute w-[460px] h-[460px] rounded-full blur-3xl pointer-events-none transition-all duration-500 opacity-60"
        style={{
          animation: 'ambientPulse 500ms ease-out both',
          background: currentItem
            ? `radial-gradient(circle, ${currentItem.accentColor}33 0%, rgba(59, 130, 246, 0.1) 50%, transparent 70%)`
            : 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, transparent 70%)',
        }}
      />

      {/* Cute Mascot Bongo Cat at Top Right */}
      <BongoCatMascot isInteracting={hoveredIndex !== null} animKey={animKey} />

      {/* SVG Petal Segments */}
      <svg
        width="560"
        height="560"
        viewBox="0 0 560 560"
        className="absolute inset-0 overflow-visible cursor-default pointer-events-auto"
      >
        <defs>
          {/* Active radiant sky-to-royal-blue gradient (exact from reference image) */}
          <linearGradient id="activePetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          {/* Idle frosted glass petal gradient */}
          <linearGradient id="idlePetalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
            <stop offset="100%" stopColor="rgba(241, 245, 249, 0.88)" />
          </linearGradient>

          {/* Center Hub Glass Gradient */}
          <radialGradient id="centerHubGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.98)" />
            <stop offset="90%" stopColor="rgba(248, 250, 252, 0.92)" />
            <stop offset="100%" stopColor="rgba(226, 232, 240, 0.85)" />
          </radialGradient>

          {/* Drop shadow filters */}
          <filter id="petalShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0, 0, 0, 0.12)" />
          </filter>

          <filter id="activePetalGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="rgba(56, 189, 248, 0.75)" />
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="rgba(37, 99, 235, 0.4)" />
          </filter>
        </defs>

        {/* 12 Petal Wedges: Staggered progressive disclosure cascade */}
        {MENU_ITEMS.map((item) => {
          const isHovered = hoveredIndex === item.angleIndex;
          const isClicked = clickedIndex === item.angleIndex;
          const startAngle = item.angleIndex * sliceSpan + gapDeg / 2;
          const endAngle = (item.angleIndex + 1) * sliceSpan - gapDeg / 2;
          const pathD = createPetalPath(cx, cy, rIn, rOut, startAngle, endAngle, 8);

          // Progressive staggered delay: Clockwise cascade from index 0 to 11
          const staggerDelayMs = 25 + item.angleIndex * 24;

          return (
            <g
              key={item.id}
              className="cursor-pointer origin-center"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `petalBloom 380ms cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelayMs}ms both`,
              }}
              onMouseEnter={() => setHoveredIndex(item.angleIndex)}
              onClick={() => triggerAction(item)}
            >
              {/* Petal Path */}
              <path
                d={pathD}
                fill={isHovered ? 'url(#activePetalGradient)' : 'url(#idlePetalGradient)'}
                stroke={isHovered ? '#93c5fd' : 'rgba(255, 255, 255, 0.95)'}
                strokeWidth={isHovered ? '2' : '1.5'}
                filter={isHovered ? 'url(#activePetalGlow)' : 'url(#petalShadow)'}
                className="transition-all duration-150"
                style={{
                  transform: isHovered ? 'scale(1.03)' : isClicked ? 'scale(0.97)' : 'scale(1)',
                  transformOrigin: `${cx}px ${cy}px`,
                }}
              />
            </g>
          );
        })}

        {/* Central Hub Circle (blooms smoothly from center) */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: 'hubBloom 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={rIn - 10}
            fill="url(#centerHubGradient)"
            stroke="rgba(255, 255, 255, 0.98)"
            strokeWidth="2.5"
            filter="url(#petalShadow)"
            className="pointer-events-none"
          />
        </g>
      </svg>

      {/* Upright Icons placed cleanly over each petal with staggered bloom */}
      {MENU_ITEMS.map((item) => {
        const isHovered = hoveredIndex === item.angleIndex;
        const midAngle = item.angleIndex * sliceSpan + sliceSpan / 2;
        const pt = polarToCartesian(cx, cy, rMid, midAngle);
        const IconComponent = item.icon;
        const iconStaggerDelayMs = 40 + item.angleIndex * 24;

        return (
          <div
            key={`icon-${item.id}`}
            onClick={() => triggerAction(item)}
            onMouseEnter={() => setHoveredIndex(item.angleIndex)}
            className="absolute flex items-center justify-center pointer-events-auto cursor-pointer"
            style={{
              left: `${pt.x}px`,
              top: `${pt.y}px`,
              width: '40px',
              height: '40px',
              animation: `iconBloom 360ms cubic-bezier(0.16, 1, 0.3, 1) ${iconStaggerDelayMs}ms both`,
              transform: isHovered
                ? 'translate(-50%, -50%) scale(1.18)'
                : 'translate(-50%, -50%) scale(1)',
              transition: 'transform 0.15s ease',
            }}
            title={item.label}
          >
            <IconComponent
              className="w-6 h-6 transition-colors duration-150 drop-shadow-sm"
              style={{
                color: isHovered ? '#FFFFFF' : item.accentColor,
              }}
            />
          </div>
        );
      })}

      {/* Central Hub Content */}
      <div
        className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none z-20"
        style={{
          width: `${(rIn - 10) * 2}px`,
          height: `${(rIn - 10) * 2}px`,
          animation: 'hubBloom 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {currentItem ? (
          <>
            {/* Dynamic Hovered Icon */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all duration-200"
              style={{
                color: currentItem.angleIndex === 7 ? '#EC4899' : currentItem.accentColor,
              }}
            >
              <currentItem.icon className="w-8 h-8" />
            </div>

            {/* Title / Label */}
            <div className="font-bold text-[13px] tracking-tight text-[#0284c7] leading-tight px-1 line-clamp-1">
              {currentItem.label}
            </div>

            {/* Shortcut or Category Subtext */}
            <div className="text-[10px] text-slate-500 font-mono mt-0.5 opacity-90">
              {currentItem.shortcut}
            </div>
          </>
        ) : (
          <>
            {/* Idle Default: Pink smiley and "Expressions" (exact homage to user's image) */}
            <Smile className="w-8 h-8 text-[#EC4899] mb-1" />
            <div className="font-bold text-[13px] tracking-tight text-[#0284c7] leading-tight">
              Expressions
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Quick Actions
            </div>
          </>
        )}
      </div>

      {/* Floating Callout Cards (smooth cascade disclosure) */}
      {calloutInfo && calloutInfo.callouts.length > 0 && (
        <div
          className="absolute z-30 pointer-events-none flex flex-col gap-1.5 transition-all duration-200 ease-out"
          style={{
            left: `${calloutInfo.x}px`,
            top: `${calloutInfo.y}px`,
            transform: calloutInfo.isLeft
              ? 'translate(-100%, -50%)'
              : 'translate(0%, -50%)',
          }}
        >
          {calloutInfo.callouts.map((text, idx) => (
            <div
              key={idx}
              className="bg-white/95 text-slate-800 text-[11px] font-mono font-medium px-3 py-1.5 rounded-xl border border-white/90 shadow-[0_8px_20px_-3px_rgba(0,0,0,0.15)] backdrop-blur-md whitespace-nowrap flex items-center gap-1.5"
              style={{
                animation: `calloutCascade 260ms cubic-bezier(0.16, 1, 0.3, 1) ${300 + idx * 50}ms both`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Executed Action Temporary Toast Banner */}
      {executedFeedback && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-lg backdrop-blur-md border border-slate-700/50 flex items-center gap-2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Executing: {executedFeedback}</span>
        </div>
      )}
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <RadialMenuApp />
    </React.StrictMode>
  );
}
