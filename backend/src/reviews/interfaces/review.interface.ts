/**
 * Core domain interfaces for Course Reviews & Ratings module.
 * Uses meaningful identifier names throughout.
 */

export type ReviewStatus = 'published' | 'hidden' | 'flagged';
export type ReplyStatus = 'published' | 'hidden';

export interface CourseReviewRecord {
  review_id: string;
  course_id: string;
  student_id: string;
  rating: number;
  review_title: string | null;
  review_text: string | null;
  status: ReviewStatus;
  is_edited: boolean;
  moderation_reason: string | null;
  moderated_by: string | null;
  moderated_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface ReviewReplyRecord {
  review_reply_id: string;
  review_id: string;
  course_id: string;
  instructor_id: string;
  reply_text: string;
  status: ReplyStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface FormattedInstructorReply {
  reviewReplyId: string;
  reviewId: string;
  courseId: string;
  instructorId: string;
  instructorName: string;
  instructorAvatarUrl: string | null;
  replyText: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormattedCourseReview {
  reviewId: string;
  courseId: string;
  courseTitle?: string;
  courseSlug?: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  rating: number;
  reviewTitle: string | null;
  reviewText: string | null;
  status: ReviewStatus;
  isEdited: boolean;
  isOwnReview?: boolean;
  moderationReason?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  instructorReply: FormattedInstructorReply | null;
}

export interface RatingBreakdownItem {
  star: number;
  count: number;
  percentage: number;
}

export interface CourseReviewSummary {
  courseId: string;
  averageRating: number;
  totalReviews: number;
  breakdown: {
    5: RatingBreakdownItem;
    4: RatingBreakdownItem;
    3: RatingBreakdownItem;
    2: RatingBreakdownItem;
    1: RatingBreakdownItem;
  };
}

export interface PaginatedReviewsResult {
  reviews: FormattedCourseReview[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary?: CourseReviewSummary;
}
