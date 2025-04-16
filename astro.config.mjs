// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwindcss from "@tailwindcss/vite";
import yaml from "@rollup/plugin-yaml";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  // site: "https://munusshih.com",
  site:
    process.env.NODE_ENV === "production"
      ? "https://munusshih.github.io"
      : "http://localhost:3000",
  base: "munusshih.com/",
  output: "static",
  adapter: vercel(),
  devToolbar: {
    enabled: false,
  },
  integrations: [mdx(), sitemap()],
  vite: {
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },

    plugins: [tailwindcss(), yaml()],
  },
});
