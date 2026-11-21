import {
  LayoutDashboard,
  Users,
  Layers,
  GraduationCap,
  BookOpen,
  Settings,
  UserCheck,
  Video,
  Send,
  Smartphone,
  Mail,
  MessageCircle,
  Tag,
  Receipt,
  TrendingUp,
  Boxes,
  UserCog,
  ScrollText,
  Plug,
  KeyRound,
  Star,
  Award,
} from 'lucide-react';

/**
 * Every menu item belongs to a platform module (Dynamic Module Management): when Super Admin
 * turns a module off or hides it from a role, its menu item disappears for that role.
 */
export const MODULE_BY_LABEL = {
  Overview: 'dashboard',
  'Course Catalogue': 'course_catalog',
  'My Learning': 'learning',
  'Purchase History': 'orders',
  Courses: 'teaching',
  Curriculum: 'teaching',
  Performance: 'instructor_performance',
  Profile: 'teaching',
  'Coupons & Discounts': 'coupons',
  'Reviews & Ratings': 'reviews_ratings',
  'User Management': 'user_management',
  Categories: 'categories',
  Enrollments: 'enrollments',
  Orders: 'orders',
  Webinars: 'webinars',
  'SMS Campaigns': 'sms_campaigns',
  'Email Campaigns': 'email_campaigns',
  'WhatsApp Campaigns': 'whatsapp_campaigns',
  Settings: 'platform_settings',
  'Module Management': 'module_management',
  'Roles & Permissions': 'roles_permissions',
  'Admin Accounts': 'admin_accounts',
  'All Integrations': 'integrations',
  'SMS Gateway': 'integrations',
  'Email Gateway': 'integrations',
  'WhatsApp Gateway': 'integrations',
  'Audit Logs': 'audit_logs',
};

/** Dashboard routes and their module (first match wins). Campaign pages are gateways for Super Admin. */
const MODULE_BY_ROUTE = [
  ['/admin-accounts', 'admin_accounts'],
  ['/audit-logs', 'audit_logs'],
  ['/roles-permissions', 'roles_permissions'],
  ['/modules', 'module_management'],
  ['/integrations', 'integrations'],
  ['/campaigns/sms', 'sms_campaigns'],
  ['/campaigns/email', 'email_campaigns'],
  ['/campaigns/whatsapp', 'whatsapp_campaigns'],
  ['/coupons', 'coupons'],
  ['/reviews', 'reviews_ratings'],
  ['/webinars', 'webinars'],
  ['/performance', 'instructor_performance'],
  ['/catalog', 'course_catalog'],
  ['/orders', 'orders'],
  ['/enrollments', 'enrollments'],
  ['/users', 'user_management'],
  ['/categories', 'categories'],
  ['/curriculum', 'teaching'],
  ['/courses', 'teaching'],
  ['/profile', 'teaching'],
  ['/settings', 'platform_settings'],
];

export const routeModuleFor = (role, pathname) => {
  if (!pathname) return undefined;
  if (pathname === `/dashboard/${role}`) return 'dashboard';
  const key = MODULE_BY_ROUTE.find(([segment]) => pathname.includes(segment))?.[1];
  // Super Admin's campaign pages are the SMS/Email/WhatsApp gateway settings (Integrations).
  if (role === 'super-admin' && key && key.endsWith('_campaigns')) return 'integrations';
  return key;
};

export const navByRole = {
  student: [
    ['Overview', LayoutDashboard],
    ['Course Catalogue', BookOpen],
    ['My Learning', GraduationCap],
    ['Purchase History', Receipt],
    ['My Certificates', Award],
  ],
  instructor: [
    ['Overview', LayoutDashboard],
    ['Courses', BookOpen],
    ['Curriculum', Layers],
    ['Performance', TrendingUp],
    ['Coupons & Discounts', Tag],
    ['Reviews & Ratings', Star],
    ['Certificates', Award],
    ['Live Sessions', Video],
    ['Profile', UserCheck],
  ],
  admin: [
    ['Overview', LayoutDashboard],
    ['User Management', Users],
    ['Categories', Layers],
    ['Courses', BookOpen],
    ['Curriculum', BookOpen],
    ['Enrollments', GraduationCap],
    ['Orders', Receipt],
    ['Certificates', Award],
    ['Coupons & Discounts', Tag],
    ['Reviews & Ratings', Star],
    ['Webinars', Video],
    {
      label: 'Campaigns',
      icon: Send,
      subItems: [
        { label: 'SMS Campaigns', path: '/campaigns/sms', icon: Smartphone },
        { label: 'Email Campaigns', path: '/campaigns/email', icon: Mail },
        { label: 'WhatsApp Campaigns', path: '/campaigns/whatsapp', icon: MessageCircle },
      ],
    },
    ['Settings', Settings],
  ],
  // Super Admin is governance-only: no Enrollments, Orders or Coupons (those belong to Admin).
  'super-admin': [
    ['Overview', LayoutDashboard],
    ['Module Management', Boxes],
    ['Roles & Permissions', KeyRound],
    ['Admin Accounts', UserCog],
    ['Certificates', Award],
    ['Enrollments', GraduationCap],
    ['Coupons & Discounts', Tag],
    {
      label: 'Integrations',
      icon: Plug,
      subItems: [
        { label: 'All Integrations', path: '/integrations', icon: Plug },
        { label: 'SMS Gateway', path: '/campaigns/sms', icon: Smartphone },
        { label: 'Email Gateway', path: '/campaigns/email', icon: Mail },
        { label: 'WhatsApp Gateway', path: '/campaigns/whatsapp', icon: MessageCircle },
      ],
    },
    ['Audit Logs', ScrollText],
    ['Settings', Settings],
  ],
};

export const roleLabels = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
  'super-admin': 'Super Admin',
};

/** Sidebar section headings (display only — items keep their original order inside each section). */
export const NAV_GROUPS = {
  student: [
    ['Overview', ['Overview']],
    ['Learning', ['Course Catalogue', 'My Learning', 'My Certificates']],
    ['Billing', ['Purchase History']],
  ],
  instructor: [
    ['Overview', ['Overview']],
    ['Teaching', ['Courses', 'Curriculum', 'Live Sessions', 'Certificates']],
    ['Insights', ['Performance', 'Reviews & Ratings']],
    ['Commerce', ['Coupons & Discounts']],
    ['Account', ['Profile']],
  ],
  admin: [
    ['Overview', ['Overview']],
    ['People', ['User Management', 'Enrollments']],
    ['Learning', ['Categories', 'Courses', 'Curriculum', 'Certificates', 'Reviews & Ratings']],
    ['Commerce', ['Orders', 'Coupons & Discounts']],
    ['Engagement', ['Webinars', 'Campaigns']],
    ['System', ['Settings']],
  ],
  'super-admin': [
    ['Overview', ['Overview']],
    ['Governance', ['Module Management', 'Roles & Permissions', 'Admin Accounts', 'Audit Logs']],
    ['Learning', ['Certificates', 'Enrollments']],
    ['Commerce', ['Coupons & Discounts']],
    ['System', ['Integrations', 'Settings']],
  ],
};

export const navLabel = (item) => (Array.isArray(item) ? item[0] : item.label);
export const navIcon = (item) => (Array.isArray(item) ? item[1] : item.icon);

/** Splits a role's (already access-filtered) nav items into display sections. */
export const groupNav = (role, items) => {
  const groups = NAV_GROUPS[role] || [];
  const used = new Set();
  const sections = groups
    .map(([title, labels]) => {
      const sectionItems = items.filter((it) => labels.includes(navLabel(it)));
      sectionItems.forEach((it) => used.add(navLabel(it)));
      return { title, items: sectionItems };
    })
    .filter((s) => s.items.length > 0);
  const rest = items.filter((it) => !used.has(navLabel(it)));
  if (rest.length) sections.push({ title: 'More', items: rest });
  return sections;
};

/** URL for a nav item — identical to the routes the sidebar has always used. */
export const routeFor = (role, label, path) => {
  if (path) return `/dashboard/${role}${path}`;
  switch (label) {
    case 'My Certificates':
      return `/dashboard/${role}/certificates`;
    case 'Certificates':
      return `/dashboard/${role}/certificates/admin`;
    case 'Course Catalogue':
      return `/dashboard/${role}/catalog`;
    case 'My Cart':
      return '/cart';
    case 'My Learning':
      return '/my-learning';
    case 'Purchase History':
    case 'Order History':
    case 'Orders':
      return `/dashboard/${role}/orders`;
    case 'Enrollments':
      return `/dashboard/${role}/enrollments`;
    case 'Coupons & Discounts':
      return `/dashboard/${role}/coupons`;
    case 'Reviews & Ratings':
      return `/dashboard/${role}/reviews`;
    case 'User Management':
      return `/dashboard/${role}/users`;
    case 'Categories':
      return `/dashboard/${role}/categories`;
    case 'Curriculum':
      return `/dashboard/${role}/curriculum`;
    case 'Performance':
      return `/dashboard/${role}/performance`;
    case 'My Courses':
    case 'Courses':
      return `/dashboard/${role}/courses`;
    case 'Webinars':
      return `/dashboard/${role}/webinars`;
    case 'Campaigns':
      return `/dashboard/${role}/campaigns/sms`;
    case 'Profile':
      return `/dashboard/${role}/profile`;
    case 'Module Management':
      return `/dashboard/${role}/modules`;
    case 'Admin Accounts':
      return `/dashboard/${role}/admin-accounts`;
    case 'Roles & Permissions':
      return `/dashboard/${role}/roles-permissions`;
    case 'Audit Logs':
      return `/dashboard/${role}/audit-logs`;
    case 'Settings':
      return `/dashboard/${role}/settings`;
    default:
      return `/dashboard/${role}`;
  }
};

/** Access-filtered nav items for a role (same rules the sidebar always applied). */
export const visibleNavItems = (role, accessFor) =>
  (navByRole[role] || [])
    .map((item) =>
      item && item.subItems
        ? { ...item, subItems: item.subItems.filter((sub) => accessFor(MODULE_BY_LABEL[sub.label]) !== 'none') }
        : item,
    )
    .filter((item) =>
      item && item.subItems
        ? item.subItems.length > 0
        : accessFor(MODULE_BY_LABEL[navLabel(item)]) !== 'none',
    );
