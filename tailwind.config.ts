import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "#0a0a0f",
        foreground: "#e4e1e9",
        surface: { DEFAULT: "#131318", dim: "#131318", container: "#1f1f25", "container-high": "#2a292f", "container-highest": "#35343a", "container-low": "#1b1b20", bright: "#39383e" },
        "on-surface": "#e4e1e9",
        "on-surface-variant": "#cbc3d7",
        primary: { DEFAULT: "#d0bcff", container: "#a078ff", fixed: "#e9ddff", "fixed-dim": "#d0bcff" },
        "on-primary": "#3c0091",
        "on-primary-container": "#340080",
        secondary: { DEFAULT: "#bdc2ff", container: "#2f3aa3", fixed: "#e0e0ff" },
        tertiary: { DEFAULT: "#cebdff", container: "#9b7fed" },
        "outline-variant": "#494454",
        outline: "#958ea0",
        error: "#ffb4ab",
        border: "rgba(255, 255, 255, 0.06)",
        input: "rgba(255, 255, 255, 0.06)",
        ring: "#d0bcff",
        card: { DEFAULT: "#1f1f25", foreground: "#e4e1e9" },
        muted: { DEFAULT: "#35343a", foreground: "#cbc3d7" },
        accent: { DEFAULT: "#2a292f", foreground: "#e4e1e9" },
        popover: { DEFAULT: "#1f1f25", foreground: "#e4e1e9" },
        destructive: { DEFAULT: "#ffb4ab", foreground: "#690005" },
      },
      spacing: {
        "sidebar-width": "240px",
        "container-padding": "32px",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
        xl: "1rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
