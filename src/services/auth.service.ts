/**
 * Auth service using MSAL (Microsoft Authentication Library).
 * Handles Azure AD sign-in and token acquisition for Graph API.
 */
import {
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { msalConfig, graphScopes, isMsalConfigured } from '@/config/msalConfig';

export interface AuthUser {
  displayName: string;
  email: string;
  avatar?: string;
  accountId?: string;
}

let msalInstance: PublicClientApplication | null = null;

async function getMsal(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
    // Handle redirect promise (runs after OAuth redirect)
    await msalInstance.handleRedirectPromise();
  }
  return msalInstance;
}

function accountToUser(account: AccountInfo): AuthUser {
  return {
    displayName: account.name ?? account.username,
    email: account.username,
    accountId: account.homeAccountId,
  };
}

export const authService = {
  isConfigured(): boolean {
    return isMsalConfigured();
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!isMsalConfigured()) return null;
    const msal = await getMsal();
    const accounts = msal.getAllAccounts();
    if (accounts.length === 0) return null;
    return accountToUser(accounts[0]);
  },

  /** Sign in with popup (no page redirect) */
  async signIn(): Promise<AuthUser> {
    const msal = await getMsal();
    const result: AuthenticationResult = await msal.loginPopup({
      scopes: graphScopes,
    });
    if (result.account) {
      msal.setActiveAccount(result.account);
      return accountToUser(result.account);
    }
    throw new Error('Sign-in completed but no account returned');
  },

  /** Sign out */
  async signOut(): Promise<void> {
    const msal = await getMsal();
    const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
    if (account) {
      await msal.logoutPopup({ account });
    }
  },

  async isAuthenticated(): Promise<boolean> {
    if (!isMsalConfigured()) return false;
    const msal = await getMsal();
    return msal.getAllAccounts().length > 0;
  },

  /** Get an access token for Microsoft Graph API */
  async getGraphToken(): Promise<string> {
    const msal = await getMsal();
    const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
    if (!account) throw new Error('Not signed in to Microsoft 365');

    try {
      // Try silent token acquisition first
      const result = await msal.acquireTokenSilent({
        scopes: graphScopes,
        account,
      });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // Fall back to popup
        const result = await msal.acquireTokenPopup({
          scopes: graphScopes,
          account,
        });
        return result.accessToken;
      }
      throw err;
    }
  },
};
