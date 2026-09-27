/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { 700: '#7E2625', 800: '#6B1F20', 900: '#5C1A1B', 950: '#471314' },
        saffron: { 100: '#FCEAD6', 400: '#EF9C4B', 500: '#E8852B', 600: '#D26F1A' },
        gold: { 300: '#E3C36B', 400: '#D4A943', 500: '#BD9234' },
        kumkum: { 50: '#FDE8E2', 100: '#FAC9BC', 300: '#E8977E', 500: '#C8401F', 600: '#A93318' },
        cream: { 50: '#FBF6EC', 100: '#F4EAD8', 200: '#EADBBE' },
        leaf: { 50: '#E8F5EC', 100: '#C8E8D0', 300: '#87BF97', 600: '#3E7C4F', 700: '#2F6340' },
        ink: { 900: '#2B1B12', 600: '#5D4A3B' }
      },
      fontFamily: {
        display: ['Marcellus', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 20px rgba(92,26,27,.08)',
        glow: '0 0 0 3px rgba(232,133,43,.25)'
      }
    }
  },
  plugins: []
};
