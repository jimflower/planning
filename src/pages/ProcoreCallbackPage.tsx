import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { procoreService } from '@/services/procore.service';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function ProcoreCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(searchParams.get('error_description') ?? error);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code received from Procore.');
      return;
    }

    procoreService
      .exchangeCode(code)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/settings'), 1500);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Token exchange failed.');
      });
  }, [searchParams, navigate]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="section-card max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connecting to Procore…
            </h2>
            <p className="mt-1 text-sm text-gray-500">Exchanging authorization code</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-success-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connected!
            </h2>
            <p className="mt-1 text-sm text-gray-500">Redirecting to settings…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-danger-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connection Failed
            </h2>
            <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
            <button
              onClick={() => navigate('/settings')}
              className="btn-primary mt-4"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </main>
  );
}
