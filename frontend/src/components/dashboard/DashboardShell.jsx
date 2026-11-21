'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  Layers3,
  ChevronDown,
  Menu,
  LogOut,
  Bell,
  Search,
  ShoppingCart,
  Headphones,
  ArrowRight,
  X,
} from 'lucide-react';

import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useCartStore } from '@/stores/useCartStore';
import { usePlatformConfigStore } from '@/stores/usePlatformConfigStore';
import ModuleUnavailable, { ModuleReadOnlyBanner } from '@/components/layout/ModuleUnavailable';
import {
  MODULE_BY_LABEL,
  routeModuleFor,
  roleLabels,
  routeFor,
  groupNav,
  navLabel,
  navIcon,
  visibleNavItems,
} from './navConfig';
import './dashboard-theme.css';

const SUPPORT_EMAIL = 'support@elevatelms.com';

export default function DashboardShell({ role, children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [campaignsExpanded, setCampaignsExpanded] = useState(true);
  const [navQuery, setNavQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const navSearchRef = useRef(null);

  // Module availability for this user ('full' | 'read_only' | 'none'); the backend enforces it too.
  const myAccess = usePlatformConfigStore((s) => s.myAccess);
  const myAccessLoaded = usePlatformConfigStore((s) => s.myAccessLoaded);
  const accessFor = (moduleKey) => (!moduleKey || !myAccessLoaded ? 'full' : myAccess[moduleKey] || 'none');

  const navItems = visibleNavItems(role, accessFor);

  const routeModule = routeModuleFor(role, pathname);
  const routeAccess = routeModule ? accessFor(routeModule) : 'full';

  const { user, logout } = useAuthStore();

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : `${roleLabels[role] || 'User'} User`;

  const displayEmail = user?.email || '';

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : 'U';

  const cart = useCartStore((state) => state.cart);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const cartItemCount = cart?.summary?.itemCount || 0;

  useEffect(() => {
    // Every role can buy courses, so every dashboard shows the cart badge.
    if (user?.userId) {
      fetchCart();
    }
  }, [user?.userId, fetchCart]);

  const active = pathname?.includes('/certificates')
    ? role === 'student' ? 'My Certificates' : 'Certificates'
    : pathname?.includes('/catalog')
      ? 'Course Catalogue'
      : pathname?.includes('/cart')
        ? 'My Cart'
        : pathname?.includes('/my-learning')
          ? 'My Learning'
          : pathname?.includes('/orders')
            ? role === 'student'
              ? 'Purchase History'
              : 'Orders'
            : pathname?.includes('/enrollments')
              ? 'Enrollments'
              : pathname?.includes('/coupons')
                ? 'Coupons & Discounts'
                : pathname?.includes('/reviews')
                  ? 'Reviews & Ratings'
                  : pathname?.includes('/users')
                    ? 'User Management'
                    : pathname?.includes('/categories')
                      ? 'Categories'
                      : pathname?.includes('/curriculum')
                        ? 'Curriculum'
                        : pathname?.includes('/performance')
                          ? 'Performance'
                          : pathname?.includes('/courses')
                            ? 'Courses'
                            : pathname?.includes('/webinars')
                              ? 'Webinars'
                              : pathname?.includes('/admin-accounts')
                                ? 'Admin Accounts'
                                : pathname?.includes('/audit-logs')
                                  ? 'Audit Logs'
                                  : pathname?.includes('/roles-permissions')
                                    ? 'Roles & Permissions'
                                    : pathname?.endsWith('/modules')
                                      ? 'Module Management'
                                      : pathname?.includes('/integrations')
                                        ? 'All Integrations'
                                        : pathname?.includes('/campaigns/sms')
                                          ? role === 'super-admin'
                                            ? 'SMS Gateway'
                                            : 'SMS Campaigns'
                                          : pathname?.includes('/campaigns/email')
                                            ? role === 'super-admin'
                                              ? 'Email Gateway'
                                              : 'Email Campaigns'
                                            : pathname?.includes('/campaigns/whatsapp')
                                              ? role === 'super-admin'
                                                ? 'WhatsApp Gateway'
                                                : 'WhatsApp Campaigns'
                                              : pathname?.includes('/campaigns')
                                                ? 'Campaigns'
                                                : pathname?.includes('/settings')
                                                  ? 'Settings'
                                                  : 'Overview';

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  const handleNavigation = (label, path) => {
    setSidebarOpen(false);
    router.push(routeFor(role, label, path));
  };

  const openNavSearch = () => {
    setSidebarOpen(true);
    setTimeout(() => navSearchRef.current?.focus(), 50);
  };

  // Sidebar search: narrows the menu to matching items (sub-items included).
  const query = navQuery.trim().toLowerCase();
  const matches = (text) => !query || text.toLowerCase().includes(query);
  const searchedItems = navItems
    .map((item) => {
      if (!item.subItems) return item;
      if (matches(item.label)) return item;
      const subItems = item.subItems.filter((sub) => matches(sub.label));
      return subItems.length ? { ...item, subItems } : null;
    })
    .filter((item) => item && (item.subItems || matches(navLabel(item))));

  const sections = groupNav(role, searchedItems);

  const renderItem = (item) => {
    if (item && item.subItems) {
      const isGroupActive = item.subItems.some((sub) => pathname?.includes(sub.path));
      const expanded = campaignsExpanded || Boolean(query);
      const Icon = item.icon;
      return (
        <div key={item.label} className="nav-group">
          <button
            type="button"
            onClick={() => {
              setCampaignsExpanded((prev) => !prev);
              if (!isGroupActive) {
                handleNavigation(item.label, item.subItems[0].path);
              }
            }}
            className={`nav-item nav-parent ${isGroupActive ? 'active' : ''}`}
          >
            <Icon size={16} />
            <span className="nav-item-label">{item.label}</span>
            <ChevronDown size={14} className={`nav-caret ${expanded ? 'open' : ''}`} />
          </button>

          {expanded && (
            <div className="nav-sub">
              {item.subItems.map((sub) => {
                const isSubActive = pathname?.includes(sub.path);
                const SubIcon = sub.icon;
                return (
                  <button
                    key={sub.label}
                    type="button"
                    onClick={() => handleNavigation(sub.label, sub.path)}
                    className={`nav-sub-item ${isSubActive ? 'active' : ''}`}
                  >
                    <SubIcon size={14} />
                    <span className="nav-item-label">{sub.label}</span>
                    {accessFor(MODULE_BY_LABEL[sub.label]) === 'read_only' && (
                      <span className="nav-off-tag">Off</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const label = navLabel(item);
    const Icon = navIcon(item);
    return (
      <button
        key={label}
        type="button"
        onClick={() => handleNavigation(label)}
        className={`nav-item ${active === label ? 'active' : ''}`}
      >
        <Icon size={16} />
        <span className="nav-item-label">{label}</span>
        {accessFor(MODULE_BY_LABEL[label]) === 'read_only' && (
          <span className="nav-off-tag" title="Turned off: read-only">
            Off
          </span>
        )}
      </button>
    );
  };

  return (
    <main className="dashboard-shell">
      <aside className={`dash-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-search">
          <Search size={14} />
          <input
            ref={navSearchRef}
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Search menu..."
            aria-label="Search menu"
          />
          {navQuery ? (
            <button type="button" onClick={() => setNavQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          ) : (
            <kbd>Menu</kbd>
          )}
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="dash-nav">
          {sections.map((section) => {
            const isCollapsed = collapsed[section.title] && !query;
            const showHeader = sections.length > 1;
            return (
              <div className="nav-section" key={section.title}>
                {showHeader && (
                  <button
                    type="button"
                    className="nav-section-title"
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [section.title]: !prev[section.title] }))
                    }
                    aria-expanded={!isCollapsed}
                  >
                    <span>{section.title}</span>
                    <ChevronDown size={13} className={`nav-caret ${isCollapsed ? '' : 'open'}`} />
                  </button>
                )}
                {!isCollapsed && <div className="nav-section-items">{section.items.map(renderItem)}</div>}
              </div>
            );
          })}
          {sections.length === 0 && <p className="nav-empty">No menu items match “{navQuery}”.</p>}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-card-icon">
              <Headphones size={15} />
            </span>
            <div>
              <b>Need help?</b>
              <small>Our support team is here for you.</small>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="help-card-cta">
              Contact support <ArrowRight size={13} />
            </a>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">{initials}</div>
            <div className="sidebar-user-copy">
              <b>{displayName}</b>
              <small>{roleLabels[role]}</small>
            </div>
          </div>

          <button type="button" onClick={handleLogout} className="sidebar-logout">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <section className="dash-main">
        <header className="dash-topbar">
          <button
            className="dash-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <Link href="/" className="topbar-brand">
            <span className="topbar-brand-mark">
              <Layers3 size={18} />
            </span>
            <span className="topbar-brand-copy">
              <b>Elevate Learning</b>
              <small>Courses · Learners · Growth</small>
            </span>
          </Link>

          <div className="dash-top-actions">
            <button
              type="button"
              className="icon-button"
              onClick={openNavSearch}
              aria-label="Search menu"
              title="Search menu"
            >
              <Search size={17} />
            </button>

            {user && (
              <button
                type="button"
                onClick={() => router.push('/cart')}
                className="icon-button"
                aria-label="My Cart"
                title="My Cart"
              >
                <ShoppingCart size={17} />
                {cartItemCount > 0 && (
                  <span className="cart-badge">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              className="icon-button notification-button"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <i />
            </button>

            <div className="user-menu-wrap">
              <button
                type="button"
                className={`top-user ${userMenuOpen ? 'open' : ''}`}
                onClick={() => setUserMenuOpen((previous) => !previous)}
                title="Account menu"
              >
                <div className="user-avatar">{initials}</div>
                <span className="top-user-copy">
                  <b>{displayName}</b>
                  <small>{roleLabels[role]}</small>
                </span>
                <ChevronDown size={14} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="user-menu-scrim"
                    onClick={() => setUserMenuOpen(false)}
                  />

                  <div className="user-menu">
                    <div className="user-menu-head">
                      <b>{displayName}</b>
                      <small>{displayEmail}</small>
                      <span className="user-menu-role">{roleLabels[role]}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="user-menu-signout"
                    >
                      <LogOut size={16} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="dash-content">
          {routeAccess === 'none' ? (
            <ModuleUnavailable homeHref={`/dashboard/${role}`} />
          ) : (
            <>
              {routeAccess === 'read_only' && <ModuleReadOnlyBanner />}
              {children}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
