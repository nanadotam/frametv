# Versioning

Two independent version tracks, since the web app and the macOS screensaver
ship on different cadences:

| | Web app | Screensaver |
|---|---|---|
| Version lives in | `package.json` `"version"` | `Info.plist` `CFBundleShortVersionString` (both `FrameTVScreenSaver` and `FrameTVScreenSaverRig` targets) |
| Changelog | `CHANGELOG.md` (repo root) | `macos-screensaver/CHANGELOG.md` |
| Git tag | `vX.Y.Z` | `screensaver-vX.Y.Z` |
| Release trigger | tag push (no packaging step yet — Vercel deploys `main` continuously; the tag is a marker, not a build trigger) | tag push → `.github/workflows/screensaver-release.yml` builds + publishes the `.dmg` |

Both follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **PATCH**: bug fixes, no behavior change for existing users.
- **MINOR**: new feature, backward compatible.
- **MAJOR**: breaking change (e.g. a migration that isn't backward
  compatible, a removed mode, a screensaver config format change).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <summary>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`,
`chore`. Prefix with the area when it's not obvious from context, e.g.
`fix(screensaver): ...` vs `fix(admin): ...`. This is what CHANGELOG
entries get written from — a commit that doesn't say what changed and why
makes writing the changelog entry guesswork later.

## Cutting a release

1. Move the relevant `[Unreleased]` entries in the changelog into a new
   `## [X.Y.Z] - YYYY-MM-DD` section.
2. Bump the version field (`package.json` or both `Info.plist`s).
3. Commit: `chore(release): vX.Y.Z` or `chore(release): screensaver-vX.Y.Z`.
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z` (or the
   `screensaver-` equivalent).
