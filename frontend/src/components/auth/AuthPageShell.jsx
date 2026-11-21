'use client';

import Link from 'next/link';
import { ArrowLeft, Layers3, AlertCircle, CheckCircle2 } from 'lucide-react';
import './auth-theme.css';

const CAPABILITIES = ['Courses', 'Certificates', 'Live webinars'];

/**
 * Split sign-in layout shared by login, register, forgot-password and reset-password.
 * Left: charcoal brand side with red ambient light. Right: the form.
 */
export default function AuthPageShell({
  title,
  text,
  // Legacy prop names (kept so older callers still render correctly)
  sideTitle,
  sideAccent,
  sideText,
  backHref = '/login',
  backLabel = 'Back to sign in',
  wide = false,
  children,
}) {
  const heading = title || [sideTitle, sideAccent].filter(Boolean).join(' ');
  const body = text || sideText;
  const year = new Date().getFullYear();

  return (
    <main className="auth-v2">
      <aside className="auth-v2-side" aria-hidden="false">
        <div className="auth-v2-ambient" aria-hidden="true">
          <span className="glow glow-a" />
          <span className="glow glow-b" />
          <span className="grid" />
          <svg className="arcs" viewBox="0 0 600 600" fill="none">
            <circle cx="600" cy="600" r="140" />
            <circle cx="600" cy="600" r="230" />
            <circle cx="600" cy="600" r="320" />
            <circle cx="600" cy="600" r="410" />
            <circle cx="600" cy="600" r="500" />
            <path className="accent" d="M 280 600 A 320 320 0 0 1 452 316" />
          </svg>
        </div>

        <Link href="/" className="auth-v2-brand">
          <span className="auth-v2-brand-mark">
            <Layers3 size={18} />
          </span>
          <span>
            <b>Elevate Learning</b>
            <small>Courses · Learners · Growth</small>
          </span>
        </Link>

        <div className="auth-v2-side-body">
          {heading && <h1>{heading}</h1>}
          {body && <p>{body}</p>}
          <ul className="auth-v2-caps">
            {CAPABILITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="auth-v2-side-foot">© {year} Elevate Learning</div>
      </aside>

      <section className="auth-v2-main">
        <div className="auth-v2-topbar">
          <Link href={backHref} className="auth-v2-back">
            <ArrowLeft size={14} /> {backLabel}
          </Link>
        </div>

        <div className={`auth-v2-form ${wide ? 'wide' : ''}`}>{children}</div>
      </section>
    </main>
  );
}

/** Inline success / error banner. */
export function AuthNotice({ type = 'error', children }) {
  const success = type === 'success';
  return (
    <div role={success ? 'status' : 'alert'} className={`auth-v2-notice ${success ? 'success' : 'error'}`}>
      {success ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
      <span>{children}</span>
    </div>
  );
}
