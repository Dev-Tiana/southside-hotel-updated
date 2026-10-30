import { z } from "zod";

export const categoryImage = z.object({
  url: z.string().max(255).regex(/^\/(?:manus-storage|hotel-media)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif)$/i, "Use an existing local hotel image path (PNG, JPEG, WebP or AVIF).")
    .refine(value => !value.includes("..") && !value.includes("//"), "Use a safe local hotel image path."),
  alt: z.string().trim().min(2).max(250),
});
export const categoryDetails = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(10000),
  maxOccupancy: z.number().int().min(1).max(100),
  bedConfiguration: z.string().trim().max(1000),
  amenities: z.array(z.string().trim().min(1).max(160)).max(40),
  verification: z.enum(["verified", "provisional", "awaiting approval"]),
  images: z.array(categoryImage).max(8),
});
export const categoryCreate = categoryDetails.extend({
  slug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by single hyphens."),
  reason: z.string().trim().min(5).max(2000),
});
export const categorySave = categoryDetails.extend({
  categoryId: z.number().int().positive(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  isActive: z.boolean(), reason: z.string().trim().min(5).max(2000),
});
export const categoryInventory = z.object({
  categoryId: z.number().int().positive(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  sellableInventory: z.number().int().min(0).max(10000),
  reviewedCancellationIds: z.array(z.number().int().positive()).max(10000),
  reconciliationAccepted: z.literal(true), reason: z.string().trim().min(5).max(2000),
});
export type CategoryDetails = z.infer<typeof categoryDetails>;
