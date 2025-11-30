# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

## Workflow

### 1. Creating a Changeset

When you make changes that should be released, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages changed (`@dm-hero/app`, `@dm-hero/landing`, or both)
2. Choose the bump type (patch, minor, major)
3. Write a summary of your changes

A new file will be created in `.changeset/` - commit this with your changes.

### 2. Version PR

When changesets are pushed to `main`, GitHub Actions will automatically create a "Version Packages" PR that:
- Bumps package versions
- Updates CHANGELOG.md files
- Removes the changeset files

### 3. Release

When the Version PR is merged:
- Docker images are built and pushed to ghcr.io
- GitHub Releases are created
- Electron binaries are built (for @dm-hero/app)

## Packages

- `@dm-hero/app` - Main Nuxt application (Web + Electron)
- `@dm-hero/landing` - Landing page (Static site)
