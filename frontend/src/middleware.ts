import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware only handles path rewrites, auth is handled client-side
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
