# @dm-hero/landing

## 1.6.0

### Minor Changes

- 7921736: docs + banner: document the 1.4 "The Summoning" features on the landing page — Connect Your AI (MCP), climate zones, folders, tags, the 8-theme overhaul with per-theme dashboard ambience and release codenames (EN + DE docs), and surface the four biggest new features in the rotating homepage highlights banner.
- d1de91a: feat: landing page 1.4 glow-up — a cinematic hero (a sword × axe clash with sparks on load, the DM Hero logo "forged" right after, a vivid animated colour aurora in the theme palette), punchier conversion-focused copy (AI framed as an optional helper, never the headline), a colour-cycling "Themes" slide in the highlights banner, four new feature cards (Connect Your AI, Folders, Tags, Climate Zones), and a batch of mobile fixes (compact Discord bar, wrapped highlight text clear of the arrows, weapons raised to the logo).
- d1de91a: chore: upgrade landing page to Vuetify 4 — pinned v3 breakpoint thresholds, migrated MD2→MD3 typography classes across 29 components (matching the app's mapping), and replaced the deprecated `dense` prop with `density`. Custom (unlayered) CSS keeps winning over Vuetify's cascade layers, so the design is preserved. Vuetify stays on 3 only for… nothing — both app and landing are now on Vuetify 4.

## 1.5.2

### Patch Changes

- 6d8b5c0: chore: upgrade archiver to 8 (esm-only release, switched to named `ZipArchive` export)
- 40efe42: fix: drop pnpm version pin from ci workflows so it no longer conflicts with the packageManager field
- 1685eb2: chore: update dependencies across the monorepo, upgrade electron from 39 to 41, pin node 24 and pnpm 10.34

## 1.5.1

### Patch Changes

- f2e5d2d: Fix SEO indexing issues: replace hardcoded global canonical with dynamic per-page canonical, add noindex to auth and user pages

## 1.5.0

### Minor Changes

- 8306456: SEO optimization: sitemap, og:image, Twitter Cards, llms.txt, robots.txt, keyword-optimized meta tags

## 1.4.0

### Minor Changes

- ea20374: Update landing page with v1.3 features, highlights banner and docs

## 1.3.0

### Minor Changes

- b18414f: feat: macOS downloads, Discord community link, GitHub star CTA
  - Enable macOS download section with split button (Apple Silicon / Intel)
  - Add tooltips explaining M1/M2/M3 vs older Intel chips
  - Replace auto-update hint with Discord community invitation
  - Add GitHub star call-to-action section
  - Update entity count from 7+ to 8+

## 1.2.0

### Minor Changes

- 0b23c46: Add Discord banner and footer link for community engagement

### Patch Changes

- 0b23c46: fix: uploads API route + favorites endpoint + migration idempotency + download ZIP corruption

## 1.1.7

### Patch Changes

- 2d60b3b: fix: uploads API route + favorites endpoint + migration idempotency + download ZIP corruption

## 1.1.6

### Patch Changes

- 0805637: fix: uploads API route missing from git + consistent cover filename

## 1.1.5

### Patch Changes

- [`74e758c`](https://github.com/Flo0806/dm-hero/commit/74e758c1cb7340ed408d06ce31dedc21f3751498) Thanks [@Flo0806](https://github.com/Flo0806)! - Prefer .exe installer for Windows downloads and add auto-update info hint

## 1.1.4

### Patch Changes

- [#153](https://github.com/Flo0806/dm-hero/pull/153) [`3c1a683`](https://github.com/Flo0806/dm-hero/commit/3c1a683fed84313c4c9065a822947da523a2c435) Thanks [@Flo0806](https://github.com/Flo0806)! - fix: draft versioning logic with unpublish/republish support

## 1.1.3

### Patch Changes

- [#149](https://github.com/Flo0806/dm-hero/pull/149) [`a789693`](https://github.com/Flo0806/dm-hero/commit/a789693863cb5e16f6bea9855465420edb214352) Thanks [@Flo0806](https://github.com/Flo0806)! - fix: remove import.meta.prerender from migrations check (compile-time constant breaks runtime)

## 1.1.2

### Patch Changes

- [#147](https://github.com/Flo0806/dm-hero/pull/147) [`c7b3f41`](https://github.com/Flo0806/dm-hero/commit/c7b3f413ab3f867aa8b4539466bb5234a890843d) Thanks [@Flo0806](https://github.com/Flo0806)! - fix: Dockerfile now uses Node.js server instead of nginx for SSR support, skip plugins during prerender

## 1.0.0

### Major Changes

- [#127](https://github.com/Flo0806/dm-hero/pull/127) [`53b93dc`](https://github.com/Flo0806/dm-hero/commit/53b93dcbbabda55173432bfeac6d00d66273df13) Thanks [@Flo0806](https://github.com/Flo0806)! - Release Landing Page v1.0.0
  - Add Testimonials section with 3D carousel effect
  - Add Imprint (Impressum) page with full i18n support
  - Add Privacy Policy (Datenschutzerklärung) page with full i18n support
  - Add Privacy Info Banner (no cookies, no tracking - transparent info)
  - Add legal links in footer
  - Fix NavBar logo link to properly navigate back from legal pages
  - Update hosting information for IONOS V-Server

## 1.0.0-alpha.8

### Patch Changes

- [`407881e`](https://github.com/Flo0806/dm-hero/commit/407881e557fa61b99a62392f3e05e9852c2db103) Thanks [@Flo0806](https://github.com/Flo0806)! - fix(landing): fix MDI icons visibility in Chrome, optimize screenshot loading
  - Fix hero stats icons not showing in Chrome (gradient-text CSS incompatibility)
  - Use gold color (#ffd700) for stat icons that matches gradient text
  - Replace dynamic screenshot detection (99 HEAD requests) with static file paths
  - Add vuetify/styles import to plugin for proper styling

## 1.0.0-alpha.7

### Patch Changes

- [`f8a248e`](https://github.com/Flo0806/dm-hero/commit/f8a248eb853012ffc0f7c08bdeb75b5771bb42dd) Thanks [@Flo0806](https://github.com/Flo0806)! - Fix MDI icons in production build, add Powered by Nuxt badge
  - Fix MDI icons not rendering in static build
  - Add icon set configuration to Vuetify plugin
  - Add "Powered by Nuxt" badge with official logo in footer

## 1.0.0-alpha.6

### Patch Changes

- [`5246de2`](https://github.com/Flo0806/dm-hero/commit/5246de261644323eff07e994b5edb36d9e44d57b) Thanks [@Flo0806](https://github.com/Flo0806)! - Add feedback section, screenshots gallery, and mobile fixes
  - Add FeedbackSection linking to GitHub Discussions
  - Add screenshot auto-detection (finds highest numbered version)
  - Fix mobile padding on docs pages
  - Add particle animation to docs pages

## 1.0.0-alpha.5

### Minor Changes

- [`8505772`](https://github.com/Flo0806/dm-hero/commit/8505772a3a2ec1ffaf707bb9811ebeaf71b02794) Thanks [@Flo0806](https://github.com/Flo0806)! - feat: add Buy Me a Coffee support integration
  - Add SupportSection with official BMC button
  - Add BMC button to navbar (desktop + mobile)
  - Add particle animation to docs pages
  - Add detailed explanations for non-tech users (EN/DE)

## 1.0.0-alpha.4

### Minor Changes

- [#79](https://github.com/Flo0806/dm-hero/pull/79) [`3f8f188`](https://github.com/Flo0806/dm-hero/commit/3f8f188ea68d475f3acefe1d44be6a512ccc748d) Thanks [@Flo0806](https://github.com/Flo0806)! - feat(docs): add comprehensive documentation section
  - Add documentation pages with Nuxt Content
  - Include Getting Started, Features, and Entities guides
  - Support both German and English locales
  - Filter docs by current locale
  - Add DM Hero logo
  - Simplify content configuration

## 1.0.0-alpha.3

### Patch Changes

- [`ec177f1`](https://github.com/Flo0806/dm-hero/commit/ec177f12c7cc63251b88f7f8906376b3960a94d3) Thanks [@Flo0806](https://github.com/Flo0806)! - Switch Windows build from NSIS installer to ZIP archive for better compatibility

## 1.0.0-beta.1

### Features

- Initial landing page release
- Hero section with animated background
- Feature showcase with 8 key features
- Screenshots gallery (placeholders)
- Download section with GitHub API integration
- Footer with links and tech stack
- i18n support (German + English)
- Dark theme with DM Hero branding
- Responsive design
- Docker support for deployment
