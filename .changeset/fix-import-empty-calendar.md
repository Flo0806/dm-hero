---
"@dm-hero/app": patch
---

fix: merge-import no longer wipes the target campaign's calendar when the import file carries an "empty" calendar (a default config row but zero months). Both the conflict check and the import step now share one guard (`hasImportableCalendar`), so a calendar is only deleted/replaced when the import actually has months. (#297)
