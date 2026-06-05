import { z } from "zod";

// Plain domain like "acme.com" or "sub.acme.co.uk" — no @, no protocol, no path
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address (e.g. you@company.com)")
  .max(255, "Email must be 255 characters or fewer");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(72, "Password must be 72 characters or fewer");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be 80 characters or fewer");

export const companyNameSchema = z
  .string()
  .trim()
  .min(2, "Company name must be at least 2 characters")
  .max(80, "Company name must be 80 characters or fewer");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(40, "Slug must be 40 characters or fewer")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers and dashes only (e.g. acme-corp)",
  );

export const joinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, "Join code looks too short")
  .max(20, "Join code looks too long")
  .regex(/^[A-Z0-9-]+$/, "Join code can only contain letters, numbers and dashes");

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    DOMAIN_RE,
    "Enter just the domain, e.g. acme.com — no @ symbol, no https://",
  );

export const optionalDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || DOMAIN_RE.test(v), {
    message: "Enter just the domain, e.g. acme.com — no @ symbol, no https://",
  });

/** Map raw Supabase auth errors to user-friendly text. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address before signing in. Check your inbox.";
  if (m.includes("user already registered") || m.includes("already exists"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password should be at least"))
    return "Password is too short. Use at least 6 characters.";
  if (
    /personal email/i.test(message) ||
    /corporate email/i.test(message) ||
    /Database error saving new user/i.test(message)
  )
    return "Please use your organization email (e.g. you@yourcompany.com). Personal email providers are not allowed.";
  return message || "Something went wrong. Please try again.";
}

/** Map common backend RPC errors (join/create company, log activity) to friendlier text. */
export function friendlyRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid join code") || m.includes("no rows") || m.includes("not found"))
    return "That join code isn't valid. Double-check it with your company admin.";
  if (m.includes("already a member") || m.includes("duplicate key"))
    return "You're already a member of a company. Leave your current one first.";
  if (m.includes("email domain") || m.includes("allowed_email_domain"))
    return "Your email domain isn't allowed for this company.";
  if (m.includes("slug") && m.includes("unique"))
    return "That public slug is already taken. Try a different one.";
  if (m.includes("permission denied") || m.includes("rls"))
    return "You don't have permission to do that.";
  return message || "Something went wrong. Please try again.";
}
