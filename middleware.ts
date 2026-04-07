import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limiter (per IP, per bucket)
const rateMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > max
}

// Block obvious automated tools and scrapers
const BOT_UA_BLOCKLIST = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /python-requests/i,
  /scrapy/i,
  /\bhttrack\b/i,
  /\blibwww-perl\b/i,
  /\bgo-http-client\b/i,
  /\bJava\/\d/,
]

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

// Allowed origins for CORS — comma-separated list in ALLOWED_ORIGINS env var.
// Falls back to blocking all cross-origin API requests when unset.
function getAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS ?? ''
  return new Set(raw.split(',').map((o) => o.trim()).filter(Boolean))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getIP(request)

  // Handle CORS preflight (OPTIONS) for API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const allowedOrigins = getAllowedOrigins()
    const origin = request.headers.get('origin') ?? ''
    if (allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
      return new NextResponse(null, { status: 204 })
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Login endpoint: rate-limit aggressively to block brute force, then pass through
  if (pathname === '/api/auth/login') {
    if (isRateLimited(`login:${ip}`, 5, 60_000)) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    }
    return NextResponse.next()
  }

  // Other auth endpoints and the login page don't need auth
  if (pathname.startsWith('/api/auth/') || pathname === '/login') {
    return NextResponse.next()
  }

  // Block bot User-Agents before doing anything else
  const ua = request.headers.get('user-agent') ?? ''
  if (!ua || BOT_UA_BLOCKLIST.some((p) => p.test(ua))) {
    console.log('[middleware] Blocked by UA check — ua:', ua)
    return new NextResponse('Forbidden', { status: 403 })
  }

  // General rate limiting
  const isApi = pathname.startsWith('/api/')
  const limit = isApi ? 30 : 60
  if (isRateLimited(`${isApi ? 'api' : 'page'}:${ip}`, limit, 60_000)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  // CORS: reject cross-origin API requests from unlisted origins
  if (isApi) {
    const origin = request.headers.get('origin')
    if (origin) {
      const allowedOrigins = getAllowedOrigins()
      console.log('[middleware] CORS check — origin:', origin, '| allowedOrigins:', [...allowedOrigins], '| raw env:', process.env.ALLOWED_ORIGINS)
      if (allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }
  }

  // Session validation
  const session = request.cookies.get('session')?.value
  const validToken = process.env.SESSION_TOKEN ?? ''

  if (!validToken || session !== validToken) {
    if (isApi) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
