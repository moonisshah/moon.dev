/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: [
	  './pages/**/*.{ts,tsx}',
	  './components/**/*.{ts,tsx}',
	  './app/**/*.{ts,tsx}',
	  './src/**/*.{ts,tsx}',
	],
	theme: {
	  container: {
		center: true,
		padding: "2rem",
		screens: {
		  "2xl": "1400px",
		},
	  },
	  extend: {
		colors: {
		  border: "hsl(var(--border))",
		  input: "hsl(var(--input))",
		  ring: "hsl(var(--ring))",
		  background: "hsl(var(--background))",
		  foreground: "hsl(var(--foreground))",
		  primary: {
			DEFAULT: "hsl(var(--primary))",
			foreground: "hsl(var(--primary-foreground))",
		  },
		  secondary: {
			DEFAULT: "hsl(var(--secondary))",
			foreground: "hsl(var(--secondary-foreground))",
		  },
		},
		borderRadius: {
		  lg: "var(--radius)",
		  md: "calc(var(--radius) - 2px)",
		  sm: "calc(var(--radius) - 4px)",
		},
		boxShadow: {
		  glass: "0 4px 30px rgba(0, 0, 0, 0.1)",
		},
		backdropBlur: {
		  glass: "20px",
		},
		backgroundColor: {
		  glassLight: "rgba(255, 255, 255, 0.09)",
		  glassDark: "rgba(250, 250, 250, 0.09)",
		},
		borderColor: {
		  glass: "rgba(255, 255, 255, 0.001)",
		},
	  },
	},
	plugins: [require("tailwindcss-animate")],
	
  }
  