import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase Environment Variables are missing in Middleware!');
    // Allow request to proceed (or fail gracefully) instead of crashing entire app
    // Ideally, redirect to an error page or show a friendly message, but for now prevent 500
    return response; 
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options: _options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This will refresh the session if needed
  const { data: { user } } = await supabase.auth.getUser();

  // Protected Routes Logic
  // List of public routes that don't require authentication
  const publicRoutes = ['/', '/pricing', '/login', '/signup', '/auth', '/forgot-password', '/reset-password', '/portal/login', '/verify-bulk', '/api/cron', '/api/health', '/api/razorpay/webhook'];
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/'));

  // If user is NOT signed in and trying to access protected pages, redirect to /login
  if (!user && !isPublicRoute) {
      if (request.nextUrl.pathname.startsWith('/portal')) {
          return NextResponse.redirect(new URL('/portal/login', request.url));
      }
      return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // If user IS signed in and trying to access /login or /signup, redirect to /dashboard
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
      const role = user.user_metadata?.role;

      if (role === 'customer') {
          return NextResponse.redirect(new URL('/portal', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Optimize Dashboard Redirection (Zero Flicker)
  // If an authenticated manager/admin tries to visit the Landing Page ('/'), send them straight to Dashboard
  if (user && request.nextUrl.pathname === '/') {
       const role = user.user_metadata?.role;

       if (role === 'customer') {
           return NextResponse.redirect(new URL('/portal', request.url));
       }
       return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
};
