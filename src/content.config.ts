import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    /** Shorter title for search results and browser tabs, when the headline runs long. */
    seoTitle: z.string().optional(),
    description: z.string(),
    order: z.number(),
  }),
});

export const collections = { blog };
