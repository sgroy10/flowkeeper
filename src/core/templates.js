// SpecLock Constraint Templates — Pre-built lock packs for common frameworks
// Developed by Sandeep Roy (https://github.com/sgroy10)

export const TEMPLATES = {
  nextjs: {
    name: "nextjs",
    displayName: "Next.js",
    description: "Constraints for Next.js applications — protects routing, API routes, and middleware",
    locks: [
      "Never modify the authentication system without explicit permission",
      "Never change the Next.js routing structure (app/ or pages/ directory layout)",
      "API routes must not expose internal server logic to the client",
      "Middleware must not be modified without review",
      "Environment variables must not be hardcoded in source files",
    ],
    decisions: [
      "Framework: Next.js (App Router or Pages Router as configured)",
      "Server components are the default; client components require 'use client' directive",
    ],
  },

  react: {
    name: "react",
    displayName: "React",
    description: "Constraints for React applications — protects state management, component architecture",
    locks: [
      "Never modify the authentication system without explicit permission",
      "Global state management pattern must not change without review",
      "Component prop interfaces must maintain backward compatibility",
      "Shared utility functions must not have breaking changes",
      "Environment variables must not be hardcoded in source files",
    ],
    decisions: [
      "Framework: React with functional components and hooks",
      "Styling approach must remain consistent across the project",
    ],
  },

  express: {
    name: "express",
    displayName: "Express.js API",
    description: "Constraints for Express.js backends — protects middleware, routes, and database layer",
    locks: [
      "Never modify authentication or authorization middleware without explicit permission",
      "Database connection configuration must not change without review",
      "No breaking changes to public API endpoints",
      "Rate limiting and security middleware must not be disabled",
      "Environment variables and secrets must not be hardcoded",
    ],
    decisions: [
      "Backend: Express.js with REST API pattern",
      "Error handling follows centralized middleware pattern",
    ],
  },

  supabase: {
    name: "supabase",
    displayName: "Supabase",
    description: "Constraints for Supabase projects — protects auth, RLS policies, and database schema",
    locks: [
      "Database must always be Supabase — never switch to another provider",
      "Row Level Security (RLS) policies must not be disabled or weakened",
      "Supabase auth configuration must not change without explicit permission",
      "Database schema migrations must not drop tables or columns without review",
      "Supabase client initialization must not be modified",
    ],
    decisions: [
      "Database and auth provider: Supabase",
      "All database access must go through Supabase client (no direct SQL in application code)",
    ],
  },

  stripe: {
    name: "stripe",
    displayName: "Stripe Payments",
    description: "Constraints for Stripe integration — protects payment logic, webhooks, and pricing",
    locks: [
      "Payment processing logic must not be modified without explicit permission",
      "Stripe webhook handlers must not change without review",
      "Pricing and subscription tier definitions must not change without permission",
      "Stripe API keys must never be hardcoded or exposed to the client",
      "Payment error handling must not be weakened or removed",
    ],
    decisions: [
      "Payment provider: Stripe",
      "All payment operations must be server-side only",
    ],
  },

  "security-hardened": {
    name: "security-hardened",
    displayName: "Security Hardened",
    description: "Strict security constraints — protects auth, secrets, CORS, input validation",
    locks: [
      "Never modify authentication or authorization without explicit permission",
      "No secrets, API keys, or credentials in source code",
      "CORS configuration must not be loosened without review",
      "Input validation must not be weakened or bypassed",
      "Security headers and CSP must not be removed or weakened",
      "Dependencies must not be downgraded without security review",
    ],
    decisions: [
      "Security-first development: all inputs validated, all outputs encoded",
      "Authentication changes require explicit user approval",
    ],
  },

  "safe-defaults": {
    name: "safe-defaults",
    displayName: "Safe Defaults (Vibe Coding Seatbelt)",
    description: "Prevents the 5 most common AI disasters — database deletion, auth removal, secret exposure, error handling removal, logging disablement",
    locks: [
      "Never delete database tables, columns, or user records — migrations must only add or modify, never drop",
      "Never remove or bypass authentication or authorization — login, signup, session management, and access control are sacred",
      "Never expose API keys, secrets, passwords, or credentials in client-side code, logs, or error messages",
      "Never remove error handling, try-catch blocks, or validation logic — these exist for a reason",
      "Never disable logging, monitoring, or audit trails — observability keeps production alive",
    ],
    decisions: [
      "Safety-first: AI must ask before destructive operations",
      "All database changes must be additive, not destructive",
    ],
  },

  hipaa: {
    name: "hipaa",
    displayName: "HIPAA Healthcare",
    description: "8 constraints for HIPAA-compliant healthcare applications — protects PHI, encryption, audit trails",
    locks: [
      "Protected Health Information (PHI) must never be logged, exposed in error messages, or sent to third-party services",
      "All PHI must be encrypted at rest (AES-256) and in transit (TLS 1.2+) — never store PHI in plaintext",
      "Authentication must use MFA — never disable or downgrade multi-factor authentication",
      "Audit logging must capture all access to patient records — never disable audit trails",
      "Patient data must never be deleted without explicit compliance review — soft-delete only",
      "FHIR API endpoints must not have breaking changes — healthcare integrations depend on stability",
      "Session timeout must not exceed 15 minutes of inactivity — never increase or disable session expiry",
      "Role-based access control must be enforced on all patient data endpoints — never bypass RBAC",
    ],
    decisions: [
      "HIPAA compliance is mandatory — all features must pass compliance review",
      "PHI storage uses encrypted-at-rest database with per-row access logging",
    ],
  },

  "api-stability": {
    name: "api-stability",
    displayName: "API Stability",
    description: "6 constraints for public API projects — protects endpoints, response shapes, versioning",
    locks: [
      "Never remove or rename existing API endpoints — deprecated endpoints must continue to work",
      "Never change the shape of API response objects — adding fields is OK, removing or renaming breaks clients",
      "Never change HTTP status codes for existing endpoints — clients depend on specific codes",
      "API versioning must be maintained — never merge v2 changes into v1 endpoints",
      "Rate limiting and authentication on API endpoints must not be removed or weakened",
      "Database schema changes must not break existing API contracts — migrations must be backward-compatible",
    ],
    decisions: [
      "API follows semantic versioning — breaking changes require a new API version",
      "All API changes must be backward-compatible within the same version",
    ],
  },

  "solo-founder": {
    name: "solo-founder",
    displayName: "Solo Founder",
    description: "3 essential constraints for solo builders — protects the things that cost you the most time to fix",
    locks: [
      "Never delete or drop database tables, user data, or production records — my users' data is sacred",
      "Never modify the payment or billing system without explicit permission — revenue is life",
      "Never remove authentication, session management, or access control — security is non-negotiable",
    ],
    decisions: [
      "Ship fast but never break auth, payments, or user data",
    ],
  },
};

export function getTemplateNames() {
  return Object.keys(TEMPLATES);
}

export function getTemplate(name) {
  return TEMPLATES[name] || null;
}
