import { Logger } from '@nestjs/common';
import z from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().max(65535).positive(),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRE_IN: z.coerce.number().int().positive(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  FRONTEND_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  LINE_CHANNEL_ID: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  NOMINATIM_BASE_URL: z.url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z
    .string()
    .trim()
    .min(1)
    .refine((value) => /PAWND/i.test(value), {
      message: 'NOMINATIM_USER_AGENT must identify PAWND',
    })
    .default('PAWND/1.0'),
  NOMINATIM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(10000)
    .default(5000),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().min(1),
  AI_ANALYZE_IMAGE_MODEL: z.string().min(1),
  AI_ANALYZE_IMAGE_MODEL_FREE: z.string().min(1),
  AI_IMAGE_EMBEDDING_MODEL: z.string().min(1),
  AI_IMAGE_EMBEDDING_DIMENSION: z.coerce.number().int().positive(),
  AI_PET_AVATAR_MODEL: z.string().min(1),
});

export function validate(config: Record<string, any>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const logger = new Logger('ENV Validation');
    logger.error('ENV validation fail', z.prettifyError(parsed.error));
    throw new Error('ENV Validation failed');
  }
  return parsed.data;
}

export type EnvVariableType = z.infer<typeof envSchema>;
