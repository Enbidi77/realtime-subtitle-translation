/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        glass: {
          DEFAULT: 'var(--glass-surface)',
          surface: 'var(--glass-surface)',
          elevated: 'var(--glass-surface-elevated)',
          subtle: 'var(--glass-surface-subtle)',
          toolbar: 'var(--glass-surface-toolbar)',
          sidebar: 'var(--glass-surface-sidebar)',
          modal: 'var(--glass-surface-modal)',
          input: 'var(--glass-surface-input)',
          border: 'var(--glass-border)',
          'border-elevated': 'var(--glass-border-elevated)',
          'border-subtle': 'var(--glass-border-subtle)',
          highlight: 'var(--glass-highlight)',
        },
        google: {
          blue: '#1A73E8',
          'blue-light': '#8AB4F8',
          dark: '#131314',
          'dark-surface': '#1E1F20',
          'dark-elevated': '#282A2C',
          'dark-border': '#3C4043',
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
        '2xl': '1rem',
        xl: '0.875rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        'glass-elevated': 'var(--glass-shadow-elevated)',
        'glass-subtle': 'var(--glass-shadow-subtle)',
        'glass-glow': 'var(--glass-glow)',
        'glass-inner': 'inset 0 1px 1px 0 var(--glass-highlight)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
        'glass-elevated': 'var(--glass-blur-elevated)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2.5s ease-in-out infinite',
        'ambient-1': 'ambientFloat1 18s ease-in-out infinite alternate',
        'ambient-2': 'ambientFloat2 22s ease-in-out infinite alternate',
        'ambient-3': 'ambientFloat3 20s ease-in-out infinite alternate',
        'ambient-4': 'ambientFloat4 24s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        ambientFloat1: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(35px, -25px) scale(1.06)' },
          '100%': { transform: 'translate(-20px, 20px) scale(0.95)' },
        },
        ambientFloat2: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(-30px, 30px) scale(1.05)' },
          '100%': { transform: 'translate(25px, -25px) scale(0.94)' },
        },
        ambientFloat3: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(25px, 30px) scale(1.08)' },
          '100%': { transform: 'translate(-25px, -20px) scale(0.96)' },
        },
        ambientFloat4: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(-35px, -20px) scale(1.04)' },
          '100%': { transform: 'translate(20px, 25px) scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
};
