import { useEffect, useRef } from 'react';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

export default function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
}) {
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    console.log('Google Client ID:', clientId);
    console.log('Google object:', window.google);

    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is missing');
      return;
    }

    let cancelled = false;

    const renderButton = () => {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !buttonRef.current ||
        initializedRef.current
      ) {
        return;
      }

      initializedRef.current = true;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            onSuccess(response.credential);
          } else {
            onError('Google sign-in was cancelled.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      buttonRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360,
      });
    };

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);

    if (existingScript) {
      if (window.google?.accounts?.id) {
        renderButton();
      } else {
        existingScript.addEventListener('load', renderButton, {
          once: true,
        });
      }
    } else {
      const script = document.createElement('script');

      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;

      script.onload = renderButton;

      script.onerror = () => {
        console.error('Failed to load Google Identity Services');
        onError('Unable to load Google sign-in. Please try again.');
      };

      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <p className="text-center text-xs text-slate-500">
        Google sign-in is not configured.
      </p>
    );
  }

  return (
    <div
      ref={buttonRef}
      className={disabled ? 'pointer-events-none opacity-60' : ''}
    />
  );
}