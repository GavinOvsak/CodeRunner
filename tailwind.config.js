/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0d0f12',     // deep carbon background
          panel: '#161a22',    // glassy card surface
          accent: '#3b82f6',   // active timer / information blue
          danger: '#ef4444',   // emergency shock ruby red
          warning: '#f59e0b',  // warning alert amber
          success: '#10b981',  // ROSC clinical green
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
