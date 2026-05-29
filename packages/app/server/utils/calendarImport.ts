/**
 * Whether an export's calendar is real enough to import.
 *
 * An export can carry an "empty" calendar: a default `calendar_config` row but
 * zero months (export.post.ts writes `calendar` when config OR months exist).
 * Importing that would DELETE the target campaign's calendar and insert nothing
 * back — silent data loss on merge. So both the calendar conflict-detection and
 * the calendar import treat only a calendar WITH months as importable. (#297)
 */
export function hasImportableCalendar(
  calendar?: { months?: unknown[] } | null,
): boolean {
  return !!(calendar && Array.isArray(calendar.months) && calendar.months.length > 0)
}
