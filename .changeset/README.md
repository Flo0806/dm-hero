# Changesets

This folder manages versioning and changelogs for the DM Hero monorepo.

## Usage

### Creating a Changeset

After making changes, create a changeset:

```bash
pnpm changeset
```

Select the affected package(s) and describe your changes.

### Releasing

When changesets are merged to main, run:

```bash
pnpm changeset:version
```

This updates versions and CHANGELOG.md files. Commit and push to trigger the release workflow.

## Packages

- **@dm-hero/app** - Main desktop/web application
- **@dm-hero/landing** - Landing page (dm-hero.com)

## Documentation

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Common Questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)
