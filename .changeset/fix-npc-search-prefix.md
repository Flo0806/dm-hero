---
"@dm-hero/app": patch
---

fix: NPC search no longer drops the typed term when it fuzzily matches a race/class (#313). A 5-character query like "Baldu" fuzzily matched the class "barde" (Levenshtein 2) and replaced the search, so the NPC "Balduwan" was never found. Race/class/type expansion now ADDS its variants alongside the literal term prefix instead of replacing it, so name prefix matches always survive.
