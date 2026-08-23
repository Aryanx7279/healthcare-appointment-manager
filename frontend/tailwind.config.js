/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        accent: {
          50:  '#E0F2FE',
          500: '#0EA5E9',
          600: '#0891B2',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F8FAFC',
          3: '#F1F5F9',
        },
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm:  '6px',
        md:  '10px',
        lg:  '14px',
        xl:  '18px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        xs:   '0 1px 2px rgba(15,23,42,0.04)',
        sm:   '0 1px 4px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        md:   '0 4px 16px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
        lg:   '0 8px 32px rgba(15,23,42,0.10), 0 4px 8px rgba(15,23,42,0.05)',
        xl:   '0 20px 48px rgba(15,23,42,0.12), 0 8px 16px rgba(15,23,42,0.06)',
        blue: '0 4px 20px rgba(37,99,235,0.25)',
        'blue-lg': '0 8px 32px rgba(37,99,235,0.3)',
      },
      animation: {
        'fade-in':    'fadeIn 0.35s ease both',
        'slide-up':   'slideUp 0.35s ease both',
        'pulse-slow': 'pulseSlow 2.5s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSlow: { '0%,100%': { opacity: '0.7' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
}
