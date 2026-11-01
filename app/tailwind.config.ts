import type { Config } from "tailwindcss";

// Token diambil dari desain "Redesign Website" (design/referensi).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0A4256", 700: "#0E5670", 800: "#00647B" },
        brand: { DEFAULT: "#00809C", dark: "#00647B", tint: "#E0F3F7" },
        accent: { DEFAULT: "#F07020", dark: "#B8460A", tint: "#FFEBDD" },
        success: { DEFAULT: "#1D6B3F", tint: "#E6F4EC" },
        ink: { DEFAULT: "#1E3440", soft: "#4F6670" },
        line: { DEFAULT: "#DCE8EC", strong: "#C3D8DE" },
        canvas: "#F6FAFB",
        cloud: "#F9FCFD", // cloud white: latar sidebar dan bilah atas
        mist: "#CFE6EC",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "system-ui", "sans-serif"], // judul juga Poppins
      },
    },
  },
  plugins: [],
};
export default config;
