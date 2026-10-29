export function securityHeaders({secure=false}={}){
 return {
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' https://*.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.posthog.com; connect-src 'self' https://*.posthog.com; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
 ...(secure?{'Strict-Transport-Security':'max-age=31536000'}:{})
 };
}
