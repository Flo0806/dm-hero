import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import type { H3Event } from 'h3'
import { query, queryOne } from './db'

export interface User {
  id: number
  email: string
  display_name: string
  avatar_url: string | null
  role: 'user' | 'creator' | 'admin'
  email_verified: boolean
  created_at: string
  tos_accepted_version: string | null
  tos_accepted_at: string | null
}

export interface JwtPayload {
  userId: number
  email: string
  role: string
}

const SALT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 30

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateAccessToken(user: User): string {
  const config = useRuntimeConfig()
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

export function verifyAccessToken(token: string): JwtPayload | null {
  const config = useRuntimeConfig()
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch {
    return null
  }
}

export async function generateRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt],
  )

  return token
}

export async function verifyRefreshToken(token: string): Promise<number | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const result = await queryOne<{ user_id: number; expires_at: string; revoked_at: string | null }>(
    'SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?',
    [tokenHash],
  )

  if (!result) return null
  if (result.revoked_at) return null
  if (new Date(result.expires_at) < new Date()) return null

  return result.user_id
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [tokenHash])
}

export async function revokeAllUserTokens(userId: number): Promise<void> {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId])
}

export async function getUserById(id: number): Promise<User | null> {
  return queryOne<User>(
    'SELECT id, email, display_name, avatar_url, role, email_verified, created_at, tos_accepted_version, tos_accepted_at FROM users WHERE id = ?',
    [id],
  )
}

export async function getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  return queryOne<User & { password_hash: string }>(
    'SELECT id, email, password_hash, display_name, avatar_url, role, email_verified, created_at, tos_accepted_version, tos_accepted_at FROM users WHERE email = ?',
    [email],
  )
}

export function getTokenFromHeader(event: H3Event): string | null {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export function setAuthCookies(event: H3Event, accessToken: string, refreshToken: string): void {
  // Access token as httpOnly cookie
  setCookie(event, 'access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  })

  // Refresh token as httpOnly cookie
  setCookie(event, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })
}

export function clearAuthCookies(event: H3Event): void {
  deleteCookie(event, 'access_token', { path: '/' })
  deleteCookie(event, 'refresh_token', { path: '/' })
}

// Note: requireAuth is exported from ./requireAuth.ts
