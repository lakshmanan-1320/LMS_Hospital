import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { InstructorsRepository } from './instructors.repository';
import {
  InstructorProfileResponse,
  PublicInstructorProfileResponse,
  PaginatedInstructorsResponse,
} from './interfaces/instructor-profile.interface';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';
import { QueryInstructorsDto } from './dto/query-instructors.dto';
import { saveAvatarSecurely } from './utils/avatar-security.util';

@Injectable()
export class InstructorsService {
  private readonly logger = new Logger(InstructorsService.name);

  constructor(private readonly repository: InstructorsRepository) {}

  /**
   * 1. GET OWN INSTRUCTOR PROFILE (Instructor self-management)
   * Auto-provisions a blank profile with is_public=false if not created yet.
   */
  async getMyProfile(userId: string): Promise<InstructorProfileResponse> {
    let profile = await this.repository.findByUserId(userId);
    if (!profile) {
      await this.repository.createDefaultProfile(userId);
      profile = await this.repository.findByUserId(userId);
    }

    if (!profile) {
      throw new NotFoundException('Instructor account not found');
    }

    return profile;
  }

  /**
   * 2. UPDATE OWN INSTRUCTOR PROFILE (Instructor self-management)
   * Supports partial updates without clearing existing fields.
   */
  async updateMyProfile(
    userId: string,
    dto: UpdateInstructorProfileDto,
  ): Promise<InstructorProfileResponse> {
    await this.repository.upsertProfile(userId, dto);
    const updated = await this.repository.findByUserId(userId);
    if (!updated) {
      throw new NotFoundException('Instructor account not found');
    }
    return updated;
  }

  /**
   * 3. UPLOAD PROFILE AVATAR (Secure file validation & storage)
   * Enforces 2MB limit, magic-byte inspection, random filenames, and safe storage.
   */
  async uploadAvatar(
    userId: string,
    fileBuffer: Buffer,
  ): Promise<{ avatarUrl: string }> {
    const existing = await this.repository.findByUserId(userId);
    const targetDir = path.join(process.cwd(), 'uploads', 'avatars');

    // Securely validate and save image
    const { publicUrl } = await saveAvatarSecurely(fileBuffer, targetDir);

    // Save avatar URL in DB
    await this.repository.updateAvatar(userId, publicUrl);

    // Optionally cleanup old avatar file if it was locally uploaded
    if (existing?.avatarUrl && existing.avatarUrl.startsWith('/uploads/avatars/')) {
      const oldFilename = path.basename(existing.avatarUrl);
      const oldPath = path.join(targetDir, oldFilename);
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (err) {
        this.logger.warn(`Could not remove old avatar at ${oldPath}: ${err.message}`);
      }
    }

    return { avatarUrl: publicUrl };
  }

  /**
   * 4. GET PUBLIC INSTRUCTOR PROFILE
   * Exposes public profile by human-readable slug OR user_id.
   * Only accessible when is_public = true (or caller is admin with instructors:manage).
   * Never leaks email or private identity.
   */
  async getPublicProfile(
    identifier: string,
    callerPermissions: string[] = [],
  ): Promise<PublicInstructorProfileResponse> {
    const isAdmin = callerPermissions.includes('instructors:manage');

    if (isAdmin) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      const full = isUuid
        ? await this.repository.findByUserId(identifier)
        : await this.repository.findPublicByIdOrSlug(identifier);

      if (!full) {
        throw new NotFoundException('Instructor profile not found');
      }
      return {
        userId: full.userId,
        slug: full.slug || null,
        firstName: full.firstName,
        lastName: full.lastName,
        headline: full.headline,
        bio: full.bio,
        avatarUrl: full.avatarUrl,
        experienceYears: full.experienceYears,
        qualifications: full.qualifications,
        expertise: full.expertise,
        skills: full.skills,
        websiteUrl: full.websiteUrl,
        linkedinUrl: full.linkedinUrl,
        githubUrl: full.githubUrl,
        twitterUrl: full.twitterUrl,
        youtubeUrl: full.youtubeUrl,
        facebookUrl: full.facebookUrl,
        totalCourses: full.totalCourses,
      };
    }

    const publicProfile = await this.repository.findPublicByIdOrSlug(identifier);
    if (!publicProfile) {
      throw new NotFoundException('Instructor profile not found or is private');
    }

    return publicProfile;
  }

  /**
   * 5. GET PUBLIC INSTRUCTORS DIRECTORY
   * Paginated, sorted, and filtered search across public instructors only.
   */
  async getDirectory(
    query: QueryInstructorsDto,
  ): Promise<PaginatedInstructorsResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));

    const { items, total } = await this.repository.findDirectory(query);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * 6. ADMIN: UPDATE ANY INSTRUCTOR PROFILE
   * Requires dynamic permission 'instructors:manage'.
   */
  async adminUpdateProfile(
    targetUserId: string,
    dto: UpdateInstructorProfileDto,
  ): Promise<InstructorProfileResponse> {
    await this.repository.upsertProfile(targetUserId, dto);
    const updated = await this.repository.findByUserId(targetUserId);
    if (!updated) {
      throw new NotFoundException('Instructor account not found');
    }
    return updated;
  }

  /**
   * 7. ADMIN: SET PROFILE VISIBILITY (Moderation control)
   * Requires dynamic permission 'instructors:manage'.
   */
  async adminSetVisibility(
    targetUserId: string,
    isPublic: boolean,
  ): Promise<InstructorProfileResponse> {
    await this.repository.updateVisibility(targetUserId, isPublic);
    const updated = await this.repository.findByUserId(targetUserId);
    if (!updated) {
      throw new NotFoundException('Instructor account not found');
    }
    return updated;
  }

  /**
   * 8. GET INSTRUCTOR'S ENROLLED LEARNERS
   */
  async getMyLearners(instructorId: string) {
    return this.repository.findLearnersByInstructor(instructorId);
  }
}

