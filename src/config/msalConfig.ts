/**
 * MSAL configuration for Azure AD authentication.
 *
 * To set up:
 * 1. Go to Azure Portal → Azure Active Directory → App registrations → New registration
 * 2. Name: "Daily Planning Hub"
 * 3. Redirect URI: Single-page application (SPA) → https://planning.roseconnections.com.au
 *    Also add http://localhost:5173 for local development
 * 4. Under API permissions, add: Microsoft Graph → Delegated → Mail.Send, User.Read
 * 5. Copy the Application (client) ID and Directory (tenant) ID to .env
 */
import { type Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? '',
    authority: import.meta.env.VITE_AZURE_AUTHORITY || `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI ?? window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message) => {
        if (import.meta.env.DEV) console.debug(`[MSAL] ${message}`);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/** Scopes needed for sending email via Graph API */
export const graphScopes = ['User.Read', 'Mail.Send'];

/** Check if Azure AD is configured (client ID present) */
export function isMsalConfigured(): boolean {
  return Boolean(msalConfig.auth.clientId);
}
