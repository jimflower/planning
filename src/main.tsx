import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '@/config/msalConfig';
import App from './App';
import './styles/globals.css';

const msalInstance = new PublicClientApplication(msalConfig);

// Must initialise before rendering
msalInstance.initialize().then(() => {
  // Handle redirect promise (runs after OAuth redirect)
  msalInstance.handleRedirectPromise().then(() => {
    // Set the first account as active if available
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MsalProvider>
      </React.StrictMode>,
    );
  });
});
