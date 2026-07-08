import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oracle: {
          red: "#c74634",
          redDark: "#a83b2b",
          ink: "#312d2a",
          clay: "#6b625d",
          shell: "#f7f5f2",
          line: "#ded8d2",
        },
      },
      borderRadius: {
        app: "8px",
      },
      boxShadow: {
        app: "0 18px 45px rgba(49, 45, 42, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
