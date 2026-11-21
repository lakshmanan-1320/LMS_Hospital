'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthPageShell, { AuthNotice } from '@/components/auth/AuthPageShell';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { getDashboardRoute } from '@/constants/roles';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === 'true') {
        setSuccessMessage('Your email has been verified successfully! Please sign in to continue.');
      }
      if (params.get('reset') === 'true') {
        setSuccessMessage('Your password has been reset. Please sign in with your new password.');
      }
      const prefillEmail = params.get('email');
      if (prefillEmail) {
        setEmail(prefillEmail);
      }
    }
  }, []);

  const getSafeRedirect = () => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');

    if (
      redirect &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//')
    ) {
      return redirect;
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email.trim() || !password) {
      setFormError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login({
        email: email.trim(),
        password,
      });

      if (result?.success === false) {
        throw new Error(result.message || 'Login failed.');
      }

      const user = result?.user || useAuthStore.getState().user;

      if (!user) {
        throw new Error(
          'Unable to retrieve your account details. Please try again.'
        );
      }

      const redirect = getSafeRedirect();
      const destination = getDashboardRoute(user);

      if (redirect) {
        router.push(redirect);
      } else {
        router.push(destination);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please check your email and password.';

      setFormError(
        Array.isArray(message) ? message.join(', ') : message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterLink = (e) => {
    const redirect = getSafeRedirect();

    if (redirect) {
      e.preventDefault();
      router.push(`/register?redirect=${encodeURIComponent(redirect)}`);
    }
  };

  return (
    <AuthPageShell
      title="Everything your academy needs. One workspace."
      text="Manage courses, learners and enrollments — or pick up your learning right where you left off."
      backHref="/"
      backLabel="Back to home"
    >
      <h2>Sign in</h2>
      <p className="auth-subtitle">Enter your account details to continue.</p>

      {successMessage && <AuthNotice type="success">{successMessage}</AuthNotice>}
      {formError && <AuthNotice>{formError}</AuthNotice>}

      <form onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="login-email">
          Email address
        </label>
        <input
          id="login-email"
          className="auth-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isSubmitting}
          required
        />

        <div className="auth-v2-row">
          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <Link
            href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
            className="auth-v2-link"
          >
            Forgot password?
          </Link>
        </div>

        <div className="password-wrap">
          <input
            id="login-password"
            className="auth-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isSubmitting}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Toggle password visibility"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <button type="submit" className="auth-v2-submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      <div className="auth-v2-foot">
        Don&apos;t have an account?{' '}
        <Link href="/register" onClick={handleRegisterLink}>
          Create account
        </Link>
      </div>

      <div className="auth-terms">
        By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
      </div>
    </AuthPageShell>
  );
}
