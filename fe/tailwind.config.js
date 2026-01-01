/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff0f3',
          100: '#ffe3e8',
          200: '#ffc9d6',
          300: '#ff9fb6',
          400: '#ff6b8d',
          500: '#f43f68',
          600: '#e11d4e',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        dark: {
          950: '#030303',
          900: '#09090b',
          800: '#18181b',
          700: '#27272a',
          600: '#3f3f46',
          500: '#52525b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'float-up': 'floatUp 2s ease-out forwards',
        'slide-up-toast': 'slideUpToast 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        floatUp: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '50%': { opacity: '1', transform: 'translateY(-100px) scale(1.2)' },
          '100%': { opacity: '0', transform: 'translateY(-200px) scale(0.8)' },
        },
        slideUpToast: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
