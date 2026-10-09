// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwindcss from "@tailwindcss/vite";
import yaml from "@rollup/plugin-yaml";

import vercel from "@astrojs/vercel";
import { CANONICAL_ORIGIN, canonicalUrl, isIndexablePath } from "./src/utils/seo.js";

// https://astro.build/config
export default defineConfig({
  site: CANONICAL_ORIGIN,
  trailingSlash: "never",
  output: "static",
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
  }),
  devToolbar: {
    enabled: false,
  },
  integrations: [mdx(), sitemap({
    filter: (url) => isIndexablePath(new URL(url).pathname),
    serialize: (item) => ({ ...item, url: canonicalUrl(new URL(item.url).pathname) }),
  })],
  vite: {
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },

    plugins: [tailwindcss(), yaml()],
  },
});
