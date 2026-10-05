# Dependency security review

Reviewed on 2026-10-05.

- Upgraded Next.js from 14.2.5 to 15.5.27 and React to 19.3.0.
- Updated the matching Next.js ESLint configuration and React types.
- Updated transitive dependencies and pinned PostCSS to 8.5.29 through an override because Next.js otherwise installs an affected version.
- Migrated workout detail route parameters to the asynchronous Next.js 15 API.

`npm audit --omit=dev` reports no known vulnerabilities.

The full audit still reports five high-severity entries from one unpatched advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The dependency chain is `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces@3.0.3`. This is development lint tooling, not a production dependency. The advisory lists no patched version. Keep the lint checks, use trusted source paths, and update the chain when a compatible patch becomes available. Do not use `npm audit fix --force`: its suggested downgrade does not preserve the matching framework tooling.
