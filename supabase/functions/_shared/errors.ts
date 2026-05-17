// supabase/functions/_shared/errors.ts
// Shared error serializer for Edge Functions.
//
// WR-05: Postgrest/Supabase errors are plain objects, not Error instances —
// String(err) on them yields a useless "[object Object]". serializeError()
// produces a meaningful string for SERVER-SIDE LOGGING ONLY.
//
// The raw serialized error must NEVER be returned to a guest-facing client:
// it can disclose internal details (table names, constraint names, connection
// errors). Guest-facing 500 handlers should log the detail via serializeError()
// and return a generic message instead.

/** Serialize an unknown thrown value into a meaningful string for server logs. */
export function serializeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown }
    const base = typeof e.message === 'string' ? e.message : JSON.stringify(err)
    return typeof e.code === 'string' ? `${e.code}: ${base}` : base
  }
  return String(err)
}

/** Generic guest-facing 500 message — never leaks internal detail. */
export const GENERIC_500_MESSAGE = 'Внутренняя ошибка сервера'
