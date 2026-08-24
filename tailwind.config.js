export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'neo-sm': '2px 2px 0px 0px #000000',
        'neo': '4px 4px 0px 0px #000000',
        'neo-lg': '6px 6px 0px 0px #000000',
        'neo-xl': '8px 8px 0px 0px #000000',
        'neo-2xl': '12px 12px 0px 0px #000000',
        'neo-white-sm': '2px 2px 0px 0px #ffffff',
        'neo-white': '4px 4px 0px 0px #ffffff',
        'neo-white-lg': '6px 6px 0px 0px #ffffff',
      },
      borderWidth: {
        '3': '3px',
        '5': '5px',
      },
      colors: {
        neo: {
          bg: '#FFFDF5',
          cream: '#FFF9E6',
          dark: '#121212',
          yellow: '#FFE600',
          yellowLight: '#FFF066',
          pink: '#FF66C4',
          pinkLight: '#FFB3E2',
          cyan: '#00F0FF',
          cyanLight: '#A3F9FF',
          lime: '#4ADE80',
          limeLight: '#86EFAC',
          purple: '#A78BFA',
          purpleLight: '#DDD6FE',
          orange: '#FF8A00',
          orangeLight: '#FFBA66',
          red: '#FF4D4D',
          border: '#000000',
        }
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}
