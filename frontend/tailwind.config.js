/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102238",
        paper: "#f5f7fb",
        accent: "#118ab2",
        accentWarm: "#ff7a59",
        panel: "#ffffff",
        night: "#09111d",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(8, 21, 42, 0.12)",
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.05)", opacity: "0.2" },
        },
      },
      animation: {
        floatIn: "floatIn 0.6s ease-out both",
        pulseRing: "pulseRing 1.2s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};
