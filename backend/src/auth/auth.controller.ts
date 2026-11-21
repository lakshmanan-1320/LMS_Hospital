import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginValidation } from './validations/login.validation';
import { RegisterValidation } from './validations/register.validation';
import { InstructorRegisterValidation } from './validations/instructor-register.validation';
import { SendOtpValidation } from './validations/send-otp.validation';
import { VerifyOtpValidation } from './validations/verify-otp.validation';
import { ForgotPasswordValidation } from './validations/forgot-password.validation';
import { ResetPasswordValidation } from './validations/reset-password.validation';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { SkipModuleCheck } from '../common/decorators/require-module.decorator';

// Sign-in is platform infrastructure: never switchable in Module Management.
@SkipModuleCheck()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper: Set both secure HTTP-only cookies (accessToken & refreshToken)
   */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string | null) {
    const isSecure = this.configService.get<boolean>('auth.cookieSecure');
    const sameSite = (this.configService.get<string>('auth.cookieSameSite') || 'lax') as any;
    const domain = this.configService.get<string>('auth.cookieDomain');
    const accessTtlMs = this.configService.get<number>('auth.accessTokenTtlMs') || 3 * 60 * 60 * 1000;
    const refreshTtlMs = this.configService.get<number>('auth.refreshTokenTtlMs') || 7 * 24 * 60 * 60 * 1000;

    // 1. Access Token Cookie (Root path, lifetime = JWT_ACCESS_EXPIRES_IN)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      domain: domain || undefined,
      path: '/',
      maxAge: accessTtlMs,
    });

    // Skip when null: a grace-window refresh must NOT overwrite the newer rotated cookie
    if (!refreshToken) return;

    // 2. Refresh Token Cookie (Auth path, lifetime = JWT_REFRESH_EXPIRES_IN)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      domain: domain || undefined,
      path: '/auth',
      maxAge: refreshTtlMs,
    });

    // 3. Session marker (Root path, no secret inside). The refresh cookie is scoped to /auth,
    //    so the frontend middleware cannot see it; this lets it know a refreshable session exists.
    res.cookie('hasSession', '1', {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      domain: domain || undefined,
      path: '/',
      maxAge: refreshTtlMs,
    });
  }

  /**
   * Helper: Clear all auth cookies using exact matching paths and expired timestamps
   */
  private clearAuthCookies(res: Response) {
    const isSecure = this.configService.get<boolean>('auth.cookieSecure');
    const sameSite = (this.configService.get<string>('auth.cookieSameSite') || 'lax') as any;
    const domain = this.configService.get<string>('auth.cookieDomain');

    const optionsRoot = {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      domain: domain || undefined,
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    };

    const optionsAuth = {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      domain: domain || undefined,
      path: '/auth',
      expires: new Date(0),
      maxAge: 0,
    };

    // Clear primary tokens
    res.clearCookie('accessToken', optionsRoot);
    res.clearCookie('refreshToken', optionsAuth);
    res.clearCookie('refreshToken', optionsRoot);
    res.clearCookie('hasSession', optionsRoot);

    // Also clear any legacy/session cookies if present
    res.clearCookie('admin_session', optionsRoot);
    res.clearCookie('superadmin_session', optionsRoot);
    res.clearCookie('payments_session', optionsRoot);
  }

  /**
   * POST /auth/register
   * Public Student Registration (Automatic, No Admin Approval, Requires OTP)
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerStudent(@Body() dto: RegisterValidation) {
    return this.authService.registerStudent(dto);
  }

  /**
   * POST /auth/instructor/register
   * Public Instructor Registration (Automatic, No Admin Approval, Requires OTP)
   */
  @Public()
  @Post('instructor/register')
  @HttpCode(HttpStatus.CREATED)
  async registerInstructor(@Body() dto: InstructorRegisterValidation) {
    return this.authService.registerInstructor(dto);
  }

  /**
   * POST /auth/send-otp
   * Request / Resend 6-Digit Email Verification OTP
   */
  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpValidation) {
    return this.authService.sendOtp(dto);
  }

  /**
   * POST /auth/verify-otp
   * Verify Email OTP without auto-login (User must sign in separately)
   */
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpValidation) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * POST /auth/login
   * Common Unified Login for all 4 roles (Requires is_verified = TRUE)
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginValidation,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(dto, ip, userAgent);

    // Set secure HTTP-only cookies for both access and refresh tokens
    this.setAuthCookies(res, result.accessToken, result.rawRefreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  /**
   * POST /auth/refresh
   * Token Rotation with 15s Grace Window
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const rawRefreshToken = req.cookies?.['refreshToken'] || bodyToken;

    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is missing from cookie/body');
    }

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refreshToken(rawRefreshToken, ip, userAgent);

    // Set updated cookies for both tokens
    this.setAuthCookies(res, result.accessToken, result.rawRefreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * POST /auth/logout
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const rawRefreshToken = req.cookies?.['refreshToken'] || bodyToken;
    const result = await this.authService.logout(rawRefreshToken);

    this.clearAuthCookies(res);
    return result;
  }

  /**
   * POST /auth/forgot-password (Anti-Enumeration Safe)
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordValidation) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /auth/reset-password
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordValidation) {
    return this.authService.resetPassword(dto);
  }

  /**
   * GET /auth/me (Protected - Active User Profile from Database)
   */
  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }
}
