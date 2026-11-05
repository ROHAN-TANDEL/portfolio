/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#fafaf8',
        surface: '#ffffff',
        text: '#20211f',
        muted: '#777872',
        border: '#e8e8e3',
        accent: '#444a43',
        tag: '#efefeb',
        'tag-text': '#65675f',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
