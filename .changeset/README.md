# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for changelog generation.

**IMPORTANT**: Versions are managed MANUALLY because we use alpha/beta pre-releases.

## Workflow

### 1. Creating a Changeset

When you make changes that should be released, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages changed (`@dm-hero/app`, `@dm-hero/landing`, or both)
2. Choose the bump type (patch, minor, major) - this is just for changelog formatting
3. Write a summary of your changes

A new file will be created in `.changeset/` - commit this with your changes.

### 2. Version PR

When changesets are pushed to `main`, GitHub Actions will create a "Release Updates" PR.

**Before merging this PR, you MUST manually update the version in `package.json`:**

```bash
# For @dm-hero/app (currently alpha)
# 1.0.0-alpha.7 → 1.0.0-alpha.8

# For @dm-hero/landing (currently beta)
# 1.0.0-beta.1 → 1.0.0-beta.2
```

### 3. Release

When the Version PR is merged (with updated versions):
- Docker images are built and pushed to ghcr.io
- GitHub Releases are created
- Electron binaries are built (for @dm-hero/app)

## Version Scheme

- `@dm-hero/app`: `1.0.0-alpha.X` (pre-release, major features still in development)
- `@dm-hero/landing`: `1.0.0-beta.X` (feature-complete, testing phase)

When ready for stable release, change to `1.0.0`, `1.0.1`, etc.

## Packages

- `@dm-hero/app` - Main Nuxt application (Web + Electron)
- `@dm-hero/landing` - Landing page (Static site)
