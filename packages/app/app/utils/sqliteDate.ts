// SQLite CURRENT_TIMESTAMP is UTC without a zone ("2026-10-04 12:00:00") - read it as UTC
export const parseSqliteDate = (value: string) => new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
