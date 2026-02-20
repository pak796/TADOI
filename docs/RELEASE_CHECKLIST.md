# TADOI™ Release Checklist

Verified as of 2026-02-20 (v0.3.7).

This checklist is required before daily build smoke tests and any tagged release.

## 1) Dependencies
- [ ] `bun install`
- [ ] `bun --version` matches `package.json` requirement

## 2) Quality Gates
- [ ] `bun run test`
- [ ] `bun run typecheck`
- [ ] `bun run brand:check`
- [ ] `bun run contract:dtf:check`
- [ ] `bun run keybind:audit`

## 3) Packaging Validation
- [ ] `bun run pack:dry`
- [ ] `bun run pack:inspect`
- [ ] `bun run pack:smoke`

## 4) Binary + Installer Build
- [ ] `bun scripts/build-binary.ts --target <host> --format raw --mode build`
- [ ] `bun scripts/build-binary.ts --target <host> --format installer --mode build`

## 5) Daily Build Output
- [ ] `bun run build:daily`
- [ ] Verify `dist/artifacts/YYYY-MM-DD/BUILD_REPORT.md` exists
- [ ] Verify artifacts exist for host platform

## 6) Smoke Validation
- [ ] Run `docs/QA/SMOKE_TEST_CHECKLIST.md` on each platform
- [ ] Run TITS command-layer smoke cases (`QA-065`, `QA-066`, `QA-068`, `QA-071`)
- [ ] No P0/P1 defects

## 7) Release Notes
- [ ] Update `CHANGELOG.md` (root) or `docs/RELEASE_NOTES.md`
- [ ] Record any behavior changes to mode boundaries or recurrence

## 8) Final Review
- [ ] Ensure docs and QA guides match current behavior
- [ ] Confirm no unrelated feature work is bundled
