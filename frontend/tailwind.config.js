/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        claude: {
          orange: '#d97706',
          dark: '#1a1a1a',
          darker: '#0f0f0f',
          bg: '#121212',
          surface: '#1a1a1a',
          border: '#2a2a2a',
          text: '#e5e5e5',
          muted: '#888888'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
