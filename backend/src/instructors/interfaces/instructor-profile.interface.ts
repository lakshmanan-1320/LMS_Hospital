export interface QualificationItem {
  title: string;
  issuer: string;
  year?: number | null;
  description?: string | null;
}

export interface InstructorProfileRow {
  profile_id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  experience_years: number | null;
  qualifications: QualificationItem[];
  expertise: string[];
  skills: string[];
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  // Joined user fields
  first_name?: string;
  last_name?: string;
  email?: string;
}

/** Full profile response for authenticated owner/admin */
export interface InstructorProfileResponse {
  profileId: string;
  userId: string;
  slug: string | null;
  firstName: string;
  lastName: string;
  email: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  experienceYears: number | null;
  qualifications: QualificationItem[];
  expertise: string[];
  skills: string[];
  websiteUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  isPublic: boolean;
  totalCourses: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Strictly public profile response - NO private user fields or email */
export interface PublicInstructorProfileResponse {
  userId: string;
  slug: string | null;
  firstName: string;
  lastName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  experienceYears: number | null;
  qualifications: QualificationItem[];
  expertise: string[];
  skills: string[];
  websiteUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  totalCourses: number;
}

/** Lightweight directory item for search and public listing */
export interface InstructorDirectoryItem {
  userId: string;
  slug: string | null;
  firstName: string;
  lastName: string;
  headline: string | null;
  avatarUrl: string | null;
  experienceYears: number | null;
  expertise: string[];
  skills: string[];
  totalCourses: number;
}

export interface PaginatedInstructorsResponse {
  items: InstructorDirectoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

