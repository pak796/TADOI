# Built-in Profiles

## docs-only

Allow:

- `README.md`
- `docs/**`
- `**/*.md`
- `**/*.txt`
- `**/*.adoc`
- `**/*.rst`
- `.github/**`

Deny:

- `src/**`
- `app/**`
- `packages/**`

## tests-only

Allow:

- `tests/**`
- `**/*test*.ts`
- `**/*test*.tsx`
- `**/*.spec.ts`
- `**/*.spec.tsx`

## code-only

Allow:

- `src/**`
- `scripts/**`
- `package.json`
- `tsconfig*.json`
