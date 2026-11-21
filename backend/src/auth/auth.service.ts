import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { LoginValidation } from './validations/login.validation';
import { RegisterValidation } from './validations/register.validation';
import { InstructorRegisterValidation } from './validations/instructor-register.validation';
import { SendOtpValidation } from './validations/send-otp.validation';
import { VerifyOtpValidation } from './validations/verify-otp.validation';
import { ForgotPasswordValidation } from './validations/forgot-password.validation';
import { ResetPasswordValidation } from './validations/reset-password.validation';
import { CreateUserValidation } from './validations/create-user.validation';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { LoginResult, AuthUserResponse, RoleMetadata } from './interfaces/auth-result.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Pre-calculated dummy hash for anti-enumeration timing safety
  private readonly dummyHash =
    '$2b$12$e8kP0P6JjG0W1YV1ZfL1quG3mU6vUe/i3y3wZlPZz1c2m7Q9X3o.6';

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Helper: Generate SHA-256 hash of a string
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Helper: Generate 6-digit numeric OTP and log prominently in local dev
   */
  private generateAndLogDevOtp(email: string, purpose: string): { code: string; hash: string } {
    const code = crypto.randomInt(100000, 999999).toString();
    const hash = this.hashToken(code);

    // Prominent local development console output
    console.log('\n' + '='.repeat(60));
    console.log(`🔑 [DEV EMAIL OTP]`);
    console.log(`📧 To:      ${email}`);
    console.log(`🎯 Purpose: ${purpose}`);
    console.log(`👉 Code:    ${code}`);
    console.log(`⏱️  Expiry:  10 Minutes`);
    console.log('='.repeat(60) + '\n');

    return { code, hash };
  }

  /**
   * Public Student Registration (Automatic, No Admin Approval, Requires OTP)
   */
  async registerStudent(dto: RegisterValidation): Promise<{ success: boolean; message: string; email: string }> {
    return this.handlePublicRegistration(dto, 'STUDENT');
  }

  /**
   * Public Instructor Registration (Automatic, No Admin Approval, Requires OTP)
   */
  async registerInstructor(dto: InstructorRegisterValidation): Promise<{ success: boolean; message: string; email: string }> {
    return this.handlePublicRegistration(dto, 'INSTRUCTOR');
  }

  /**
   * Unified Internal Handler for Public Registrations
   */
  private async handlePublicRegistration(
    dto: RegisterValidation | InstructorRegisterValidation,
    targetRole: 'STUDENT' | 'INSTRUCTOR',
  ): Promise<{ success: boolean; message: string; email: string }> {
    const existing = await this.authRepository.findUserByEmail(dto.email);

    if (existing) {
      // Never allow a soft-deleted or deactivated account to restart registration.
      if (existing.deleted_at !== null || !existing.is_active) {
        throw new ConflictException(
          'An account with this email already exists or is unavailable.',
        );
      }

      if (existing.is_verified) {
        throw new ConflictException(
          'An account with this email already exists. Please log in.',
        );
      }

      // Existing active, unverified account: resend verification OTP in real-time.
      await this.dispatchOtpForUser(
        existing.user_id,
        existing.email,
        'EMAIL_VERIFICATION',
        existing.first_name,
      );

      return {
        success: true,
        message:
          'Account already registered. A fresh verification code has been sent to your email.',
        email: dto.email,
      };
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    let createdUserId = '';
    let generatedOtp = '';

    await this.databaseService.withTransaction(async (client) => {
      // 1. Create User with is_verified = FALSE
      const user = await this.authRepository.createUser(
        {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: true,
          isVerified: false,
        },
        client,
      );
      createdUserId = user.user_id;

      // 2. Assign specified role (STUDENT or INSTRUCTOR)
      const roleId = await this.authRepository.getRoleIdByName(targetRole, client);
      if (!roleId) {
        throw new Error(`Role [${targetRole}] not found in database.`);
      }

      await this.authRepository.assignUserRole(user.user_id, roleId, client);

      // 3. Generate 6-digit OTP
      const { code, hash } = this.generateAndLogDevOtp(dto.email, 'EMAIL_VERIFICATION');
      generatedOtp = code;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await this.authRepository.createEmailOtp(
        {
          userId: user.user_id,
          email: dto.email,
          otpHash: hash,
          purpose: 'EMAIL_VERIFICATION',
          expiresAt,
        },
        client,
      );
    });

    // 4. Send real-time verification email via SMTP
    try {
      await this.emailService.sendVerificationOtp(dto.email, generatedOtp, dto.firstName);
      this.logger.log(`Verification OTP email dispatched via SMTP to ${dto.email}`);
    } catch (mailErr: any) {
      this.logger.error(`Failed to send verification OTP email to ${dto.email}: ${mailErr.message}`);
      throw new BadRequestException(
        `Unable to dispatch verification email: ${mailErr.message}. Please verify your SMTP settings or request a new code.`,
      );
    }

    this.logger.log(`New ${targetRole} registered: ${dto.email} [ID: ${createdUserId}]. Awaiting OTP verification.`);

    return {
      success: true,
      message: `${targetRole.toLowerCase()} registration successful. Please enter the verification code sent to your email.`,
      email: dto.email,
    };
  }

  /**
   * Resend / Send Verification OTP
   */
  async sendOtp(dto: SendOtpValidation): Promise<{ success: boolean; message: string }> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user || user.deleted_at !== null || !user.is_active) {
      // Keep the response generic to prevent account enumeration.
      await bcrypt.compare('dummy_input', this.dummyHash).catch(() => null);

      return {
        success: true,
        message:
          'If an account exists with that email, a verification code has been dispatched.',
      };
    }

    if (user.is_verified) {
      return {
        success: true,
        message: 'Your email address is already verified. You can log in directly.',
      };
    }

    await this.dispatchOtpForUser(user.user_id, user.email, 'EMAIL_VERIFICATION', user.first_name);

    return {
      success: true,
      message: 'A verification code has been dispatched to your email address.',
    };
  }

  /**
   * Helper: Dispatch and save OTP
   */
  private async dispatchOtpForUser(
    userId: string,
    email: string,
    purpose: string,
    firstName?: string,
  ): Promise<string> {
    const { code, hash } = this.generateAndLogDevOtp(email, purpose);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.databaseService.withTransaction(async (client) => {
      // Invalidate old active OTPs for this email and purpose
      await this.authRepository.invalidateExistingOtps(email, purpose, client);

      // Insert new OTP
      await this.authRepository.createEmailOtp(
        {
          userId,
          email,
          otpHash: hash,
          purpose,
          expiresAt,
        },
        client,
      );
    });

    // Real-time dispatch via SMTP
    try {
      await this.emailService.sendVerificationOtp(email, code, firstName);
      this.logger.log(`OTP dispatched via SMTP to ${email} for purpose: ${purpose}`);
    } catch (mailErr: any) {
      this.logger.error(`Failed to dispatch OTP to ${email}: ${mailErr.message}`);
      throw new BadRequestException(
        `Unable to send verification email: ${mailErr.message}. Please check your SMTP settings.`,
      );
    }

    return code;
  }

  /**
   * Verify OTP (Account Activation without Auto-Login)
   */
  async verifyOtp(
    dto: VerifyOtpValidation,
  ): Promise<{ success: boolean; message: string; email: string }> {
    const otpHash = this.hashToken(dto.otp);

    const activeOtp = await this.authRepository.findLatestActiveOtp(
      dto.email,
      'EMAIL_VERIFICATION',
    );

    if (!activeOtp) {
      throw new BadRequestException(
        'Invalid or expired verification code. Please request a new one.',
      );
    }

    // Validate OTP.
    if (activeOtp.otp_hash !== otpHash) {
      const attempts = await this.authRepository.incrementOtpAttempts(
        activeOtp.email_otp_id,
      );

      if (attempts >= 5) {
        await this.authRepository.markOtpUsed(
          activeOtp.email_otp_id,
        );

        throw new BadRequestException(
          'Too many failed attempts. This OTP has been invalidated. Please request a new one.',
        );
      }

      throw new BadRequestException(
        `Invalid verification code. Attempts remaining: ${5 - attempts}`,
      );
    }

    // Verify account status and consume OTP atomically.
    await this.databaseService.withTransaction(async (client) => {
      const userResult = await client.query(
        `
          SELECT user_id, email, is_active, is_verified, deleted_at
          FROM users
          WHERE user_id = $1
          FOR UPDATE;
        `,
        [activeOtp.user_id],
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedException(
          'User account no longer exists.',
        );
      }

      const account = userResult.rows[0];

      if (account.deleted_at !== null || !account.is_active) {
        throw new ForbiddenException(
          'This account is unavailable. Please contact support.',
        );
      }

      await this.authRepository.markOtpUsed(
        activeOtp.email_otp_id,
        client,
      );

      await this.authRepository.setUserVerified(
        activeOtp.user_id,
        client,
      );
    });

    this.logger.log(
      `Email successfully verified for user_id: ${activeOtp.user_id} (${dto.email}). Account activated.`,
    );

    return {
      success: true,
      message: 'Email successfully verified. Please sign in to your account.',
      email: dto.email,
    };
  }


  /**
   * Unified Login for all 4 roles (Requires is_verified = TRUE)
   */
  async login(
    dto: LoginValidation,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult & { rawRefreshToken: string }> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

   if (user.deleted_at !== null || !user.is_active) {
  throw new ForbiddenException(
    'This account is unavailable. Please contact support.',
  );
}

    // Security Gate: Enforce email verification!
    if (!user.is_verified) {
      // Dispatches fresh OTP automatically for convenience
      this.dispatchOtpForUser(user.user_id, user.email, 'EMAIL_VERIFICATION').catch(() => null);
      throw new ForbiddenException(
        'Email address not verified. A fresh verification code has been dispatched to your email.',
      );
    }

    // Fetch user roles and permissions dynamically from DB
    const { roles, roleNames, permissions, primaryDashboardRoute, primaryRoleSlug } =
      await this.authRepository.getUserRolesAndPermissions(user.user_id);

    // Issue short-lived access token
    const accessToken = await this.generateAccessToken(user.user_id, user.email, roleNames, permissions);

    // Issue long-lived refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const ttlMs = this.configService.get<number>('auth.refreshTokenTtlMs') || 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.authRepository.createRefreshToken({
      userId: user.user_id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    // Update last login timestamp asynchronously
    this.authRepository.updateLastLogin(user.user_id).catch(() => null);

    const userResponse: AuthUserResponse = {
      userId: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles,
      roleNames,
      permissions,
      primaryDashboardRoute,
      primaryRoleSlug,
    };

    return {
      user: userResponse,
      accessToken,
      rawRefreshToken,
    };
  }

  /**
   * Atomic Token Rotation with 15s Grace Window & Rollback-Safe Reuse Detection
   */
async refreshToken(
  rawRefreshToken: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{
  accessToken: string;
  rawRefreshToken: string | null;
  user: AuthUserResponse;
}> {
  if (!rawRefreshToken) {
    throw new UnauthorizedException('Refresh token is required');
  }

  const tokenHash = this.hashToken(rawRefreshToken);

  let reuseDetected = false;
  let accountUnavailable = false;
  let targetUserId = '';
  let newRawToken = '';
  let isWithinGrace = false;

  await this.databaseService.withTransaction(async (client) => {
    // 1. Lock the refresh token row.
    const token = await this.authRepository.findRefreshTokenForUpdate(
      tokenHash,
      client,
    );

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    targetUserId = token.user_id;

    // 2. Lock and check the associated user account.
    const userResult = await client.query(
      `
        SELECT user_id, is_active, deleted_at
        FROM users
        WHERE user_id = $1
        FOR UPDATE;
      `,
      [token.user_id],
    );

    const account = userResult.rows[0];

    if (
      !account ||
      account.deleted_at !== null ||
      !account.is_active
    ) {
      accountUnavailable = true;

      // Revoke all sessions and commit the revocation.
      await this.authRepository.revokeAllUserRefreshTokens(
        token.user_id,
        client,
      );

      return;
    }

    // 3. Check token expiration.
    if (new Date(token.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException(
        'Refresh token has expired. Please log in again.',
      );
    }

    // 4. Check revocation status and reuse detection.
    if (token.is_revoked) {
      const revokedAt = new Date(
        token.updated_at || token.created_at,
      ).getTime();

      const now = Date.now();
      const GRACE_PERIOD_MS = 15000;

      if (
        now - revokedAt < GRACE_PERIOD_MS &&
        token.replaced_by_hash
      ) {
        isWithinGrace = true;
        return;
      }

      reuseDetected = true;

      await this.authRepository.revokeAllUserRefreshTokens(
        token.user_id,
        client,
      );

      return;
    }

    // 5. Normal refresh-token rotation.
    newRawToken = crypto.randomBytes(40).toString('hex');

    const newTokenHash = this.hashToken(newRawToken);

    const ttlMs =
      this.configService.get<number>('auth.refreshTokenTtlMs') ||
      7 * 24 * 60 * 60 * 1000;

    const newExpiresAt = new Date(Date.now() + ttlMs);

    await this.authRepository.revokeRefreshToken(
      token.refresh_token_id,
      newTokenHash,
      client,
    );

    await this.authRepository.createRefreshToken(
      {
        userId: token.user_id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      },
      client,
    );
  });

  // 6. Handle account status after transaction commits.
  if (accountUnavailable) {
    throw new UnauthorizedException(
      'User account is no longer active',
    );
  }

  // 7. Handle token reuse detection.
  if (reuseDetected) {
    this.logger.warn(
      `Token reuse detected for user_id: ${targetUserId}. All sessions revoked.`,
    );

    throw new UnauthorizedException(
      'Security alert: Token reuse detected. All sessions revoked.',
    );
  }

  // 8. Fetch the user for access-token generation.
  const user = await this.authRepository.findUserById(targetUserId);

  if (!user || user.deleted_at !== null || !user.is_active) {
    throw new UnauthorizedException(
      'User account is no longer active',
    );
  }

  // 9. Fetch roles and permissions.
  const {
    roles,
    roleNames,
    permissions,
    primaryDashboardRoute,
    primaryRoleSlug,
  } = await this.authRepository.getUserRolesAndPermissions(
    targetUserId,
  );

  // 10. Generate access token.
  const accessToken = await this.generateAccessToken(
    user.user_id,
    user.email,
    roleNames,
    permissions,
  );

  const userResponse: AuthUserResponse = {
    userId: user.user_id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    roles,
    roleNames,
    permissions,
    primaryDashboardRoute,
    primaryRoleSlug,
  };

  return {
    accessToken,
    // Grace window: a parallel request already rotated this token and set the new cookie.
    // Returning the old (revoked) token here would overwrite that cookie and trigger
    // reuse detection on the next refresh (= forced logout). Return null so it is left alone.
    rawRefreshToken: isWithinGrace ? null : newRawToken,
    user: userResponse,
  };
}

  /**
   * Logout (Revoke refresh token)
   */
  async logout(rawRefreshToken?: string): Promise<{ message: string }> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      const token = await this.authRepository.findRefreshToken(tokenHash);
      if (token && !token.is_revoked) {
        await this.authRepository.revokeRefreshToken(token.refresh_token_id);
      }
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * Forgot Password (Anti-Enumeration Safe)
   */
async forgotPassword(
  dto: ForgotPasswordValidation,
): Promise<{ success: boolean; message: string }> {
  const genericMessage =
    'If an account with that email exists, password reset instructions have been sent.';

  const user = await this.authRepository.findUserByEmail(dto.email);

  // Do not issue reset tokens for missing, deleted, or inactive accounts.
  if (
    !user ||
    user.deleted_at !== null ||
    !user.is_active
  ) {
    await bcrypt
      .compare('dummy_input', this.dummyHash)
      .catch(() => null);

    return {
      success: true,
      message: genericMessage,
    };
  }

  const rawResetToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = this.hashToken(rawResetToken);

  const ttlMs =
    this.configService.get<number>('auth.passwordResetTtlMs') ||
    60 * 60 * 1000;

  const expiresAt = new Date(Date.now() + ttlMs);

  await this.authRepository.createPasswordResetToken({
    userId: user.user_id,
    tokenHash,
    expiresAt,
  });

  const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  const resetUrl = `${frontendUrl}/reset-password?token=${rawResetToken}`;

  // Never print reset links outside development (they grant account access).
  if (process.env.NODE_ENV !== 'production') {
    this.logger.debug(`[DEV] Password reset link for ${user.email}: ${resetUrl}`);
  }

  // Same response whether or not mail delivery works, so the endpoint can't reveal accounts.
  try {
    await this.emailService.sendPasswordResetLink(
      user.email,
      resetUrl,
      Math.round(ttlMs / 60000),
      user.first_name,
    );
  } catch (mailErr: any) {
    this.logger.error(`Failed to send password reset email for user_id ${user.user_id}: ${mailErr.message}`);
  }

  return {
    success: true,
    message: genericMessage,
  };
}
  /**
   * Reset Password
   */
async resetPassword(
  dto: ResetPasswordValidation,
): Promise<{ message: string }> {
  const tokenHash = this.hashToken(dto.token);

  let resetUserId = '';

  await this.databaseService.withTransaction(async (client) => {
    // Validate and lock the reset token inside this transaction.
    const resetRecord =
      await this.authRepository.findValidPasswordResetToken(
        tokenHash,
        client,
      );

    if (!resetRecord) {
      throw new BadRequestException(
        'Invalid or expired password reset token',
      );
    }

    resetUserId = resetRecord.user_id;

    // Lock the account and verify its status.
    const userResult = await client.query(
      `
        SELECT user_id, is_active, deleted_at
        FROM users
        WHERE user_id = $1
        FOR UPDATE;
      `,
      [resetUserId],
    );

    if (userResult.rows.length === 0) {
      throw new BadRequestException(
        'Invalid or expired password reset token',
      );
    }

    const account = userResult.rows[0];

    if (account.deleted_at !== null || !account.is_active) {
      throw new ForbiddenException(
        'This account is unavailable. Please contact support.',
      );
    }

    const saltRounds =
      this.configService.get<number>('auth.bcryptSaltRounds') || 12;

    const newPasswordHash = await bcrypt.hash(
      dto.newPassword,
      saltRounds,
    );

    await this.authRepository.updateUserPassword(
      resetUserId,
      newPasswordHash,
      client,
    );

    await this.authRepository.markPasswordResetTokenUsed(
      resetRecord.password_reset_token_id,
      client,
    );

    await this.authRepository.revokeAllUserRefreshTokens(
      resetUserId,
      client,
    );
  });

  this.logger.log(
    `Password reset completed for user_id: ${resetUserId}`,
  );

  return {
    message:
      'Password has been reset successfully. Please log in with your new password.',
  };
}

  /**
   * Fetch complete user profile dynamically from DB
   */
  async getProfile(userId: string): Promise<AuthUserResponse> {
    const user = await this.authRepository.findUserById(userId);
  if (!user) {
  throw new UnauthorizedException('User account not found');
}

if (user.deleted_at !== null || !user.is_active) {
  throw new ForbiddenException(
    'This account is unavailable. Please contact support.',
  );
}
    const { roles, roleNames, permissions, primaryDashboardRoute, primaryRoleSlug } =
      await this.authRepository.getUserRolesAndPermissions(userId);

    return {
      userId: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles,
      roleNames,
      permissions,
      primaryDashboardRoute,
      primaryRoleSlug,
    };
  }

  /**
   * Helper: Generate short-lived JWT Access Token
   */
  private async generateAccessToken(
    userId: string,
    email: string,
    roleNames: string[],
    permissions: string[],
  ): Promise<string> {
    const payload = {
      sub: userId,
      userId,
      email,
      roles: roleNames,
      permissions,
    };

    const secret = this.configService.get<string>('auth.jwtAccessSecret');
    const expiresIn = this.configService.get<string>('auth.jwtAccessExpiresIn') || '15m';

    return this.jwtService.signAsync(payload, { secret, expiresIn });
  }
}
