import { NextResponse, type NextRequest } from 'next/server';
function decode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let target: string | undefined;
  const oldPost = path.match(/^\/(?:index\.php\/)?archives\/(\d+)(?:\.html)?\/?$/);
  if (oldPost) target = `/posts/${oldPost[1]}`;
  else if (/^\/(?:index\.php\/)?start-page(?:\.html)?\/?$/.test(path)) target = '/about';
  else if (/^\/(?:index\.php\/)?6\.html\/?$/.test(path)) target = '/music';
  else if (/^\/(?:index\.php\/)?feed(?:\/.*)?$/.test(path)) target = '/feed.xml';
  else if (path === '/index.php' || path === '/index.php/') target = request.nextUrl.searchParams.has('s') ? `/archives?q=${encodeURIComponent(request.nextUrl.searchParams.get('s') || '')}` : '/';
  else if (path === '/' && request.nextUrl.searchParams.has('s')) target = `/archives?q=${encodeURIComponent(request.nextUrl.searchParams.get('s') || '')}`;
  else if (path.startsWith('/index.php/')) target = path.replace('/index.php', '');
  else if (/^\/tag\/([^/]+)\/?$/.test(path)) target = `/archives?tag=${encodeURIComponent(decode(path.split('/')[2]))}`;
  if (target) return NextResponse.redirect(new URL(target, request.url), 301);
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next|usr|uploads|icon.svg).*)'] };
