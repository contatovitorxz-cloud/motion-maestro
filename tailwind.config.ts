import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
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
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        obsidian: "hsl(var(--obsidian))",
        amber: {
          DEFAULT: "hsl(var(--amber))",
          foreground: "hsl(var(--amber-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        panel: {
          DEFAULT: "hsl(var(--panel))",
          elevated: "hsl(var(--panel-elevated))",
          foreground: "hsl(var(--panel-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        track: {
          video: "hsl(var(--track-video))",
          overlay: "hsl(var(--track-overlay))",
          text: "hsl(var(--track-text))",
          audio: "hsl(var(--track-audio))",
          captions: "hsl(var(--track-captions))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 hsl(142 70% 48% / 0.6)" },
          "50%": { opacity: "0.85", boxShadow: "0 0 0 6px hsl(142 70% 48% / 0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 16px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 32px hsl(var(--primary) / 0.6)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-left": "slide-in-left 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
