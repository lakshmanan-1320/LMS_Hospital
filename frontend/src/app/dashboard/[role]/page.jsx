'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Users,
  Award,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Clock3,
  Presentation,
  FileText,
  AlertCircle,
  RefreshCw,
  CalendarDays,
  Activity,
  Inbox,
} from 'lucide-react';

import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { usePlatformConfigStore } from '@/stores/usePlatformConfigStore';
import { dashboardService } from '@/modules/dashboard/services/dashboard.service';
import { visibleNavItems, navLabel, navIcon, routeFor } from '@/components/dashboard/navConfig';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayFormatted() {
  // e.g. "Sat, 21 Nov 2026"
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || '–';

const toNumber = (value) => {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const roleMeta = {
  student: {
    subtitle: 'Track your courses and pick up where you left off.',
    roleName: 'Student',
    primary: 'Your courses',
    primaryHint: 'Courses you are enrolled in',
    actionLabel: 'Explore courses',
    actionRoute: '/dashboard/student/courses',
    allCoursesRoute: '/dashboard/student/courses',
  },
  instructor: {
    subtitle: 'Your courses, learners and reviews at a glance.',
    roleName: 'Instructor',
    primary: 'Your courses',
    primaryHint: 'Recently updated courses you teach',
    actionLabel: 'Create a course',
    actionRoute: '/dashboard/instructor/courses/new',
    allCoursesRoute: '/dashboard/instructor/courses',
  },
  admin: {
    subtitle: 'Platform activity across learners, courses and enrollments.',
    roleName: 'Admin',
    primary: 'Course catalog',
    primaryHint: 'Recently updated courses across the platform',
    actionLabel: 'Platform settings',
    actionRoute: '/dashboard/admin/settings',
    allCoursesRoute: '/dashboard/admin/courses',
  },
  'super-admin': {
    subtitle: 'Platform activity across users, courses and enrollments.',
    roleName: 'Super Admin',
    primary: 'Platform courses',
    primaryHint: 'Recently updated courses across the platform',
    actionLabel: 'Platform settings',
    actionRoute: '/dashboard/super-admin/settings',
    allCoursesRoute: '/dashboard/super-admin/courses',
  },
};

const QUICK_ACCESS_HINTS = {
  'User Management': 'Students & instructors',
  Categories: 'Course taxonomy',
  Courses: 'Catalog & approvals',
  Curriculum: 'Sections & lessons',
  Enrollments: 'Learner access',
  Orders: 'Payments & invoices',
  Certificates: 'Issued certificates',
  'Coupons & Discounts': 'Promotions',
  'Reviews & Ratings': 'Learner feedback',
  Webinars: 'Live sessions',
  Campaigns: 'SMS, email & WhatsApp',
  Settings: 'Platform config',
  'Course Catalogue': 'Browse courses',
  'My Learning': 'Continue learning',
  'Purchase History': 'Orders & invoices',
  'My Certificates': 'Your certificates',
  Performance: 'Course analytics',
  Profile: 'Instructor profile',
  'Module Management': 'Feature access',
  'Roles & Permissions': 'Access control',
  'Admin Accounts': 'Administrators',
  Integrations: 'Gateways',
  'Audit Logs': 'Platform history',
  'Live Sessions': 'Webinars & classes',
};

const STATUS_FILTERS = [
  ['all', 'All'],
  ['Published', 'Published'],
  ['Pending Review', 'In review'],
  ['Draft', 'Draft'],
];

function statusTone(status) {
  if (status === 'Draft' || status === 'Pending Review' || status === 'In Progress') return 'warn';
  if (status === 'Archived' || status === 'Rejected') return 'neutral';
  return 'good';
}

function DashboardInner() {
  const router = useRouter();
  const params = useParams();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = roleMeta[rawRole] ? rawRole : 'student';
  const meta = roleMeta[role];

  const { user } = useAuthStore();
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getOverview();
      setOverview(data);
    } catch (err) {
      setError(err?.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [role]);

  // Construct dynamic stat cards based on real database records
  const stats = overview?.stats || {};
  let statCards = [];

  if (role === 'student') {
    statCards = [
      {
        label: 'Courses in progress',
        value: stats.activeCourses ?? (isLoading ? '-' : '0'),
        change: `${stats.enrolledCourses ?? 0} enrolled total`,
        icon: BookOpen,
      },
      {
        label: 'Learning hours',
        value: stats.learningHours ?? (isLoading ? '-' : '0.0h'),
        change: 'Total time spent',
        icon: Clock3,
      },
      {
        label: 'Completed courses',
        value: stats.completedCourses ?? (isLoading ? '-' : '0'),
        change: 'Keep up the momentum!',
        icon: Award,
      },
      {
        label: 'Completed lessons',
        value: stats.completedLessons ?? (isLoading ? '-' : '0'),
        change: 'Finished lessons',
        icon: TrendingUp,
      },
    ];
  } else if (role === 'instructor') {
    statCards = [
      {
        label: 'Active courses',
        value: stats.publishedCourses ?? (isLoading ? '-' : '0'),
        change: `${stats.draftCourses ?? 0} drafts in progress`,
        icon: BookOpen,
      },
      {
        label: 'Total learners',
        value: stats.totalLearners ?? (isLoading ? '-' : '0'),
        change: 'Enrolled students',
        icon: Users,
      },
      {
        label: 'Pending requests',
        value: stats.pendingReplacements ?? (isLoading ? '-' : '0'),
        change: 'Media replacements',
        icon: Award,
      },
      {
        label: 'Total courses',
        value: stats.totalCourses ?? (isLoading ? '-' : '0'),
        change: `${stats.pendingCourses ?? 0} awaiting review`,
        icon: TrendingUp,
      },
    ];
  } else if (role === 'admin') {
    statCards = [
      {
        label: 'Total learners',
        value: stats.totalStudents ?? (isLoading ? '-' : '0'),
        change: 'Registered students',
        icon: Users,
      },
      {
        label: 'Active courses',
        value: stats.publishedCourses ?? (isLoading ? '-' : '0'),
        change: `${stats.pendingCourses ?? 0} awaiting review`,
        icon: BookOpen,
      },
      {
        label: 'Instructors',
        value: stats.totalInstructors ?? (isLoading ? '-' : '0'),
        change: 'Platform educators',
        icon: Presentation,
      },
      {
        label: 'Total enrollments',
        value: stats.totalEnrollments ?? (isLoading ? '-' : '0'),
        change: `${stats.activeEnrollments ?? 0} active`,
        icon: TrendingUp,
      },
    ];
  } else {
    // super-admin
    statCards = [
      {
        label: 'Platform users',
        value: stats.totalUsers ?? (isLoading ? '-' : '0'),
        change: `${stats.totalStudents ?? 0} students · ${stats.totalInstructors ?? 0} instructors`,
        icon: Users,
      },
      {
        label: 'Published courses',
        value: stats.publishedCourses ?? (isLoading ? '-' : '0'),
        change: `${stats.totalCourses ?? 0} total · ${stats.draftCourses ?? 0} drafts`,
        icon: BookOpen,
      },
      {
        label: 'Administrators',
        value: stats.totalAdmins ?? (isLoading ? '-' : '0'),
        change: 'Active administrative accounts',
        icon: Presentation,
      },
      {
        label: 'Total enrollments',
        value: stats.totalEnrollments ?? (isLoading ? '-' : '0'),
        change: `${stats.activeEnrollments ?? 0} active · ${stats.completedEnrollments ?? 0} completed`,
        icon: TrendingUp,
      },
    ];
  }

  // Course list determination per role
  let courseItems = [];
  if (role === 'student') {
    courseItems = (overview?.enrolledCourses || []).map((c) => ({
      id: c.courseId,
      raw: c,
      title: c.title,
      subtitle: `Instructor: ${c.instructorName} · ${c.completedLessonsCount || 0}/${c.totalLessonsCount || 0} lessons completed`,
      progress: c.completionPercentage || 0,
      status: c.completionPercentage === 100 ? 'Completed' : 'In Progress',
      link: `/my-learning/${c.slug || c.courseId}`,
    }));
  } else if (role === 'instructor') {
    courseItems = (overview?.courses || []).map((c) => ({
      id: c.courseId,
      raw: c,
      title: c.title,
      subtitle: `${c.enrollmentCount || 0} learners · ${c.lessonCount || 0} lessons · Updated ${formatTimeAgo(c.updatedAt)}`,
      progress: c.status === 'published' ? 100 : c.status === 'pending_review' ? 60 : 30,
      status: c.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      link: `/dashboard/instructor/courses/${c.courseId}`,
    }));
  } else {
    // admin and super-admin
    courseItems = (overview?.recentCourses || []).map((c) => ({
      id: c.courseId,
      raw: c,
      title: c.title,
      subtitle: `Instructor: ${c.instructorName} · ${c.enrollmentCount || 0} learners · Updated ${formatTimeAgo(c.updatedAt)}`,
      progress: c.status === 'published' ? 100 : c.status === 'pending_review' ? 60 : 30,
      status: c.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      link: `/dashboard/${role}/courses/${c.courseId}`,
    }));
  }

  // Activity items determination per role
  let activityItems = [];
  if (role === 'student') {
    activityItems = (overview?.recentActivity || []).map((a) => ({
      key: `student-act-${a.lessonId}-${a.completedAt}`,
      title: 'Lesson completed',
      desc: `${a.lessonTitle} in ${a.courseTitle}`,
      time: formatTimeAgo(a.completedAt),
      type: 'book',
    }));
  } else if (role === 'instructor') {
    activityItems = (overview?.recentActivity || []).map((a) => ({
      key: `instructor-act-${a.logId}-${a.createdAt}`,
      title: (a.action || 'Activity recorded').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      desc: a.courseTitle || 'Course asset update',
      time: formatTimeAgo(a.createdAt),
      type: 'file',
    }));
  } else {
    // admin and super-admin
    activityItems = (overview?.recentActivity || []).map((a) => ({
      key: `admin-act-${a.logId}-${a.createdAt}`,
      title: (a.action || 'Audit log').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      desc: `${a.actorName} · ${a.courseTitle || 'Media update'}`,
      time: formatTimeAgo(a.createdAt),
      type: 'user',
    }));
  }

  // ---------------------------------------------------------------------------
  // Presentation-only derivations (no new requests; everything comes from `overview`).
  // ---------------------------------------------------------------------------
  const isAdminLike = role === 'admin' || role === 'super-admin';
  const fullName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : meta.roleName;

  // Quick Access: the same menu items (and access rules) as the sidebar.
  const myAccess = usePlatformConfigStore((s) => s.myAccess);
  const myAccessLoaded = usePlatformConfigStore((s) => s.myAccessLoaded);
  const accessFor = (moduleKey) => (!moduleKey || !myAccessLoaded ? 'full' : myAccess[moduleKey] || 'none');
  const quickAccess = visibleNavItems(role, accessFor)
    .filter((item) => navLabel(item) !== 'Overview')
    .slice(0, 8)
    .map((item) => ({
      label: navLabel(item),
      Icon: navIcon(item),
      href: routeFor(role, navLabel(item), item.subItems ? item.subItems[0].path : undefined),
    }));

  // Course panel: status filter + selected course (presentation state only).
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const showStatusFilter = role !== 'student';
  const filteredCourses =
    statusFilter === 'all' ? courseItems : courseItems.filter((c) => c.status === statusFilter);
  const selected = filteredCourses.find((c) => c.id === selectedId) || filteredCourses[0] || null;
  const countFor = (key) => (key === 'all' ? courseItems.length : courseItems.filter((c) => c.status === key).length);

  // Course pipeline chart (admin / super-admin / instructor) or weekly learning (student).
  const weeklyActivity = overview?.weeklyActivity || [];
  const pipeline =
    role === 'student'
      ? weeklyActivity.map((d, i) => ({
          label: d.dayName ? d.dayName.slice(0, 3) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
          value: Number(d.minutesWatched) || 0,
          unit: 'm',
        }))
      : [
          { label: 'Published', value: toNumber(stats.publishedCourses) },
          { label: 'In review', value: toNumber(stats.pendingCourses) },
          { label: 'Draft', value: toNumber(stats.draftCourses) },
          {
            label: 'Other',
            value: Math.max(
              0,
              toNumber(stats.totalCourses) -
                toNumber(stats.publishedCourses) -
                toNumber(stats.pendingCourses) -
                toNumber(stats.draftCourses),
            ),
          },
        ];
  const pipelineMax = Math.max(1, ...pipeline.map((b) => b.value));
  const pipelineScale = Math.max(4, Math.ceil(pipelineMax / 4) * 4);
  const peakIndex = pipeline.some((b) => b.value > 0)
    ? pipeline.findIndex((b) => b.value === pipelineMax)
    : -1;

  // Donut (enrollment status / course completion / publish rate).
  const donut = isAdminLike
    ? {
        title: 'Enrollment status',
        badge: `${toNumber(stats.totalEnrollments)} total`,
        part: toNumber(stats.activeEnrollments),
        whole: toNumber(stats.totalEnrollments),
        caption: 'active',
        legend: [
          ['Active', toNumber(stats.activeEnrollments), 'primary'],
          ['Completed', toNumber(stats.completedEnrollments), 'muted'],
        ],
      }
    : role === 'instructor'
      ? {
          title: 'Publishing status',
          badge: `${toNumber(stats.totalCourses)} courses`,
          part: toNumber(stats.publishedCourses),
          whole: toNumber(stats.totalCourses),
          caption: 'published',
          legend: [
            ['Published', toNumber(stats.publishedCourses), 'primary'],
            ['Drafts', toNumber(stats.draftCourses), 'muted'],
          ],
        }
      : {
          title: 'Course completion',
          badge: `${toNumber(stats.enrolledCourses)} enrolled`,
          part: toNumber(stats.completedCourses),
          whole: toNumber(stats.enrolledCourses),
          caption: 'completed',
          legend: [
            ['Completed', toNumber(stats.completedCourses), 'primary'],
            ['In progress', toNumber(stats.activeCourses), 'muted'],
          ],
        };
  const donutPct = donut.whole > 0 ? Math.round((donut.part / donut.whole) * 100) : 0;
  const DONUT_R = 42;
  const DONUT_C = 2 * Math.PI * DONUT_R;

  // KPI card mini visuals, built from the same stats.
  const instructorNames = [
    ...new Set((overview?.recentCourses || []).map((c) => (c.instructorName || '').trim()).filter(Boolean)),
  ];
  const kpiVisual = (index) => {
    if (isLoading) return null;
    if (isAdminLike && index === 0) {
      const a = toNumber(role === 'admin' ? stats.totalStudents : stats.totalStudents);
      const b = toNumber(stats.totalInstructors);
      const c = role === 'super-admin' ? toNumber(stats.totalAdmins) : 0;
      const sum = a + b + c || 1;
      const parts = [
        ['Students', a, 'p1'],
        ['Instructors', b, 'p2'],
        ...(role === 'super-admin' ? [['Admins', c, 'p3']] : []),
      ];
      return (
        <div className="kpi-split">
          <div className="kpi-split-bar">
            {parts.map(([label, v, tone]) => (
              v > 0 && <span key={label} className={tone} style={{ flexGrow: v / sum }} />
            ))}
          </div>
          <div className="kpi-legend">
            {parts.map(([label, v, tone]) => (
              <span key={label}>
                <i className={tone} /> {label} <b>{v}</b>
              </span>
            ))}
          </div>
        </div>
      );
    }
    if ((isAdminLike || role === 'instructor') && index === (role === 'instructor' ? 3 : 1)) {
      const bars = [
        ['Live', toNumber(stats.publishedCourses)],
        ['Review', toNumber(stats.pendingCourses)],
        ['Draft', toNumber(stats.draftCourses)],
      ];
      const max = Math.max(1, ...bars.map(([, v]) => v));
      const top = bars.findIndex(([, v]) => v === max && v > 0);
      return (
        <div className="kpi-bars">
          {bars.map(([label, v], i) => (
            <div key={label} className={`kpi-bar ${i === top ? 'is-peak' : ''}`}>
              <span style={{ height: `${Math.max(10, (v / max) * 100)}%` }} />
              <small>{label}</small>
            </div>
          ))}
        </div>
      );
    }
    if (role === 'admin' && index === 2) {
      return (
        <div className="kpi-people">
          <div className="kpi-avatars">
            {instructorNames.slice(0, 4).map((name) => (
              <span key={name} title={name}>
                {initialsOf(name)}
              </span>
            ))}
            {instructorNames.length === 0 && <span className="empty">–</span>}
          </div>
          <small>
            {instructorNames.length > 0
              ? `${instructorNames.length} with recently updated courses`
              : 'No recent course updates'}
          </small>
        </div>
      );
    }
    if (isAdminLike && index === 3) {
      const tiles = [
        ['Active', toNumber(stats.activeEnrollments)],
        ['Completed', toNumber(stats.completedEnrollments)],
        ['Total', toNumber(stats.totalEnrollments)],
      ];
      return (
        <div className="kpi-tiles">
          {tiles.map(([label, v], i) => (
            <div key={label} className={i === 1 ? 'is-featured' : ''}>
              <b>{v}</b>
              <small>{label}</small>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const courseDetail = (course) => {
    const raw = course?.raw || {};
    if (role === 'student') {
      return [
        ['Progress', `${course.progress || 0}%`],
        ['Lessons', `${raw.completedLessonsCount || 0}/${raw.totalLessonsCount || 0}`],
        ['Instructor', raw.instructorName || '—'],
      ];
    }
    return [
      ['Learners', String(raw.enrollmentCount ?? 0)],
      [role === 'instructor' ? 'Lessons' : 'Status', role === 'instructor' ? String(raw.lessonCount ?? 0) : course.status],
      ['Last updated', formatTimeAgo(raw.updatedAt) || '—'],
    ];
  };

  return (
    <div className="ov">
      {/* Page header */}
      <div className="ov-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back, {fullName} · <span>{meta.subtitle}</span>
          </p>
        </div>

        <div className="ov-head-actions">
          <span className="ov-chip">
            <CalendarDays size={15} />
            {getTodayFormatted()}
          </span>
          {meta.actionRoute && (
            <button type="button" onClick={() => router.push(meta.actionRoute)} className="db-btn db-btn-primary">
              {meta.actionLabel}
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="ov-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={fetchOverview}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="ov-kpis">
        {statCards.map(({ label, value, change, icon: Icon }, index) => (
          <div className="ov-card ov-kpi" key={label}>
            <div className="ov-kpi-top">
              <span>{label}</span>
              <span className="ov-icon">
                <Icon size={16} />
              </span>
            </div>
            <div className="ov-kpi-value">
              {isLoading ? <span className="ov-skeleton" style={{ width: 72, height: 34 }} /> : value}
            </div>
            <div className="ov-kpi-note">{isLoading ? 'Loading…' : change}</div>
            <div className="ov-kpi-visual">{kpiVisual(index)}</div>
          </div>
        ))}
      </div>

      {/* Course panel (Figma "Pending Approvals") */}
      <section className="ov-card ov-queue">
        <div className="ov-queue-head">
          <div>
            <h2>{meta.primary}</h2>
            <p>{meta.primaryHint}</p>
          </div>
          <div className="ov-queue-tools">
            {showStatusFilter && (
              <div className="db-segmented" role="tablist" aria-label="Filter by status">
                {STATUS_FILTERS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === key}
                    className={statusFilter === key ? 'active' : ''}
                    onClick={() => {
                      setStatusFilter(key);
                      setSelectedId(null);
                    }}
                  >
                    {label}
                    <em>{countFor(key)}</em>
                  </button>
                ))}
              </div>
            )}
            {meta.allCoursesRoute && (
              <button type="button" className="db-btn db-btn-ghost" onClick={() => router.push(meta.allCoursesRoute)}>
                View all <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="ov-queue-body">
          <div className="ov-queue-list">
            {isLoading ? (
              <div className="ov-empty">Loading courses…</div>
            ) : filteredCourses.length === 0 ? (
              <div className="ov-empty">
                <Inbox size={18} />
                {courseItems.length > 0
                  ? 'No courses with this status.'
                  : role === 'student'
                    ? 'You are not enrolled in any courses yet.'
                    : role === 'instructor'
                      ? 'No courses created yet.'
                      : 'No courses found in platform.'}
              </div>
            ) : (
              filteredCourses.map((course) => {
                const isSelected = selected?.id === course.id;
                return (
                  <button
                    type="button"
                    key={course.id}
                    className={`ov-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedId(course.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="ov-avatar">{initialsOf(course.title)}</span>
                    <span className="ov-row-copy">
                      <b>{course.title}</b>
                      <small>
                        {role === 'student'
                          ? `${course.progress || 0}% complete`
                          : role === 'instructor'
                            ? `${course.raw?.lessonCount || 0} lessons · ${formatTimeAgo(course.raw?.updatedAt)}`
                            : `${course.raw?.instructorName || 'Instructor'} · ${formatTimeAgo(course.raw?.updatedAt)}`}
                      </small>
                    </span>
                    <span className={`db-badge tone-${statusTone(course.status)}`}>{course.status}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="ov-detail">
            {selected ? (
              <>
                <div className="ov-detail-top">
                  <div>
                    <small>Course details</small>
                    <h3>
                      {selected.title}
                      <span className={`db-badge tone-${statusTone(selected.status)}`}>{selected.status}</span>
                    </h3>
                  </div>
                  {selected.raw?.instructorName && (
                    <div className="ov-detail-person">
                      <span className="ov-avatar light">{initialsOf(selected.raw.instructorName)}</span>
                      <span>
                        <b>{selected.raw.instructorName}</b>
                        <small>Instructor</small>
                      </span>
                    </div>
                  )}
                </div>

                <div className="ov-detail-tiles">
                  {courseDetail(selected).map(([label, value]) => (
                    <div key={label} className="ov-detail-tile">
                      <b>{value}</b>
                      <small>{label}</small>
                    </div>
                  ))}
                </div>

                <div className="ov-detail-progress">
                  <div>
                    <small>{role === 'student' ? 'Completion' : 'Lifecycle'}</small>
                    <b>{selected.progress || 0}%</b>
                  </div>
                  <div className="ov-progress">
                    <span style={{ width: `${selected.progress || 0}%` }} />
                  </div>
                </div>

                <div className="ov-detail-foot">
                  <div className="ov-detail-stats">
                    {isAdminLike ? (
                      <>
                        <span><small>Total courses</small><b>{toNumber(stats.totalCourses)}</b></span>
                        <span><small>Published</small><b>{toNumber(stats.publishedCourses)}</b></span>
                        <span><small>In review</small><b>{toNumber(stats.pendingCourses)}</b></span>
                      </>
                    ) : role === 'instructor' ? (
                      <>
                        <span><small>Total courses</small><b>{toNumber(stats.totalCourses)}</b></span>
                        <span><small>Learners</small><b>{toNumber(stats.totalLearners)}</b></span>
                        <span><small>Drafts</small><b>{toNumber(stats.draftCourses)}</b></span>
                      </>
                    ) : (
                      <>
                        <span><small>Enrolled</small><b>{toNumber(stats.enrolledCourses)}</b></span>
                        <span><small>Completed</small><b>{toNumber(stats.completedCourses)}</b></span>
                        <span><small>Hours</small><b>{stats.learningHours ?? '0.0h'}</b></span>
                      </>
                    )}
                  </div>
                  {role === 'student' && overview?.continueLearning ? (
                    <Link
                      className="db-btn db-btn-light"
                      href={`/my-learning/${overview.continueLearning.courseSlug || overview.continueLearning.courseId}${
                        overview.continueLearning.lessonId ? `?lessonId=${overview.continueLearning.lessonId}` : ''
                      }`}
                    >
                      Continue lesson <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <button type="button" className="db-btn db-btn-light" onClick={() => router.push(selected.link)}>
                      Open course <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="ov-detail-empty">
                <BookOpen size={22} />
                <b>{isLoading ? 'Loading…' : 'Nothing to show yet'}</b>
                <small>Course details appear here once courses are available.</small>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Access */}
      {quickAccess.length > 0 && (
        <section className="ov-section">
          <div className="ov-section-head">
            <div>
              <h2>Quick access</h2>
              <p>Jump straight into the modules you use most</p>
            </div>
          </div>
          <div className="ov-quick">
            {quickAccess.map(({ label, Icon, href }, i) => (
              <button
                type="button"
                key={label}
                className={`ov-quick-tile ${i === 0 ? 'featured' : ''}`}
                onClick={() => router.push(href)}
              >
                <span className="ov-quick-icon">
                  <Icon size={17} />
                </span>
                <ArrowUpRight size={14} className="ov-quick-arrow" />
                <b>{label}</b>
                <small>{QUICK_ACCESS_HINTS[label] || 'Open module'}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Insights */}
      <section className="ov-section">
        <div className="ov-section-head">
          <div>
            <h2>{role === 'student' ? 'Learning insights' : role === 'instructor' ? 'Teaching insights' : 'Platform insights'}</h2>
            <p>
              {role === 'student'
                ? 'Your weekly activity, progress and recent lessons'
                : role === 'instructor'
                  ? 'Your course pipeline, publishing status and recent activity'
                  : 'Course pipeline, enrollments and the latest activity'}
            </p>
          </div>
        </div>

        <div className="ov-insights">
          {/* Bar chart */}
          <div className="ov-card ov-chart-card">
            <div className="ov-card-head">
              <div>
                <h3>{role === 'student' ? 'Weekly learning' : 'Course pipeline'}</h3>
                <p>{role === 'student' ? 'Minutes watched per day this week' : 'Courses by publishing status'}</p>
              </div>
              <span className="db-badge tone-neutral">
                {role === 'student'
                  ? `${pipeline.reduce((s, b) => s + b.value, 0)} min`
                  : `${toNumber(stats.totalCourses)} courses`}
              </span>
            </div>

            {pipeline.length === 0 ? (
              <div className="ov-empty">No activity recorded this week.</div>
            ) : (
              <div className="ov-bars">
                <div className="ov-bars-grid">
                  {[4, 3, 2, 1, 0].map((step) => (
                    <div key={step}>
                      <small>{Math.round((pipelineScale / 4) * step)}</small>
                    </div>
                  ))}
                </div>
                <div className="ov-bars-cols">
                  {pipeline.map((bar, i) => (
                    <div key={bar.label} className={`ov-bar ${i === peakIndex ? 'is-peak' : ''}`}>
                      <div className="ov-bar-track">
                        <b>
                          {bar.value}
                          {bar.unit || ''}
                        </b>
                        <span style={{ height: `${Math.max(bar.value > 0 ? 6 : 2, (bar.value / pipelineScale) * 100)}%` }} />
                      </div>
                      <small>{bar.label}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Latest activity */}
          <div className="ov-card ov-alerts">
            <div className="ov-card-head">
              <h3>Latest activity</h3>
              <span className="db-badge tone-primary">{activityItems.length} recent</span>
            </div>
            <div className="ov-alert-list">
              {isLoading ? (
                <div className="ov-empty">Loading activity…</div>
              ) : activityItems.length === 0 ? (
                <div className="ov-empty">
                  <Activity size={18} />
                  No recent activity recorded yet.
                </div>
              ) : (
                activityItems.slice(0, 4).map((item, i) => (
                  <div className="ov-alert" key={item.key}>
                    <span className="ov-alert-icon">
                      {item.type === 'book' ? <BookOpen size={15} /> : item.type === 'file' ? <FileText size={15} /> : <Users size={15} />}
                    </span>
                    <span className="ov-alert-copy">
                      <b>{item.title}</b>
                      <small>
                        {item.desc} · {item.time}
                      </small>
                    </span>
                    {i < 2 && <i className="ov-dot" aria-hidden="true" />}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Donut */}
          <div className="ov-card ov-donut-card">
            <div className="ov-card-head">
              <h3>{donut.title}</h3>
              <span className="db-badge tone-neutral">{donut.badge}</span>
            </div>
            <div className="ov-donut">
              <svg viewBox="0 0 110 110" aria-hidden="true">
                <circle cx="55" cy="55" r={DONUT_R} className="track" />
                {donutPct > 0 && (
                <circle
                  cx="55"
                  cy="55"
                  r={DONUT_R}
                  className="value"
                  strokeDasharray={`${(donutPct / 100) * DONUT_C} ${DONUT_C}`}
                  transform="rotate(-90 55 55)"
                />
                )}
              </svg>
              <div className="ov-donut-label">
                <b>{isLoading ? '–' : `${donutPct}%`}</b>
                <small>{donut.caption}</small>
              </div>
            </div>
            <div className="ov-donut-legend">
              {donut.legend.map(([label, value, tone]) => (
                <span key={label}>
                  <i className={tone} />
                  {label}
                  <b>{value}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardInner />;
}
