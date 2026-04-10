# Next.js Rule Pack

Curated SpecLock constraints for Next.js 13+ (App Router, Server Components, TypeScript).
These rules are enforced by SpecLock — do not remove without a migration plan.

## Rules

- NEVER use `getServerSideProps` for static pages — use `getStaticProps` or `generateStaticParams`.
- NEVER expose API keys or secrets to Client Components — keep them in Server Components or route handlers.
- NEVER use `dangerouslySetInnerHTML` without sanitizing input through DOMPurify or a vetted sanitizer.
- ALWAYS validate environment variables at startup in a typed `env.ts` (e.g. using zod or `@t3-oss/env-nextjs`).
- NEVER mutate React state directly — always use the setter returned from `useState` or `useReducer`.
- ALWAYS handle loading and error states in async Server Components with `loading.tsx` and `error.tsx`.
- NEVER bundle large dependencies (moment, lodash full build, charting libs) into Client Components — lazy-load with `next/dynamic`.
- NEVER use the `any` type in TypeScript — define proper interfaces and enable `strict: true` in tsconfig.
- ALWAYS use `next/image` instead of raw `<img>` tags for automatic optimization, lazy loading, and CLS prevention.
- NEVER hardcode database URLs, connection strings, or secrets in source files — read from `process.env`.
- ALWAYS default to Server Components; opt into Client Components only when you need browser APIs, state, or effects.
- NEVER ship `console.log`, `console.debug`, or `debugger` statements to production builds.
- NEVER skip middleware authentication checks on protected routes — centralize auth in `middleware.ts`.
- ALWAYS colocate route-specific code under `app/` and shared code under `lib/` or `components/`.
- NEVER call `fetch` without explicit `cache` or `next.revalidate` options on Server Components — be intentional about caching.
