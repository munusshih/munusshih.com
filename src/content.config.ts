import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const work = defineCollection({
  // Load Markdown and MDX files in the `src/content/work/` directory.
  loader: glob({ base: "./src/content/work", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    buttons: z.array(z.array(z.string())).optional(),
    credit: z.string().optional(),
    excerpt: z.string().optional(),
    recognition: z.array(z.string()).optional(),
    archived: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    heroImage: z.string().optional(),
    images: z.array(z.string()).optional(),
  }),
});


export const collections = { work };
