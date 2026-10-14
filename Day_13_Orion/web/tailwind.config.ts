import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        night: "#0B0B0D",
        surface: "#121214",
        "surface-hover": "#222228",
        "surface-low": "#0B0B0D",
        "surface-high": "#19191D",
        "surface-container-low": "#121214",
        terminal: "#0E0E11",
        "code-bg": "#0E0E11",
        panel: "#121214",
        "panel-high": "#19191D",
        hairline: "#1F1F24",
        "outline-variant": "#2B2B32",
        ink: "#F4F4F5",
        "ink-variant": "#A1A1AA",
        gray2: "#A1A1AA",
        gray3: "#71717A",
        primary: "#8B5CF6",
        "primary-light": "#A78BFA",
        "primary-dim": "#7C3AED",
        secondary: "#60A5FA",
        "secondary-dim": "#3B82F6",
        accent: "#FB923C",
        "accent-dim": "#EA580C",
        volt: "#4ADE80",
        cyan: "#60A5FA",
        magenta: "#A78BFA",
        amber: "#FACC15",
        "code-keyword": "#A78BFA",
        "code-string": "#4ADE80",
        "code-func": "#F4F4F5",
        "code-comment": "#71717A",
        danger: "#FB7185",
      },
      fontFamily: {
        headline: ["var(--font-inter)", "Inter", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "sans-serif"],
        code: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["40px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        "headline-sm": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "code-md": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "700" }],
        "label-xs": ["11px", { lineHeight: "1.4", fontWeight: "600" }],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      keyframes: {
        "log-in": {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "log-in": "log-in 120ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
