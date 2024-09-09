/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'h2': '1.8rem',
        'h3': '1.6rem',
      },
      fontWeight: {
        'h2': 'bold',
        'h3': 'bold',
      },
      margin: {
        'p': '1rem',
        'h2': '1rem',
        'h3': '0.6rem',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-9deg)' },
          '50%': { transform: 'rotate(27deg)' },
        }
      },
      animation: {
        wiggle: 'wiggle 0.75s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}