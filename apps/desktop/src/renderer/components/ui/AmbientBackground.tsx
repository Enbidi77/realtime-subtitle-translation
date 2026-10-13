import React from 'react';

interface AmbientBackgroundProps {
  className?: string;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 overflow-hidden z-0 select-none ${className}`}
    >
      {/* Top-left radial glow (Violet / Lavender) */}
      <div
        className="pointer-events-none absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full blur-[100px] transition-all duration-700 opacity-80"
        style={{
          background: 'radial-gradient(circle, var(--ambient-glow-1) 0%, transparent 70%)',
        }}
      />

      {/* Top-right radial glow (Cyan / Sky Blue) */}
      <div
        className="pointer-events-none absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full blur-[90px] transition-all duration-700 opacity-75"
        style={{
          background: 'radial-gradient(circle, var(--ambient-glow-2) 0%, transparent 70%)',
        }}
      />

      {/* Bottom-left / center radial glow (Deep Indigo / Mint) */}
      <div
        className="pointer-events-none absolute -bottom-[15%] left-[20%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[110px] transition-all duration-700 opacity-70"
        style={{
          background: 'radial-gradient(circle, var(--ambient-glow-3) 0%, transparent 70%)',
        }}
      />

      {/* Bottom-right radial glow (Radiant Magenta / Pink) */}
      <div
        className="pointer-events-none absolute -bottom-[10%] -right-[5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full blur-[90px] transition-all duration-700 opacity-60"
        style={{
          background: 'radial-gradient(circle, var(--ambient-glow-4) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};

