import { CourseStatus } from '../constants/course-status.constants';
import { CourseChecklistResponse, CourseDetailResponse } from './course.interface';

export interface CourseStatusHistoryRow {
  history_id: string;
  course_id: string;
  from_status: CourseStatus | null;
  to_status: CourseStatus;
  changed_by: string | null;
  note: string | null;
  created_at: Date;
  changed_by_name?: string | null;
  changed_by_email?: string | null;
}

export interface ApprovalQueueRow {
  course_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  status: CourseStatus;
  level: string;
  language: string;
  is_free: boolean;
  price: string | number;
  discount_price: string | number | null;
  currency: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  category_id: string | null;
  category_name: string | null;
  instructor_id: string;
  instructor_name: string;
  instructor_email: string;
  section_count: number;
  lesson_count: number;
  total_duration_seconds: number;
}

export interface ApprovalStats {
  pending_review: number;
  approved: number;
  rejected: number;
  published: number;
  archived: number;
  draft: number;
  total: number;
}

export interface CurriculumLessonDetail {
  lessonId: string;
  sectionId: string;
  title: string;
  lessonType: string;
  durationSeconds: number;
  isPreview: boolean;
  sortOrder: number;
  assetTitle?: string | null;
  assetFileName?: string | null;
  assetProcessingStatus?: string | null;
  assetSizeBytes?: number | null;
}

export interface CurriculumSectionDetail {
  sectionId: string;
  title: string;
  sortOrder: number;
  lessons: CurriculumLessonDetail[];
}

export interface CurriculumSummary {
  sectionCount: number;
  lessonCount: number;
  totalDurationSeconds: number;
  previewLessonCount: number;
  sections?: CurriculumSectionDetail[];
}

export interface CourseReviewDetail {
  course: CourseDetailResponse;
  curriculumSummary: CurriculumSummary;
  checklist: CourseChecklistResponse;
  proposedCoupon?: any | null;
  latestHistory: CourseStatusHistoryRow[];
}

