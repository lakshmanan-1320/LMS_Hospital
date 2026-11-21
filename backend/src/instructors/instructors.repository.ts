import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  InstructorProfileRow,
  InstructorProfileResponse,
  PublicInstructorProfileResponse,
  InstructorDirectoryItem,
} from './interfaces/instructor-profile.interface';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';
import { QueryInstructorsDto } from './dto/query-instructors.dto';

@Injectable()
export class InstructorsRepository {
  private readonly logger = new Logger(InstructorsRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Fetch full instructor profile by user_id for owner or admin.
   * Auto-joins users table for names and email.
   * Calculates live published courses count.
   */
  async findByUserId(userId: string): Promise<InstructorProfileResponse | null> {
    const sql = `
      SELECT
        ip.profile_id,
        u.user_id,
        ip.slug,
        u.first_name,
        u.last_name,
        u.email,
        ip.headline,
        ip.bio,
        ip.avatar_url,
        ip.experience_years,
        COALESCE(ip.qualifications, '[]'::jsonb) AS qualifications,
        COALESCE(ip.expertise, '{}'::text[]) AS expertise,
        COALESCE(ip.skills, '{}'::text[]) AS skills,
        ip.website_url,
        ip.linkedin_url,
        ip.github_url,
        ip.twitter_url,
        ip.youtube_url,
        ip.facebook_url,
        COALESCE(ip.is_public, false) AS is_public,
        ip.created_at,
        ip.updated_at,
        (
          SELECT COUNT(*)::int
          FROM courses c
          WHERE c.instructor_id = u.user_id
            AND c.status = 'published'
            AND c.is_active = true
            AND c.deleted_at IS NULL
        ) AS total_courses
      FROM users u
      LEFT JOIN instructor_profiles ip ON u.user_id = ip.user_id
      WHERE u.user_id = $1
        AND u.is_active = true
        AND u.deleted_at IS NULL
      LIMIT 1;
    `;

    const res = await this.db.query(sql, [userId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      profileId: row.profile_id,
      userId: row.user_id,
      slug: row.slug || null,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      headline: row.headline,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      experienceYears: row.experience_years,
      qualifications: row.qualifications || [],
      expertise: row.expertise || [],
      skills: row.skills || [],
      websiteUrl: row.website_url,
      linkedinUrl: row.linkedin_url,
      githubUrl: row.github_url,
      twitterUrl: row.twitter_url,
      youtubeUrl: row.youtube_url,
      facebookUrl: row.facebook_url,
      isPublic: Boolean(row.is_public),
      totalCourses: Number(row.total_courses) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Initializes a default profile record if one does not exist yet.
   * is_public is strictly false by default, and slug is auto-generated from user names.
   */
  async createDefaultProfile(userId: string): Promise<void> {
    const sql = `
      INSERT INTO instructor_profiles (user_id, slug, is_public)
      SELECT
        u.user_id,
        COALESCE(
          NULLIF(LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(u.first_name || '-' || u.last_name), '[^a-zA-Z0-9\\s-]', '', 'g'), '[\\s_-]+', '-', 'g')), ''),
          'instructor-' || SUBSTRING(u.user_id::text, 1, 8)
        ),
        false
      FROM users u
      WHERE u.user_id = $1
      ON CONFLICT (user_id) DO NOTHING;
    `;
    await this.db.query(sql, [userId]);
  }

  /**
   * Partial profile update.
   * Builds dynamic parameterized SET clause so only provided fields are touched.
   */
  async upsertProfile(
    userId: string,
    dto: UpdateInstructorProfileDto,
  ): Promise<void> {
    // Ensure row exists
    await this.createDefaultProfile(userId);

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.slug !== undefined) {
      setClauses.push(`slug = $${paramIndex++}`);
      values.push(dto.slug.trim().toLowerCase());
    }
    if (dto.headline !== undefined) {
      setClauses.push(`headline = $${paramIndex++}`);
      values.push(dto.headline);
    }
    if (dto.bio !== undefined) {
      setClauses.push(`bio = $${paramIndex++}`);
      values.push(dto.bio);
    }
    if (dto.experienceYears !== undefined) {
      setClauses.push(`experience_years = $${paramIndex++}`);
      values.push(dto.experienceYears);
    }
    if (dto.qualifications !== undefined) {
      setClauses.push(`qualifications = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(dto.qualifications));
    }
    if (dto.expertise !== undefined) {
      setClauses.push(`expertise = $${paramIndex++}::text[]`);
      values.push(dto.expertise);
    }
    if (dto.skills !== undefined) {
      setClauses.push(`skills = $${paramIndex++}::text[]`);
      values.push(dto.skills);
    }
    if (dto.websiteUrl !== undefined) {
      setClauses.push(`website_url = $${paramIndex++}`);
      values.push(dto.websiteUrl);
    }
    if (dto.linkedinUrl !== undefined) {
      setClauses.push(`linkedin_url = $${paramIndex++}`);
      values.push(dto.linkedinUrl);
    }
    if (dto.githubUrl !== undefined) {
      setClauses.push(`github_url = $${paramIndex++}`);
      values.push(dto.githubUrl);
    }
    if (dto.twitterUrl !== undefined) {
      setClauses.push(`twitter_url = $${paramIndex++}`);
      values.push(dto.twitterUrl);
    }
    if (dto.youtubeUrl !== undefined) {
      setClauses.push(`youtube_url = $${paramIndex++}`);
      values.push(dto.youtubeUrl);
    }
    if (dto.facebookUrl !== undefined) {
      setClauses.push(`facebook_url = $${paramIndex++}`);
      values.push(dto.facebookUrl);
    }
    if (dto.isPublic !== undefined) {
      setClauses.push(`is_public = $${paramIndex++}`);
      values.push(dto.isPublic);
    }

    if (setClauses.length === 0) {
      return; // Nothing to update
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);
    const userIdIndex = paramIndex;

    const sql = `
      UPDATE instructor_profiles
      SET ${setClauses.join(', ')}
      WHERE user_id = $${userIdIndex};
    `;

    await this.db.query(sql, values);
  }

  /**
   * Update profile avatar URL.
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.createDefaultProfile(userId);
    const sql = `
      UPDATE instructor_profiles
      SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2;
    `;
    await this.db.query(sql, [avatarUrl, userId]);
  }

  /**
   * Update visibility flag (for admin moderation or instructor toggle).
   */
  async updateVisibility(userId: string, isPublic: boolean): Promise<void> {
    await this.createDefaultProfile(userId);
    const sql = `
      UPDATE instructor_profiles
      SET is_public = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2;
    `;
    await this.db.query(sql, [isPublic, userId]);
  }

  /**
   * Fetch public profile by human-readable slug OR user_id.
   * Strictly verifies is_public = true, user is active, not deleted.
   * Never selects email, password_hash, or internal flags.
   */
  async findPublicByIdOrSlug(
    idOrSlug: string,
  ): Promise<PublicInstructorProfileResponse | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const identifierClause = isUuid ? `(ip.user_id::text = $1 OR ip.slug = $1)` : `ip.slug = $1`;

    const sql = `
      SELECT
        u.user_id,
        ip.slug,
        u.first_name,
        u.last_name,
        ip.headline,
        ip.bio,
        ip.avatar_url,
        ip.experience_years,
        COALESCE(ip.qualifications, '[]'::jsonb) AS qualifications,
        COALESCE(ip.expertise, '{}'::text[]) AS expertise,
        COALESCE(ip.skills, '{}'::text[]) AS skills,
        ip.website_url,
        ip.linkedin_url,
        ip.github_url,
        ip.twitter_url,
        ip.youtube_url,
        ip.facebook_url,
        (
          SELECT COUNT(*)::int
          FROM courses c
          WHERE c.instructor_id = u.user_id
            AND c.status = 'published'
            AND c.is_active = true
            AND c.deleted_at IS NULL
        ) AS total_courses
      FROM instructor_profiles ip
      JOIN users u ON ip.user_id = u.user_id
      WHERE ${identifierClause}
        AND ip.is_public = true
        AND u.is_active = true
        AND u.deleted_at IS NULL
      LIMIT 1;
    `;

    const res = await this.db.query(sql, [idOrSlug.trim().toLowerCase()]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      userId: row.user_id,
      slug: row.slug || null,
      firstName: row.first_name,
      lastName: row.last_name,
      headline: row.headline,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      experienceYears: row.experience_years,
      qualifications: row.qualifications || [],
      expertise: row.expertise || [],
      skills: row.skills || [],
      websiteUrl: row.website_url,
      linkedinUrl: row.linkedin_url,
      githubUrl: row.github_url,
      twitterUrl: row.twitter_url,
      youtubeUrl: row.youtube_url,
      facebookUrl: row.facebook_url,
      totalCourses: Number(row.total_courses) || 0,
    };
  }

  /** Backwards compatibility alias */
  async findPublicByUserId(userId: string): Promise<PublicInstructorProfileResponse | null> {
    return this.findPublicByIdOrSlug(userId);
  }

  /**
   * Public directory search with pagination, skill/expertise filters, and safe sorting.
   * Strictly filters for is_public = true.
   */
  async findDirectory(
    query: QueryInstructorsDto,
  ): Promise<{ items: InstructorDirectoryItem[]; total: number }> {
    const conditions: string[] = [
      `ip.is_public = true`,
      `u.is_active = true`,
      `u.deleted_at IS NULL`,
    ];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        `(u.first_name || ' ' || u.last_name ILIKE $${paramIndex} OR ip.headline ILIKE $${paramIndex} OR ip.bio ILIKE $${paramIndex})`,
      );
      params.push(term);
      paramIndex++;
    }

    if (query.skill && query.skill.trim()) {
      conditions.push(`$${paramIndex} = ANY(ip.skills)`);
      params.push(query.skill.trim());
      paramIndex++;
    }

    if (query.expertise && query.expertise.trim()) {
      conditions.push(`$${paramIndex} = ANY(ip.expertise)`);
      params.push(query.expertise.trim());
      paramIndex++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching items
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM instructor_profiles ip
      JOIN users u ON ip.user_id = u.user_id
      ${whereClause};
    `;
    const countRes = await this.db.query(countSql, params);
    const total = Number(countRes.rows[0]?.total) || 0;

    // Sorting whitelist
    const sortFieldMap: Record<string, string> = {
      name: `u.first_name, u.last_name`,
      created_at: `ip.created_at`,
      experience_years: `COALESCE(ip.experience_years, 0)`,
      total_courses: `total_courses`,
    };

    const sortBy = query.sortBy && sortFieldMap[query.sortBy]
      ? sortFieldMap[query.sortBy]
      : `ip.created_at`;
    const sortOrder = String(query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT
        u.user_id,
        ip.slug,
        u.first_name,
        u.last_name,
        ip.headline,
        ip.avatar_url,
        ip.experience_years,
        COALESCE(ip.expertise, '{}'::text[]) AS expertise,
        COALESCE(ip.skills, '{}'::text[]) AS skills,
        (
          SELECT COUNT(*)::int
          FROM courses c
          WHERE c.instructor_id = u.user_id
            AND c.status = 'published'
            AND c.is_active = true
            AND c.deleted_at IS NULL
        ) AS total_courses
      FROM instructor_profiles ip
      JOIN users u ON ip.user_id = u.user_id
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    params.push(limit, offset);
    const dataRes = await this.db.query(dataSql, params);

    const items: InstructorDirectoryItem[] = dataRes.rows.map((row) => ({
      userId: row.user_id,
      slug: row.slug || null,
      firstName: row.first_name,
      lastName: row.last_name,
      headline: row.headline,
      avatarUrl: row.avatar_url,
      experienceYears: row.experience_years,
      expertise: row.expertise || [],
      skills: row.skills || [],
      totalCourses: Number(row.total_courses) || 0,
    }));

    return { items, total };
  }

  /**
   * Fetch all student learners enrolled in this instructor's courses.
   */
  async findLearnersByInstructor(instructorId: string) {
    const sql = `
      SELECT
        e.enrollment_id AS "enrollmentId",
        e.student_id AS "studentId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.email,
        c.course_id AS "courseId",
        c.title AS "courseTitle",
        c.slug AS "courseSlug",
        e.enrollment_status AS "status",
        e.enrollment_type AS "type",
        COALESCE(e.progress_percent, 0) AS "progressPercent",
        e.enrolled_at AS "enrolledAt"
      FROM course_enrollments e
      JOIN courses c ON c.course_id = e.course_id
      JOIN users u ON u.user_id = e.student_id
      WHERE c.instructor_id = $1 AND c.deleted_at IS NULL
      ORDER BY e.enrolled_at DESC;
    `;
    const res = await this.db.query(sql, [instructorId]);
    return res.rows;
  }
}

