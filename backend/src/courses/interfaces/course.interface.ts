export interface CourseRow {
  course_id: string;
  instructor_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  learning_outcomes: string[];
  requirements: string[];
  target_audience: string | null;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  language: string;
  is_free: boolean;
  price: string | number;
  discount_price: string | number | null;
  currency: string;
  thumbnail_url: string | null;
  promo_video_asset_id: string | null;
  is_refundable: boolean;
  refund_period_days: number;
  average_rating?: number;
  total_reviews_count?: number;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived';
  rejection_reason: string | null;
  submitted_at: Date | string | null;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  published_at: Date | string | null;
  archived_at: Date | string | null;
  is_featured: boolean;
  is_active: boolean;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PromoVideoSafe {
  assetId: string;
  title: string;
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  durationSeconds: number | null;
  processingStatus: string;
  url?: string | null;
}

export interface CourseDetailResponse {
  courseId: string;
  instructorId: string;
  instructorName?: string;
  instructorEmail?: string;
  instructor?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  categoryId: string | null;
  categoryName?: string | null;
  categoryIsActive?: boolean | null;
  category?: {
    id: string | null;
    name: string | null;
    isActive?: boolean | null;
  } | null;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string | null;
  level: string;
  language: string;
  isFree: boolean;
  price: number;
  discountPrice: number | null;
  currency: string;
  thumbnailUrl: string | null;
  promoVideoAssetId: string | null;
  promoVideo?: PromoVideoSafe | null;
  isRefundable?: boolean;
  refundPeriodDays?: number;
  averageRating?: number;
  totalReviewsCount?: number;
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseChecklistItem {
  key: string;
  ok: boolean;
  message: string;
}

export interface CourseChecklistResponse {
  ready: boolean;
  items: CourseChecklistItem[];
}

export interface CourseStatsResponse {
  total: number;
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
  published: number;
  archived: number;
}

export interface CourseLanguageRow {
  languageId: string;
  code: string;
  name: string;
  nativeName: string | null;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

