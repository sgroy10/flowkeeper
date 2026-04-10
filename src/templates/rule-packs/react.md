# React Rule Pack

Curated SpecLock constraints for generic React projects (hooks, state, components).
These rules are enforced by SpecLock — do not remove without a migration plan.

## Rules

- NEVER mutate state directly — always use the setter returned by `useState` or reducers from `useReducer`.
- NEVER call hooks conditionally or inside loops — hooks must run in the same order on every render.
- ALWAYS include every reactive dependency in `useEffect`, `useMemo`, and `useCallback` dependency arrays.
- NEVER use array indexes as `key` props for dynamic lists — use a stable unique id.
- ALWAYS wrap expensive computations in `useMemo` and stable callbacks in `useCallback` only when profiling proves the need.
- NEVER fetch data inside render — use `useEffect`, a data-fetching library (React Query, SWR), or a framework loader.
- ALWAYS handle loading, error, and empty states explicitly in every async UI path.
- NEVER leak event listeners, timers, or subscriptions — always return a cleanup function from `useEffect`.
- ALWAYS prefer composition over inheritance — use hooks and component composition instead of class hierarchies.
- NEVER use `dangerouslySetInnerHTML` without sanitizing input first with DOMPurify or equivalent.
- ALWAYS type props and state with TypeScript (or `prop-types` for JS projects) and enable `strict` mode.
- NEVER store derived state in `useState` — compute it during render so it stays in sync.
- ALWAYS lift state to the lowest common ancestor that needs it — avoid global state for local concerns.
- NEVER ship `console.log` or `debugger` statements to production builds.
- ALWAYS wrap route-level components in error boundaries so one crash does not blank the whole app.
