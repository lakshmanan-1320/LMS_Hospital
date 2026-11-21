export type CourseStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'archived';

export type CourseApprovalAction =
  | 'submit'
  | 'withdraw'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'archive'
  | 'restore';

export interface TransitionRule {
  from: CourseStatus[];
  to: CourseStatus;
  requiredPermission: string;
  checklistRequired?: boolean;
}

export const COURSE_STATUS_TRANSITIONS: Record<CourseApprovalAction, TransitionRule> = {
  submit: {
    from: ['draft', 'rejected'],
    to: 'pending_review',
    requiredPermission: 'courses:edit_own',
    checklistRequired: true,
  },
  withdraw: {
    from: ['pending_review'],
    to: 'draft',
    requiredPermission: 'courses:edit_own',
  },
  approve: {
    from: ['pending_review'],
    to: 'approved',
    requiredPermission: 'courses:approve',
    checklistRequired: true,
  },
  reject: {
    from: ['pending_review'],
    to: 'rejected',
    requiredPermission: 'courses:approve',
  },
  publish: {
    from: ['approved', 'draft', 'pending_review', 'rejected'],
    to: 'published',
    requiredPermission: 'courses:publish',
  },
  archive: {
    from: ['published', 'approved'],
    to: 'archived',
    requiredPermission: 'courses:publish',
  },
  restore: {
    from: ['archived'],
    to: 'draft',
    requiredPermission: 'courses:publish',
  },
};

