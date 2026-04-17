import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f8fafc",
        line: "#dbe4f0",
        accent: "#006f5f",
        warning: "#c2410c",
        surface: "#ffffff",
        muted: "#5b667a",
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: [
          "\"Pretendard Variable\"",
          "\"Pretendard\"",
          "\"Noto Sans KR\"",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "\"SUIT Variable\"",
          "\"SUIT\"",
          "\"Pretendard Variable\"",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
