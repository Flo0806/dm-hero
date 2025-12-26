# @dm-hero/landing

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
