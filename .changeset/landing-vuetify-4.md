---
"@dm-hero/landing": minor
---

chore: upgrade landing page to Vuetify 4 — pinned v3 breakpoint thresholds, migrated MD2→MD3 typography classes across 29 components (matching the app's mapping), and replaced the deprecated `dense` prop with `density`. Custom (unlayered) CSS keeps winning over Vuetify's cascade layers, so the design is preserved. Vuetify stays on 3 only for… nothing — both app and landing are now on Vuetify 4.
