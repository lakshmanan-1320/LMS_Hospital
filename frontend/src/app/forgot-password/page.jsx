'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { authService } from '@/app/login/services/auth.service';
import AuthPageShell, { AuthNotice } from '@/components/auth/AuthPageShell';

const RESEND_SECONDS = 60;

/**
 * Forgot password: asks for the account email and calls POST /auth/forgot-password.
 * The backend answers the same way whether or not the account exists, so the page always
 * shows "check your email" and never reveals which emails are registered.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('email');
    if (prefill) setEmail(prefill);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendLink = async (address) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(address);
      setSentTo(address.trim().toLowerCase());
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setFormError(err?.message || 'Could not send the reset link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError('Please enter your email address.');
      return;
    }
    sendLink(email);
  };

  return (
    <AuthPageShell
      title="Reset your password"
      text="Enter the email you signed up with and we'll send you a secure link to choose a new password."
    >
      {sentTo ? (
        <>
          <span className="auth-v2-icon">
            <MailCheck size={22} />
          </span>
          <h2>Check your email</h2>
          <p className="auth-subtitle">
            If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your
            password. The link expires soon and can only be used once.
          </p>

          {formError && <AuthNotice>{formError}</AuthNotice>}

          <Link href={`/login?email=${encodeURIComponent(sentTo)}`} className="auth-v2-submit">
            Back to sign in <ArrowRight size={17} />
          </Link>

          <div className="auth-v2-foot">
            Didn't get it? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => sendLink(sentTo)}
              disabled={cooldown > 0 || isSubmitting}
              className="auth-v2-textbtn strong"
            >
              {isSubmitting ? 'sending…' : cooldown > 0 ? `resend in ${cooldown}s` : 'resend the link'}
            </button>
            .{' '}
            <button
              type="button"
              onClick={() => {
                setSentTo('');
                setFormError('');
              }}
              className="auth-v2-textbtn strong"
            >
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Forgot password?</h2>
          <p className="auth-subtitle">Enter your account email and we'll send you a reset link.</p>

          {formError && <AuthNotice>{formError}</AuthNotice>}

          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="forgot-email">
              Email address
            </label>
            <input
              id="forgot-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              autoFocus
              required
            />

            <button
              type="submit"
              className="auth-v2-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Sending link...
                </>
              ) : (
                <>
                  Send reset link <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="auth-v2-foot">
            Remembered it?{' '}
            <Link href="/login">
              Sign in
            </Link>
          </div>
        </>
      )}
    </AuthPageShell>
  );
}
