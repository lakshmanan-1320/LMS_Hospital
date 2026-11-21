/**
 * Centralized API endpoints for the LMS platform
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER_STUDENT: '/auth/register',
    REGISTER_INSTRUCTOR: '/auth/instructor/register',
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    ME: '/auth/me',
  },
  HEALTH: '/health',
  DASHBOARD: {
    OVERVIEW: '/dashboard/overview',
  },
  CATEGORIES: {
    BASE: '/categories',
    TREE: '/categories/tree',
    BY_ID: (id) => `/categories/${id}`,
    BY_SLUG: (slug) => `/categories/slug/${slug}`,
    STATUS: (id) => `/categories/${id}/status`,
  },
  CURRICULUM: {
    COURSES: '/curriculum/courses',
    COURSE_CURRICULUM: (courseId) => `/curriculum/courses/${courseId}`,
    SECTIONS: (courseId) => `/curriculum/courses/${courseId}/sections`,
    SECTION: (sectionId) => `/curriculum/sections/${sectionId}`,
    REORDER_SECTIONS: (courseId) => `/curriculum/courses/${courseId}/sections/reorder`,
    LESSONS: (sectionId) => `/curriculum/sections/${sectionId}/lessons`,
    LESSON: (lessonId) => `/curriculum/lessons/${lessonId}`,
    REORDER_LESSONS: (sectionId) => `/curriculum/sections/${sectionId}/lessons/reorder`,
    UPLOAD_MEDIA: (courseId) => `/curriculum/courses/${courseId}/media`,
    COURSE_MEDIA: (courseId) => `/curriculum/courses/${courseId}/media`,
    RETRY_MEDIA: (assetId) => `/curriculum/media/${assetId}/retry`,
    RESOURCES: (lessonId) => `/curriculum/lessons/${lessonId}/resources`,
    RESOURCE: (lessonId, resourceId) =>
      `/curriculum/lessons/${lessonId}/resources/${resourceId}`,
    REPLACEMENT: {
      CREATE: (courseId, lessonId) =>
        `/curriculum/courses/${courseId}/lessons/${lessonId}/replacement-request`,
      MY: '/curriculum/replacement-requests/my',
      ADMIN: '/curriculum/replacement-requests/admin',
      GET: (id) => `/curriculum/replacement-requests/${id}`,
      REVIEW: (id) => `/curriculum/replacement-requests/${id}/review`,
      UPLOAD: (id) => `/curriculum/replacement-requests/${id}/upload`,
      APPLY: (id) => `/curriculum/replacement-requests/${id}/apply`,
    },
  },
  COURSES: {
    BASE: '/courses',
    MY: '/courses/my',
    MY_STATS: '/courses/my/stats',
    ADMIN: '/courses/admin',
    LANGUAGES: '/courses/languages',
    UPLOAD_THUMBNAIL: '/courses/upload-thumbnail',
    UPLOAD_PROMO_VIDEO: (id) => `/courses/${id}/upload-promo-video`,
    BY_ID: (id) => `/courses/${id}`,
    CHECKLIST: (id) => `/courses/${id}/checklist`,
    CATALOG: '/courses/catalog',
    // Public course landing page and related courses
    LANDING: (idOrSlug) => `/courses/${encodeURIComponent(idOrSlug)}/landing`,
    RELATED: (idOrSlug) => `/courses/${encodeURIComponent(idOrSlug)}/related`,
  },
  ENROLLMENTS: {
    BASE: '/enrollments',
    ENROLL: (courseId) => `/enrollments/${courseId}`,
    MY: '/enrollments/my',
    STATUS: (courseId) => `/enrollments/${courseId}/status`,
    ADMIN: {
      STATS: '/enrollments/admin/stats',
      LIST: '/enrollments/admin',
      MANUAL_ENROLL: '/enrollments/admin/manual-enroll',
      UPDATE_STATUS: (id) => `/enrollments/admin/${id}/status`,
      DETAILS: (id) => `/enrollments/admin/${id}`,
      STUDENTS: '/enrollments/admin/students',
      COURSES: '/enrollments/admin/courses',
    },
  },
  CART: {
    BASE: '/cart',
    ITEMS: '/cart/items',
    ITEM_BY_ID: (courseId) => `/cart/items/${courseId}`,
    CLEAR: '/cart',
    ENROLL_FREE: (courseId) => `/cart/enroll-free/${courseId}`,
    COUPON: '/cart/coupon',
    AVAILABLE_COUPONS: '/cart/available-coupons',
  },
  PAYMENTS: {
    CREATE_ORDER: '/payments/orders',
    VERIFY: '/payments/verify',
    MOCK_SIMULATE: '/payments/mock/simulate',
    TRANSACTIONS: '/payments/transactions',
    TRANSACTION_BY_ID: (identifier) => `/payments/transactions/${encodeURIComponent(identifier)}`,
  },
  ORDERS: {
    CHECKOUT: '/orders/checkout',
    MY_ORDERS: '/orders',
    BY_ID: (identifier) => `/orders/${encodeURIComponent(identifier)}`,
    INVOICE: (identifier) => `/orders/${encodeURIComponent(identifier)}/invoice`,
    ADMIN_ALL: '/orders/admin/all',
  },
  REFUNDS: {
    REQUEST: '/refunds/request',
    MY_REFUNDS: '/refunds',
    BY_ID: (identifier) => `/refunds/${encodeURIComponent(identifier)}`,
    ELIGIBILITY: (orderId) => `/refunds/orders/${encodeURIComponent(orderId)}/eligibility`,
    ADMIN_ALL: '/refunds/admin/all',
    ADMIN_REVIEW: (id) => `/refunds/${encodeURIComponent(id)}/review`,
    ADMIN_AUDIT_LEDGER: '/refunds/admin/audit-ledger',
  },
  COUPONS: {
    BASE: '/coupons',
    BY_ID: (id) => `/coupons/${id}`,
    COURSE_COUPON: (courseId) => `/coupons/course/${courseId}`,
    MY_COURSES: '/coupons/my-courses',
    VALIDATE: '/coupons/validate',
  },
  STUDENT_LEARNING: {
    PUBLIC_COURSE_DETAILS: (idOrSlug) =>
      `/student-learning/public/courses/${encodeURIComponent(idOrSlug)}`,

    // Guest playback of free-preview lessons
    PUBLIC_LESSON_MEDIA: (lessonId) =>
      `/student-learning/public/lessons/${encodeURIComponent(lessonId)}/media`,

    COURSE_DETAILS: (idOrSlug) =>
      `/student-learning/courses/${encodeURIComponent(idOrSlug)}`,

    COURSE_PROGRESS: (idOrSlug) =>
      `/student-learning/courses/${encodeURIComponent(idOrSlug)}/progress`,

    LESSON_DETAILS: (lessonId) =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}`,

    LESSON_MEDIA: (lessonId) =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}/media`,

    LESSON_HLS: (lessonId, file = 'master.m3u8') =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}/hls/${file}`,

    UPDATE_PROGRESS: (lessonId) =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}/progress`,

    COMPLETE_LESSON: (lessonId) =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}/complete`,

    ACTIVITY: '/student-learning/activity',

    LESSON_RESOURCES: (lessonId) =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}/resources`,

    DOWNLOAD_RESOURCE: (lessonId, resourceId) =>
      `/student-learning/lessons/${encodeURIComponent(lessonId)}/resources/${encodeURIComponent(resourceId)}/download`,
  },
  COURSE_APPROVAL: {
    QUEUE: '/course-approval/queue',
    STATS: '/course-approval/stats',
    REVIEW: (id) => `/course-approval/${id}/review`,
    HISTORY: (id) => `/course-approval/${id}/history`,
    SUBMIT: (id) => `/course-approval/${id}/submit`,
    WITHDRAW: (id) => `/course-approval/${id}/withdraw`,
    APPROVE: (id) => `/course-approval/${id}/approve`,
    REJECT: (id) => `/course-approval/${id}/reject`,
    PUBLISH: (id) => `/course-approval/${id}/publish`,
    ARCHIVE: (id) => `/course-approval/${id}/archive`,
    RESTORE: (id) => `/course-approval/${id}/restore`,
    FEATURED: (id) => `/course-approval/${id}/featured`,
  },
  INSTRUCTORS: {
    ME: '/instructors/me',
    UPDATE_ME: '/instructors/me',
    UPLOAD_AVATAR: '/instructors/me/avatar',
    MY_LEARNERS: '/instructors/me/learners',
    DIRECTORY: '/instructors',
    BY_ID: (userId) => `/instructors/${userId}`,
    ADMIN_UPDATE: (userId) => `/instructors/${userId}`,
    ADMIN_VISIBILITY: (userId) => `/instructors/${userId}/visibility`,
  },
  WEBINARS: {
    PUBLIC_DIRECTORY: '/webinars/public',
    PUBLIC_BY_SLUG: (slug) => `/webinars/public/${slug}`,
    REGISTRATION_FIELDS: '/webinars/registration-fields',
    REGISTER: (webinarId) => `/webinars/${webinarId}/register`,
    RESEND_CONFIRMATION: (webinarId) => `/webinars/${webinarId}/resend-confirmation`,
    JOIN_TOKEN: (webinarId) => `/webinars/${webinarId}/join-token`,
    ATTENDANCE_JOIN: (webinarId) => `/webinars/${webinarId}/attendance/join`,
    ATTENDANCE_LEAVE: (webinarId) => `/webinars/${webinarId}/attendance/leave`,
    ADMIN_CREATE: '/webinars',
    ADMIN_LIST: '/webinars/admin',
    UPLOAD_COVER: '/webinars/upload-cover',
    ADMIN_DETAILS: (webinarId) => `/webinars/admin/${webinarId}`,
    ADMIN_UPDATE: (webinarId) => `/webinars/admin/${webinarId}`,
    ADMIN_RESCHEDULE: (webinarId) => `/webinars/admin/${webinarId}/reschedule`,
    ADMIN_CANCEL: (webinarId) => `/webinars/admin/${webinarId}/cancel`,
    ADMIN_REGISTRANTS: (webinarId) => `/webinars/admin/${webinarId}/registrants`,
    ADMIN_ANALYTICS: (webinarId) => `/webinars/admin/${webinarId}/analytics`,
    HOST_JOIN: (webinarId) => `/webinars/${webinarId}/host-join`,
    HOST_START: (webinarId) => `/webinars/${webinarId}/start`,
    HOST_END: (webinarId) => `/webinars/${webinarId}/end`,
    PROVIDERS_STATUS: '/webinars/providers/status',
    PROVIDERS_GOOGLE_AUTH_URL: '/webinars/providers/google/auth-url',
    PROVIDERS_GOOGLE_CALLBACK: '/webinars/providers/google/callback',
    PROVIDERS_GOOGLE_DISCONNECT: '/webinars/providers/google/disconnect',
    PROVIDERS_GOOGLE_TEST: '/webinars/providers/google/test',
    PROVIDERS_ZOOM_AUTH_URL: '/webinars/providers/zoom/auth-url',
    PROVIDERS_ZOOM_CALLBACK: '/webinars/providers/zoom/callback',
    PROVIDERS_ZOOM_TEST: '/webinars/providers/zoom/test',
    PROVIDERS_ZOOM_DISCONNECT: '/webinars/providers/zoom/disconnect',
    PROVIDERS_ZOHO_AUTH_URL: '/webinars/providers/zoho/auth-url',
    PROVIDERS_ZOHO_CALLBACK: '/webinars/providers/zoho/callback',
    PROVIDERS_ZOHO_TEST: '/webinars/providers/zoho/test',
    PROVIDERS_ZOHO_DISCONNECT: '/webinars/providers/zoho/disconnect',
  },
  // Governance (Super Admin): Dynamic Module Management
  PLATFORM_MODULES: {
    BASE: '/platform-modules',
    PUBLIC_CONFIG: '/platform-modules/public-config',
    MY_ACCESS: '/platform-modules/my-access',
    AUDIT_LOGS: '/platform-modules/audit-logs',
    BY_KEY: (key) => `/platform-modules/${encodeURIComponent(key)}`,
    IMPACT: (key) => `/platform-modules/${encodeURIComponent(key)}/impact`,
  },
  // Governance (Super Admin): role permission sets
  ROLES_PERMISSIONS: {
    BASE: '/roles-permissions',
    ROLE: (roleName) => `/roles-permissions/roles/${encodeURIComponent(roleName)}`,
  },
  // Governance (Super Admin): unified audit trail
  AUDIT_LOGS: {
    BASE: '/audit-logs',
    SOURCES: '/audit-logs/sources',
  },
  USERS: {
    BASE: '/users',
    BY_ID: (id) => `/users/${encodeURIComponent(id)}`,
    STATUS: (id) => `/users/${encodeURIComponent(id)}/status`,
  },
  SETTINGS: {
    INTEGRATIONS: '/settings/integrations',
    COURSE_BADGES: '/settings/course-badges',
    GOOGLE_OAUTH: '/settings/google-oauth',
    ZOOM_OAUTH: '/settings/zoom-oauth',
    ZOHO_OAUTH: '/settings/zoho-oauth',
    REFUND_POLICY: '/settings/refund-policy',
    REFUND_POLICY_COURSES: '/settings/refund-policy/courses',
    REFUND_POLICY_COURSES_BULK: '/settings/refund-policy/courses/bulk',
    REFUND_POLICY_COURSE_BY_ID: (id) => `/settings/refund-policy/courses/${encodeURIComponent(id)}`,
  },
  CAMPAIGNS: {
    BASE: '/campaigns',
    BY_ID: (id) => `/campaigns/${id}`,
    SMS_CONFIG: '/campaigns/sms/config',
    SMS_CONFIG_TEST: '/campaigns/sms/config/test',
    SMS_TEMPLATES: '/campaigns/sms/templates',
    SMS_TEMPLATE_BY_ID: (id) => `/campaigns/sms/templates/${id}`,
    SMS_TEMPLATE_SOURCES: '/campaigns/sms/templates/sources',
    AUDIENCE_WEBINARS: '/campaigns/audiences/webinars',
    AUDIENCE_WEBINAR_PREVIEW: (id, countryCode) =>
      `/campaigns/audiences/webinars/${id}/preview${countryCode ? `?countryCode=${countryCode}` : ''}`,
    SMS_SEND_BULK: '/campaigns/sms/send-bulk',
    SMS_OUTBOX_LOGS: '/campaigns/sms/outbox/logs',
    SMS_SYNC_STATUSES: '/campaigns/sms/sync-statuses',
    // Email Campaigns (Phase 2)
    EMAIL_CONFIG: '/campaigns/email/config',
    EMAIL_CONFIG_TEST: '/campaigns/email/config/test',
    EMAIL_TEMPLATES: '/campaigns/email/templates',
    EMAIL_TEMPLATE_PRESETS: '/campaigns/email/templates/presets',
    EMAIL_TEMPLATE_BY_ID: (id) => `/campaigns/email/templates/${id}`,
    EMAIL_AUDIENCE_COUNT: (targetType) => `/campaigns/email/audiences/count?target_type=${targetType}`,
    EMAIL_SEND_BULK: '/campaigns/email/send-bulk',
    EMAIL_LIST: '/campaigns/email',
    EMAIL_OUTBOX_LOGS: '/campaigns/email/outbox/logs',
    // WhatsApp Meta Campaigns
    WHATSAPP_CONFIG: '/campaigns/whatsapp/config',
    WHATSAPP_CONFIG_TEST: '/campaigns/whatsapp/config/test',
    WHATSAPP_TEMPLATES: '/campaigns/whatsapp/templates',
    WHATSAPP_TEMPLATES_SYNC: '/campaigns/whatsapp/templates/sync',
    WHATSAPP_AUDIENCES_WEBINARS: '/campaigns/whatsapp/audiences/webinars',
    WHATSAPP_SEND_BULK: '/campaigns/whatsapp/send-bulk',
    WHATSAPP_LIST: '/campaigns/whatsapp',
    WHATSAPP_OUTBOX_LOGS: '/campaigns/whatsapp/outbox/logs',
    WHATSAPP_OUTBOX_STATS: '/campaigns/whatsapp/outbox/stats',
  },
  REVIEWS: {
    // Public
    SUMMARY: (courseIdOrSlug) => `/courses/${encodeURIComponent(courseIdOrSlug)}/reviews/summary`,
    LIST_FOR_COURSE: (courseIdOrSlug) => `/courses/${encodeURIComponent(courseIdOrSlug)}/reviews`,

    // Student
    MY_REVIEW: (courseIdOrSlug) => `/courses/${encodeURIComponent(courseIdOrSlug)}/reviews/my-review`,
    CREATE_FOR_COURSE: (courseIdOrSlug) => `/courses/${encodeURIComponent(courseIdOrSlug)}/reviews`,
    UPDATE: (reviewId) => `/reviews/${encodeURIComponent(reviewId)}`,
    DELETE: (reviewId) => `/reviews/${encodeURIComponent(reviewId)}`,

    // Instructor
    INSTRUCTOR_LIST: '/instructor/reviews',
    INSTRUCTOR_REPLY: (reviewId) => `/reviews/${encodeURIComponent(reviewId)}/reply`,
    INSTRUCTOR_DELETE_REPLY: (reviewId) => `/reviews/${encodeURIComponent(reviewId)}/reply`,

    // Admin
    ADMIN_LIST: '/admin/reviews',
    ADMIN_MODERATE: (reviewId) => `/admin/reviews/${encodeURIComponent(reviewId)}/moderate`,
    ADMIN_DELETE: (reviewId) => `/admin/reviews/${encodeURIComponent(reviewId)}`,
  },
  CERTIFICATES: {
    PUBLIC_VERIFY: (token) => `/certificates/public/verify/${encodeURIComponent(token)}`,
    MY: '/certificates/my',
    CLAIM: (courseId) => `/certificates/courses/${encodeURIComponent(courseId)}/claim`,
    DOWNLOAD: (id) => `/certificates/${encodeURIComponent(id)}/download`,
    VIEW: (id) => `/certificates/${encodeURIComponent(id)}/view`,
    WEBINAR_SETTINGS: (webinarId) => `/certificates/webinars/${encodeURIComponent(webinarId)}/settings`,
    ADMIN: {
      OVERVIEW: '/certificates/admin/overview',
      LIST: '/certificates/admin/list',
      ATTENDANCE_REPORT: (webinarId) => `/certificates/admin/webinars/${encodeURIComponent(webinarId)}/attendance-report`,
      CORRECT_ATTENDANCE: '/certificates/admin/webinars/correct-attendance',
      MANUAL_ISSUE: '/certificates/admin/webinars/manual-issue',
      REVOKE: (id) => `/certificates/admin/${encodeURIComponent(id)}/revoke`,
      REISSUE: (id) => `/certificates/admin/${encodeURIComponent(id)}/reissue`,
      TEMPLATES: '/certificates/admin/templates',
      CREATE_TEMPLATE: '/certificates/admin/templates',
      UPDATE_TEMPLATE: (id) => `/certificates/admin/templates/${encodeURIComponent(id)}`,
      DETAILS: (id) => `/certificates/admin/${encodeURIComponent(id)}`,
    },
  },
};
