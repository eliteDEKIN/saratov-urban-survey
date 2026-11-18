/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './admin.html', './app.js', './admin.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'Arial', 'sans-serif'] },
      colors: { night: '#0a0a0a' }
    }
  },
  plugins: []
};
