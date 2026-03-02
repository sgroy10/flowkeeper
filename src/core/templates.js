// SpecLock Constraint Templates — Pre-built lock packs for common frameworks

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
};

export function getTemplateNames() {
  return Object.keys(TEMPLATES);
}

export function getTemplate(name) {
  return TEMPLATES[name] || null;
}
