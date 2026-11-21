'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { authService } from '@/app/login/services/auth.service';
import AuthPageShell, { AuthNotice } from '@/components/auth/AuthPageShell';

const MIN_LENGTH = 8; // same rule as registration and the backend

/**
 * Reset password: opened from the emailed link (/reset-password?token=…).
 * Sends { token, newPassword } to POST /auth/reset-password. On success every session for the
 * account is signed out by the backend, and the user is sent to sign in with the new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState(null); // null = still reading the URL
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!longEnough) {
      setFormError(`Password must be at least ${MIN_LENGTH} characters long.`);
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword({ token, newPassword: password });
      router.replace('/login?reset=true');
    } catch (err) {
      setFormError(err?.message || 'Could not reset your password. Please try again.');
      setIsSubmitting(false);
    }
  };

  const invalidLink = /invalid or expired/i.test(formError);

  const rule = (ok, label) => (
    <li className={ok ? 'ok' : ''}>
      <Check size={13} /> {label}
    </li>
  );

  return (
    <AuthPageShell
      title="Choose a new password"
      text="Pick something strong that you don't use anywhere else. You'll be signed out on other devices for your security."
    >
      <h2>Set a new password</h2>

      {token === null ? null : !token ? (
        <>
          <p className="auth-subtitle">This reset link is incomplete. Please open the link from your email again, or request a new one.</p>
          <Link href="/forgot-password" className="auth-v2-submit">
            Request a new link <ArrowRight size={17} />
          </Link>
        </>
      ) : (
        <>
          <p className="auth-subtitle">Enter and confirm your new password below.</p>

          {formError && (
            <AuthNotice>
              {invalidLink ? (
                <>
                  This reset link is invalid or has expired.{' '}
                  <Link href="/forgot-password" className="auth-v2-inline-link">
                    Request a new link
                  </Link>
                  .
                </>
              ) : (
                formError
              )}
            </AuthNotice>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="reset-password">
              New password
            </label>
            <div className="password-wrap">
              <input
                id="reset-password"
                className="auth-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
                disabled={isSubmitting}
                autoFocus
                required
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility" tabIndex={-1}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <label className="field-label" htmlFor="reset-confirm">
              Confirm new password
            </label>
            <input
              id="reset-confirm"
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
              disabled={isSubmitting}
              required
            />

            <ul className="auth-v2-rules">
              {rule(longEnough, `At least ${MIN_LENGTH} characters`)}
              {rule(matches, 'Passwords match')}
            </ul>

            <button
              type="submit"
              className="auth-v2-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Updating password...
                </>
              ) : (
                <>
                  Reset password <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthPageShell>
  );
}
