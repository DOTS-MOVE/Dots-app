import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const hash = requestUrl.hash; // Check URL hash for access_token (password recovery)
  
  // If there's a hash with access_token and type=recovery, redirect to reset password page
  // Supabase password recovery emails include the token in the URL hash
  if (hash && hash.includes('access_token') && hash.includes('type=recovery')) {
    // Redirect to reset password page with the hash
    return NextResponse.redirect(new URL(`/reset-password${hash}`, requestUrl.origin));
  }
  
  // Handle email confirmation codes
  if (code && type === 'recovery') {
    // Password recovery with code - redirect to reset password page
    return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
  }
  
  const next = requestUrl.searchParams.get('next') || '/login';
  
  // Redirect to login page - user can sign in after email confirmation
  // The supabase client with detectSessionInUrl: true will handle the token
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
