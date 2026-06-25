import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=MissingCode', request.url));
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    
    // Exchange code for JWT with backend
    const response = await fetch(`${backendUrl}/api/auth/callback/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, provider: 'github' }),
    });

    if (!response.ok) {
      console.error('Backend OAuth callback failed:', await response.text());
      return NextResponse.redirect(new URL('/login?error=OAuthFailed', request.url));
    }

    const data = await response.json();
    const token = data.access_token;

    // Redirect to dashboard with token set as a cookie
    const redirectUrl = new URL('/dashboard', request.url);
    const res = NextResponse.redirect(redirectUrl);
    
    // Set cookie
    res.cookies.set({
      name: 'neuralforge_token',
      value: token,
      httpOnly: false,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return res;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=ServerException', request.url));
  }
}
