---
"@dm-hero/app": patch
---

fix: update NPC relation counts when deleting an NPC

When an NPC is deleted, all other NPCs that had relations to it now have their relation counts decremented automatically. This ensures the relation count badges on NPC cards stay accurate without requiring a page refresh.
