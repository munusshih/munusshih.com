import { z } from "astro/zod";

const projectSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  backlog: z.boolean().default(false),
  tags: z.array(z.string()).min(1),
  description: z.string(),
  credit: z.string().optional(),
  link: z.string().url().optional(),
  linkLabel: z.string().default("View more"),
  links: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .default([]),
  images: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
});

export interface ResearchEntry {
  id: string;
  data: z.infer<typeof projectSchema>;
}

// Load the YAML through Vite so Research doesn't depend on Astro's content cache.
const files = import.meta.glob("../content/research/*.yml", {
  eager: true,
  import: "default",
});

export const researchProjects: ResearchEntry[] = Object.entries(files).map(
  ([filename, source]) => {
    const result = projectSchema.safeParse(source);
    if (!result.success) {
      throw new Error(
        `Invalid Research entry ${filename}: ${result.error.message}`,
      );
    }
    return {
      id: filename.slice("../content/research/".length, -".yml".length),
      data: result.data,
    };
  },
);
