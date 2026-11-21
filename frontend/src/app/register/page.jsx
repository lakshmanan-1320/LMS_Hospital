'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Presentation,
  Eye,
  EyeOff,
  Loader2,
  RotateCw,
  Mail,
} from 'lucide-react';
import AuthPageShell, { AuthNotice } from '@/components/auth/AuthPageShell';
import { authService } from '@/app/login/services/auth.service';
import { getDashboardRoute } from '@/constants/roles';

// Public registration allows only Student and Instructor (Admin / Super Admin are protected)
const registrationRoles = [
  {
    id: 'student',
    name: 'Student',
    detail: 'Learn new skills & earn certificates',
    icon: GraduationCap,
  },
  {
    id: 'instructor',
    name: 'Instructor',
    detail: 'Create courses & teach learners',
    icon: Presentation,
  },
];

export default function RegisterPage() {
  const [selectedRole, setSelectedRole] = useState('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [headline, setHeadline] = useState('');

  // Step state: 'form' | 'otp'
  const [step, setStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const router = useRouter();

  // Handle Initial Registration (Step 1)
  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Please enter your first and last name.');
      return;
    }
    if (!email.trim()) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedRole === 'instructor') {
        await authService.registerInstructor({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          headline: headline.trim() || undefined,
        });
      } else {
        await authService.registerStudent({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      }

      setStep('otp');
      setSuccessMessage(
        `A 6-digit verification code has been dispatched to ${email}. Please check your email inbox.`,
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please check your information and try again.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP Verification without auto-login (Step 2)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setFormError(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setFormError('Please enter the complete 6-digit verification code from your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.verifyOtp({
        email: email.trim(),
        otp: cleanOtp,
      });

      // No auto-login: Redirect to login page with verified query param and prefilled email
      const redirect =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
      const safeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : null;
      const redirectParam = safeRedirect ? `&redirect=${encodeURIComponent(safeRedirect)}` : '';
      router.push(`/login?verified=true&email=${encodeURIComponent(email.trim())}${redirectParam}`);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Invalid verification code. Please check your email and try again.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setFormError(null);
    setIsResending(true);
    try {
      await authService.sendOtp(email.trim());
      setSuccessMessage('A fresh 6-digit verification code has been sent to your email.');
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPageShell
      title="Create your account"
      text="Join as a student to learn new skills, or as an instructor to build and teach your own courses."
      backHref="/"
      backLabel="Back to home"
      wide
    >
      {step === 'form' ? (
        <>
          <h2>Create an account</h2>
          <p className="auth-subtitle">Choose your role to get started with instant access.</p>

          {/* Role Picker (Student / Instructor) */}
          <div className="role-picker-label">I want to join as</div>
          <div className="role-grid">
            {registrationRoles.map(({ id, name, detail, icon: Icon }) => {
              const isSelected = selectedRole === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`role-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedRole(id)}
                  aria-pressed={isSelected}
                >
                  <span className="role-icon">
                    <Icon size={17} />
                  </span>
                  <span className="role-copy">
                    <strong>{name}</strong>
                    <small>{detail}</small>
                  </span>
                  <span className="role-radio">{isSelected ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>

          {formError && <AuthNotice>{formError}</AuthNotice>}

          <form onSubmit={handleRegister}>
            <div className="auth-v2-grid2">
              <div>
                <label className="field-label" htmlFor="first-name">First name</label>
                <input
                  id="first-name"
                  className="auth-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="last-name">Last name</label>
                <input
                  id="last-name"
                  className="auth-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              required
            />

            {selectedRole === 'instructor' && (
              <>
                <label className="field-label" htmlFor="headline">
                  Professional headline (optional)
                </label>
                <input
                  id="headline"
                  className="auth-input"
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Lead Product Designer at Figma"
                  disabled={isSubmitting}
                />
              </>
            )}

            <label className="field-label" htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                className="auth-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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
                  <Loader2 size={17} className="animate-spin" /> Creating account...
                </>
              ) : (
                <>
                  Create {selectedRole === 'instructor' ? 'instructor' : 'student'} account <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="auth-v2-foot">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        </>
      ) : (
        /* Step 2: 6-Digit Email OTP Verification */
        <>
          <span className="auth-v2-icon">
            <Mail size={22} />
          </span>
          <h2>Verify your email</h2>
          <p className="auth-subtitle">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
          </p>

          {successMessage && <AuthNotice type="success">{successMessage}</AuthNotice>}
          {formError && <AuthNotice>{formError}</AuthNotice>}

          <form onSubmit={handleVerifyOtp}>
            <label className="field-label" htmlFor="otp-input">Verification code</label>
            <input
              id="otp-input"
              className="auth-input auth-v2-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              disabled={isSubmitting}
              required
            />

            <button type="submit" className="auth-v2-submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  Verify &amp; continue <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="auth-v2-actions">
            <button type="button" className="auth-v2-textbtn" onClick={() => setStep('form')}>
              <ArrowLeft size={15} /> Edit email
            </button>
            <button
              type="button"
              className="auth-v2-textbtn strong"
              onClick={handleResendOtp}
              disabled={isResending}
            >
              <RotateCw size={14} className={isResending ? 'animate-spin' : ''} /> Resend code
            </button>
          </div>
        </>
      )}

      <div className="auth-terms">
        By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
      </div>
    </AuthPageShell>
  );
}
