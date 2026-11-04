import { z } from "zod";

/** The password rules, shared by the reset page and the profile's change-password form. */
export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const PASSWORD_RULES_MESSAGE = "Use 12 to 128 characters, with a lower-case letter, a capital and a number.";
