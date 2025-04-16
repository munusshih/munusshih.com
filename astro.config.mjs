// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwindcss from "@tailwindcss/vite";
import yaml from "@rollup/plugin-yaml";

// https://astro.build/config
export default defineConfig({
  // site: "https://munusshih.com",
  site: "https://munusshih.github.io",
  base: "munusshih.com",
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
