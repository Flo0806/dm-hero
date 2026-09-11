---
"@dm-hero/app": patch
---

Bug fixes reported via Discord:

- Duplicate German location type labels ("Ebene", "Friedhof") in the type dropdown
- Dashboard calendar widget always showed "sunny" instead of the active climate zone's weather
- Weather generation now only generates for the selected climate zone (or global) instead of overwriting all zones
- Clicking a linked entity in the calendar led to a 404 page
- New stat template fields got duplicate default names and overwrote each other
