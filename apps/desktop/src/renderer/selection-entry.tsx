import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/globals.css';
import { ScreenCaptureRegion } from '@echo-lingo/contracts';
import { Crop } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

const SelectionOverlay: React.FC = () => {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const displayIdRef = useRef<number>(0);

  useEffect(() => {
    // Parse target display ID from URL query
    const params = new URLSearchParams(window.location.search);
    const dId = params.get('displayId');
    if (dId) {
      displayIdRef.current = parseInt(dId, 10);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI?.screenTranslation?.cancelSelectionWindow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary button
    setStartPoint({ x: e.clientX, y: e.clientY });
    setCurrentPoint({ x: e.clientX, y: e.clientY });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) {
      setCurrentPoint({ x: e.clientX, y: e.clientY });
      return;
    }
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !startPoint || !currentPoint) {
      setIsSelecting(false);
      return;
    }

    setIsSelecting(false);

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    // Enforce minimum selection threshold (at least 8x8 px)
    if (width >= 8 && height >= 8) {
      const region: ScreenCaptureRegion = {
        displayId: displayIdRef.current,
        x,
        y,
        width,
        height,
      };
      window.electronAPI?.screenTranslation?.completeSelection(region);
    }
  };

  // Compute selection rectangle bounds
  let rectX = 0;
  let rectY = 0;
  let rectW = 0;
  let rectH = 0;

  if (isSelecting && startPoint && currentPoint) {
    rectX = Math.min(startPoint.x, currentPoint.x);
    rectY = Math.min(startPoint.y, currentPoint.y);
    rectW = Math.abs(currentPoint.x - startPoint.x);
    rectH = Math.abs(currentPoint.y - startPoint.y);
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="w-screen h-screen relative select-none cursor-crosshair overflow-hidden"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.40)' }}
    >
      {/* Top Floating Glass Instruction Pill */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass-panel-elevated shadow-glass-elevated border border-white/20 text-white text-xs font-medium flex items-center gap-3 pointer-events-none z-50 backdrop-blur-2xl">
        <div className="flex items-center gap-1.5 text-primary-foreground font-semibold">
          <Crop className="w-3.5 h-3.5 text-primary" />
          <span>Click & drag to select region</span>
        </div>
        <span className="text-white/40">•</span>
        <span className="text-white/80 text-[11px]">
          Press <kbd className="px-1.5 py-0.5 bg-white/15 rounded font-mono text-[10px] border border-white/25">Esc</kbd> to cancel
        </span>
      </div>

      {/* Dimmed cutout and selection border */}
      {isSelecting && rectW > 0 && rectH > 0 && (
        <>
          {/* Transparent cutout inside selection box */}
          <div
            className="absolute border-2 border-primary bg-transparent pointer-events-none z-40 transition-none"
            style={{
              left: `${rectX}px`,
              top: `${rectY}px`,
              width: `${rectW}px`,
              height: `${rectH}px`,
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.45), inset 0 0 15px rgba(59, 130, 246, 0.2), 0 0 0 9999px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* Dimensions Glass Badge */}
            <div className="absolute -top-7 left-0 px-2 py-0.5 rounded-lg glass-panel-elevated bg-primary/90 text-white text-[11px] font-mono font-semibold shadow-md whitespace-nowrap border border-white/30">
              {rectW} × {rectH} px
            </div>

            {/* Corner guide handles */}
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-blue-500 rounded-sm" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-blue-500 rounded-sm" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-blue-500 rounded-sm" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-blue-500 rounded-sm" />
          </div>
        </>
      )}

      {/* Crosshair guide lines following mouse */}
      {currentPoint && !isSelecting && (
        <>
          <div
            className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none"
            style={{ left: `${currentPoint.x}px` }}
          />
          <div
            className="absolute left-0 right-0 h-px bg-white/20 pointer-events-none"
            style={{ top: `${currentPoint.y}px` }}
          />
        </>
      )}
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SelectionOverlay />
    </React.StrictMode>
  );
}
