import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // MResult brand palette — sourced from mresult.com CSS variables
        mr: {
          dark:    "#121C27",  // --e-global-color-primary
          darker:  "#0A1119",  // --e-global-color-secondary
          navy:    "#001E38",  // deep navy section background
          green:   "#61CE70",  // --e-global-color-accent
          orange:  "#F89738",  // logo orange / CTA hover
          text:    "#4B535D",  // body text
          border:  "#D3D5D6",  // border
          bg:      "#F4F6F8",  // page background (light)
          surface: "#FFFFFF",  // card/panel surface
        },
      },
      fontFamily: {
        // mresult.com primary fonts — Mukta Vaani, Josefin Sans, Biryani
        heading: ["Mukta Vaani", "Biryani", "sans-serif"],
        body:    ["Josefin Sans", "Biryani", "sans-serif"],
        mukta:   ["Mukta Vaani", "sans-serif"],
        josefin: ["Josefin Sans", "sans-serif"],
        biryani: ["Biryani", "sans-serif"],
      },
      backgroundImage: {
        "mr-gradient": "linear-gradient(135deg, #121C27 0%, #001E38 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
