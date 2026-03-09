import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    const appPassword = process.env.APP_PASSWORD

    if (!appPassword) {
      return NextResponse.json({ error: 'APP_PASSWORD not configured' }, { status: 500 })
    }

    if (password !== appPassword) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }

    // Generate a signed token
    const token = await hmacSha256(appPassword, 'stockvision-auth')

    // Set httpOnly cookie
    const cookieStore = cookies()
    cookieStore.set('sv-auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 500 })
  }
}

// Logout
export async function DELETE() {
  const cookieStore = cookies()
  cookieStore.delete('sv-auth')
  return NextResponse.json({ success: true })
}
