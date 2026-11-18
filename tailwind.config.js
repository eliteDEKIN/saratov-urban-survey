/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './admin.html', './app.js', './admin.js', './hero-variants.html', './hero-directions.html'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'Arial', 'sans-serif'] },
      colors: { night: '#0a0a0a' }
    }
  },
  plugins: []
};
