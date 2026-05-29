---
"@dm-hero/app": minor
---

feat: climate zones for weather generation — per-campaign zones with temperature + weather-distribution profiles per season, a per-zone weather generator (zone A sunny while zone B rains on the same day), a zone view-switcher in the calendar, and zones drawn as circles on maps (lockable per circle, weather shown in the hover tooltip). Export/import carries zones, profiles, per-zone weather and map circles — fully backwards compatible (older exports import unchanged). Migration runner hardened against the dev double-init race.
