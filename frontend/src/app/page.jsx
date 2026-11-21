
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { webinarService } from '@/modules/webinars/services/webinar.service';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useModuleAccess, usePublicModule } from '@/stores/usePlatformConfigStore';
import { useHeaderAuthState, AccountSkeleton } from '@/components/auth/SessionHint';
import AccountMenu from '@/components/layout/AccountMenu';
import { useCartStore } from '@/stores/useCartStore';

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GraduationCap,
  Menu,
  Play,
  Sparkles,
  Users,
  Video,
  X,
  Award,
  Layers3,
  Calendar,
  ShoppingCart,
  LogIn,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import HomeCourseRows from '@/modules/courses/components/HomeCourseRows';

const benefits = [
  {
    icon: Video,
    title: 'Learn your way',
    text: 'On-demand lessons, clear learning paths and resources you can revisit anytime.',
  },
  {
    icon: Users,
    title: 'A real learning community',
    text: 'Ask questions, share ideas and learn alongside people moving in the same direction.',
  },
  {
    icon: Award,
    title: 'Show what you know',
    text: 'Complete courses, submit assignments and earn certificates that celebrate your progress.',
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const { user, isAuthenticated } = useAuthStore();

  // Dynamic Module Management: hide what's turned off (the backend blocks it regardless).
  const showWebinars = usePublicModule('webinars');
  const showInstructors = usePublicModule('instructor_profiles');
  const salesOpen = useModuleAccess('cart_checkout') !== 'none';
  const headerAuth = useHeaderAuthState();

  const {
    cart,
    fetchCart,
    successMessage,
    successKind,
    resetSuccess,
  } = useCartStore();

  const cartItemCount = cart?.summary?.itemCount || 0;

  useEffect(() => {
    // Any signed-in account can buy courses (students, instructors, admins).
    if (isAuthenticated) {
      fetchCart();
    }
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => resetSuccess(), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, resetSuccess]);


  // Upcoming public webinars
  const [upcomingWebinars, setUpcomingWebinars] = useState([]);
  const [loadingWebinars, setLoadingWebinars] = useState(true);


  useEffect(() => {
    const fetchWebinars = async () => {
      try {
        setLoadingWebinars(true);

        const response = await webinarService.getPublicWebinars({
          limit: 3,
        });

        setUpcomingWebinars(response?.data || []);
      } catch (error) {
        console.error(
          'Failed to load upcoming webinars for homepage:',
          error
        );
      } finally {
        setLoadingWebinars(false);
      }
    };

    fetchWebinars();
  }, []);

  return (
    <main>
      <div className="announcement">
        <Sparkles size={14} />
        Your next chapter starts here
        <span>Explore the learning experience</span>
        <ArrowRight size={14} />
      </div>

      {/* Header */}
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={20} />
          </span>
          elevate<span className="brand-dot">.</span>
        </Link>

        <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
          <a href="#courses" onClick={() => setMenuOpen(false)}>
            Explore courses
          </a>
          {showWebinars && (
            <Link href="/webinars" onClick={() => setMenuOpen(false)}>
              Live Webinars
            </Link>
          )}
          {showInstructors && (
            <Link href="/instructors" onClick={() => setMenuOpen(false)}>
              Instructors
            </Link>
          )}
          {isAuthenticated && (
            <Link href="/my-learning" onClick={() => setMenuOpen(false)}>
              My learning
            </Link>
          )}
          <a href="#about" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Why Elevate
          </a>
          <a href="#stories" onClick={() => setMenuOpen(false)}>
            Learner stories
          </a>
        </nav>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {salesOpen && (
          <Link
            href="/cart"
            title="My Cart"
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              transition: 'background-color 0.2s',
            }}
          >
            <ShoppingCart size={19} />
            {cartItemCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  backgroundColor: '#0d9488',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '9999px',
                  minWidth: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              >
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </Link>
          )}



          {headerAuth === 'loading' ? (
            // A session cookie exists and is being verified: don't flash "Log in" to a signed-in user.
            <AccountSkeleton />
          ) : headerAuth === 'user' ? (
            // Signed in: show who you are (profile menu with My learning, Cart, Dashboard, Log out).
            <AccountMenu />
          ) : (
            <>
            <Link
              href="/login"
              className="login-icon-link"
              aria-label="Log in"
              title="Log in"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                backgroundColor: 'var(--paper)',
              }}
            >
              <LogIn size={18} />
            </Link>
              <Link href="/register" className="btn btn-dark btn-small">
                Get started <ArrowUpRight size={15} />
              </Link>
            </>
          )}
        </div>

        <button
          className="mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            THE SPACE TO BECOME MORE
          </div>

          <h1>
            Make room for
            <br />
            <em>what's next.</em>
          </h1>

          <p className="hero-description">
            Big goals begin with small steps. Discover practical courses,
            inspiring teachers, interactive live masterclasses, and a
            learning experience built around your ambitions.
          </p>

          <div className="hero-buttons">
            <Link href="/register" className="btn btn-primary">
              Start learning <ArrowRight size={17} />
            </Link>

            {showWebinars && (
              <Link href="/webinars" className="text-link">
                <span className="play-circle">
                  <Video size={13} fill="currentColor" />
                </span>
                Browse Live Webinars
              </Link>
            )}
          </div>

          <div className="hero-proof">
            <div className="avatar-stack">
              <span>AM</span>
              <span>SK</span>
              <span>JR</span>
              <span>+</span>
            </div>
            <div>
              <div className="stars">
                ★★★★★ <b>4.9/5</b>
              </div>
              <small>Loved by curious minds everywhere</small>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />

          <div className="hero-art-card">
            <div className="art-top">
              <span className="live-pill">
                <i /> FEATURED CLASS
              </span>
              <span className="art-dots">•••</span>
            </div>

            <div className="art-illustration">
              <div className="sun-shape" />
              <div className="abstract-person">
                <div className="person-head" />
                <div className="person-body" />
              </div>
              <div className="floating-note note-one">
                Think
                <br />
                bigger.
              </div>
              <div className="floating-note note-two">
                Create
                <br />
                more.
              </div>
              <span className="sparkle s1">✳</span>
              <span className="sparkle s2">✦</span>
            </div>

            <div className="art-bottom">
              <div>
                <small>CREATIVE THINKING</small>
                <h3>Ideas into impact</h3>
              </div>
              <span className="round-arrow">
                <ArrowUpRight size={20} />
              </span>
            </div>
          </div>

          <div className="floating-stat">
            <span className="stat-icon">
              <GraduationCap size={19} />
            </span>
            <div>
              <strong>12k+</strong>
              <small>learners growing</small>
            </div>
          </div>

          <div className="floating-progress">
            <div className="progress-icon">
              <Check size={15} />
            </div>
            <div>
              <strong>One step closer</strong>
              <small>Your progress is adding up</small>
            </div>
          </div>

          <div className="hero-caption">
            LEARN SOMETHING. CHANGE EVERYTHING.
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="trust-strip">
        <span>BUILT FOR THE CURIOUS</span>
        <div>
          <b>DESIGN</b>
          <b>DEVELOPMENT</b>
          <b>BUSINESS</b>
          <b>CREATIVITY</b>
          <b>PERSONAL GROWTH</b>
        </div>
      </section>

      {/* Upcoming Live Webinars */}
      {showWebinars && upcomingWebinars.length > 0 && (
        <section className="section webinars-section" id="webinars">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                INTERACTIVE LIVE LEARNING
              </div>
              <h2>
                Upcoming <em>Live Webinars.</em>
              </h2>
            </div>

            <Link href="/webinars" className="text-link">
              Explore all live sessions <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingWebinars.map((webinar) => {
              const start = new Date(webinar.start_time);

              const formattedDate = start.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              const formattedTime = start.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <article
                  key={webinar.webinar_id}
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-44 bg-slate-100 overflow-hidden">
                      <img
                        src={
                          webinar.cover_image_url ||
                          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80'
                        }
                        alt={webinar.title}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/90 backdrop-blur-xs text-indigo-700 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live Masterclass</span>
                      </div>

                      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs">
                        Free Registration
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                        <Calendar size={13} />
                        <span>
                          {formattedDate} · {formattedTime} (
                          {webinar.timezone || 'UTC'})
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-lg leading-snug line-clamp-2">
                        {webinar.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {webinar.short_description ||
                          webinar.description ||
                          'Join live to learn directly from industry professionals.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Public Event
                    </span>

                    <Link
                      href={`/webinars/${webinar.slug}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <span>Register Free</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* All Published Courses */}
      <section className="section courses-section" id="courses">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              EXPLORE OUR CATALOGUE
            </div>
            <h2>
              Explore All <em>Courses.</em>
            </h2>
          </div>
        </div>

        <HomeCourseRows />
      </section>

      {/* About */}
      <section className="about-band" id="about">
        <div className="about-visual">
          <div className="about-shape shape-a" />
          <div className="about-shape shape-b" />
          <div className="about-quote">
            "The beautiful thing about learning is that nobody can take it
            away from you."
            <span>— B.B. King</span>
          </div>
          <div className="about-sticker">
            STAY
            <br />
            CURIOUS ✳
          </div>
        </div>

        <div className="about-copy">
          <div className="eyebrow">LEARNING, REIMAGINED</div>
          <h2>
            Not just courses.
            <br />
            <em>New possibilities.</em>
          </h2>
          <p>
            We believe learning should feel less like ticking boxes and more
            like opening doors. Elevate brings thoughtful content, supportive
            instructors and simple tools together in one welcoming space.
          </p>
          <Link href="/login" className="btn btn-dark">
            Get to know us <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="section features-section" id="features">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MADE FOR YOUR MOMENTUM</div>
            <h2>
              Everything you need
              <br />
              to <em>keep going.</em>
            </h2>
          </div>
          <p>
            From your first lesson to your next big milestone, the right tools
            make the journey feel possible.
          </p>
        </div>

        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, text }, i) => (
            <div className="benefit-card" key={title}>
              <div className="benefit-icon">
                <Icon size={22} />
              </div>
              <span className="benefit-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ArrowUpRight className="benefit-arrow" size={19} />
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonial-section" id="stories">
        <div className="testimonial-mark">"</div>
        <div className="eyebrow">KIND WORDS, REAL GROWTH</div>
        <h2>
          "I stopped waiting for the
          <br />
          perfect time and <em>started.</em>"
        </h2>
        <p>
          Elevate helped me turn a little curiosity into a skill I use every
          day.
        </p>
        <div className="testimonial-person">
          <div className="person-avatar">RK</div>
          <div>
            <strong>Riya K.</strong>
            <small>Product designer · Learner</small>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-spark">✳</div>
        <div className="eyebrow">
          YOUR FUTURE IS A WORK IN PROGRESS
        </div>
        <h2>
          Ready when <em>you are.</em>
        </h2>
        <p>Pick a course. Find your people. Take the first step.</p>
        <Link href="/login" className="btn btn-light">
          Start your journey <ArrowRight size={17} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Layers3 size={20} />
            </span>
            elevate<span className="brand-dot">.</span>
          </Link>

          <p>Make room for what's next.</p>

          <div className="footer-links">
            {showWebinars && <Link href="/webinars">Live Webinars</Link>}
            {showInstructors && <Link href="/instructors">Instructors</Link>}
            <a href="#about">About</a>
            <a href="#courses">Courses</a>
            <a href="#features">Features</a>
            <Link href="/login">Log in</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Elevate Learning. All rights reserved.</span>
          <span>
            Made for curious minds <span className="footer-heart">♥</span>
          </span>
        </div>
      </footer>

      {/* Toast Notification when adding to Cart */}
      {successMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px',
            border: '1px solid #334155',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <CheckCircle2 size={18} color="#14b8a6" />
          <span>{successMessage}</span>
          {successKind === 'cart_added' && (
          <Link
            href="/cart"
            style={{
              marginLeft: '8px',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: '700',
              fontSize: '11px',
              textDecoration: 'none',
            }}
          >
            View Cart
          </Link>
          )}
        </div>
      )}
    </main>
  );
}
