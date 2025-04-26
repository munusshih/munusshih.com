import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const work = defineCollection({
  // Load Markdown and MDX files in the `src/content/work/` directory.
  loader: glob({ base: "./src/content/work", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    credit: z.string().optional(),
    excerpt: z.string().optional(),
    recognition: z.array(z.string()).optional(),
    roles: z.array(z.string()),
    tags: z.array(z.string()),
    date: z.string(),
    heroImage: z.string().optional(),
  }),
});


export const collections = { work };
