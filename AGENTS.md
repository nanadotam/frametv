<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Versioning

Two independent semver tracks — see `VERSIONING.md` for the full convention:
- Web app: `package.json` version, `CHANGELOG.md`, `vX.Y.Z` tags.
- Screensaver: `macos-screensaver/*/Info.plist` version, `macos-screensaver/CHANGELOG.md`, `screensaver-vX.Y.Z` tags.

Commit messages use [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `chore:`, etc.) — this is what changelog entries get
written from, so don't skip the prefix.
