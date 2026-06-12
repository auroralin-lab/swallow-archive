import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'swallow_session'
const PUBLIC_PATHS = ['/login']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ARCHIVE_PASSWORD 未設時必須鎖死（fail-closed）：否則 undefined === undefined
  // 會讓漏設環境變數的環境整站（含全部報告 JSON）無聲公開
  const session = request.cookies.get(SESSION_COOKIE)?.value
  if (process.env.ARCHIVE_PASSWORD && session === process.env.ARCHIVE_PASSWORD) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
