import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  username: z.string().max(100).optional(),
  fullName: z.string().max(255).optional(),
  companyId: z.string().uuid('Invalid company ID format'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  companyId: z.string().uuid('Invalid company ID format'),
});
