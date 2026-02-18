export const procoreConfig = {
  clientId: import.meta.env.VITE_PROCORE_CLIENT_ID ?? '',
  clientSecret: import.meta.env.VITE_PROCORE_CLIENT_SECRET ?? '',
  companyId: import.meta.env.VITE_PROCORE_COMPANY_ID ?? '',
  redirectUri: import.meta.env.VITE_PROCORE_REDIRECT_URI ?? `${window.location.origin}/procore/callback`,
  apiBaseUrl: '/proxy/api',        // proxied through Vite to https://api.procore.com
  authUrl: 'https://login.procore.com/oauth/authorize', // browser redirect — no CORS
  tokenUrl: '/proxy/login/oauth/token', // proxied through Vite to avoid CORS
  cacheDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  syncIntervalMs: 60 * 60 * 1000, // 1 hour
};
