// supabase/functions/_shared/jwt.ts
// Shared guest JWT sign + verify helpers (HS256, 1h TTL).
// Source: [VERIFIED: docs.deno.com/examples/creating_and_verifying_jwt/]
// Pattern 2 from RESEARCH.md — uses GUEST_JWT_SECRET (not SUPABASE_JWT_SECRET)
// to decouple from Supabase's key rotation (Pitfall 5).

import { SignJWT, jwtVerify } from 'npm:jose@5'

export interface GuestTokenPayload {
  quiz_access_id: string
  quiz_id: string
  iat: number
  exp: number
}

function getSecret(): Uint8Array {
  const secret = Deno.env.get('GUEST_JWT_SECRET')
  if (!secret) throw new Error('GUEST_JWT_SECRET not set')
  return new TextEncoder().encode(secret)
}

export async function signGuestToken(
  payload: Omit<GuestTokenPayload, 'iat' | 'exp'>,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSecret())
}

export async function verifyGuestToken(token: string): Promise<GuestTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as GuestTokenPayload
  } catch {
    // Returns null on any error: expired, tampered, empty string, wrong secret
    return null
  }
}
