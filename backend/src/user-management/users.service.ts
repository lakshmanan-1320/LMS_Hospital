
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { DatabaseService } from '../database/database.service';
import { AuthRepository } from '../auth/auth.repository';
import {
  UsersRepository,
  UserListFilters,
  CreateUserData,
  UpdateUserData,
} from './users.repository';

type Actor = {
  userId: string;
  roles: string[];
};

const SUPER_ADMIN = 'SUPER_ADMIN';
const ADMIN = 'ADMIN';
const INSTRUCTOR = 'INSTRUCTOR';
const STUDENT = 'STUDENT';
/** Accounts Super Admin governs (governance-only role split). */
const PRIVILEGED_ROLES = [ADMIN, SUPER_ADMIN];

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  private normalizeRoles(roles: string[]): string[] {
    return roles.map((role) => role.toUpperCase());
  }

  private assertCanManageUsers(actor: Actor): string[] {
    const roles = this.normalizeRoles(actor.roles);

    if (roles.includes(SUPER_ADMIN)) {
      return roles;
    }

    if (roles.includes(ADMIN)) {
      return roles;
    }

    throw new ForbiddenException(
      'You do not have permission to manage users.',
    );
  }

  private assertCanManageTarget(
    actor: Actor,
    targetRoles: string[],
  ): void {
    const actorRoles = this.normalizeRoles(actor.roles);
    const normalizedTargetRoles = this.normalizeRoles(targetRoles);

    // Super Admin is governance-only: it manages privileged (Admin / Super Admin) accounts.
    // Students and Instructors are managed by Admins.
    if (actorRoles.includes(SUPER_ADMIN)) {
      if (normalizedTargetRoles.some((role) => PRIVILEGED_ROLES.includes(role))) {
        return;
      }
      throw new ForbiddenException(
        'Super Admin manages Admin accounts only. Students and Instructors are managed by Admins.',
      );
    }

    if (!actorRoles.includes(ADMIN)) {
      throw new ForbiddenException(
        'You do not have permission to manage users.',
      );
    }

    if (
      normalizedTargetRoles.some(
        (role) => role === SUPER_ADMIN || role === ADMIN,
      )
    ) {
      throw new ForbiddenException(
        'Admins can only manage Students and Instructors.',
      );
    }
  }

  private assertAllowedCreationRole(
    actor: Actor,
    roleName: string,
  ): void {
    const actorRoles = this.normalizeRoles(actor.roles);
    const role = roleName.toUpperCase();

    if (actorRoles.includes(SUPER_ADMIN)) {
      if (PRIVILEGED_ROLES.includes(role)) {
        return;
      }
      throw new ForbiddenException(
        'Super Admin creates Admin accounts only. Students and Instructors are created by Admins.',
      );
    }

    if (
      actorRoles.includes(ADMIN) &&
      [STUDENT, INSTRUCTOR].includes(role)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot create an account with this role.',
    );
  }

  private async getTargetRoles(
    userId: string,
    client?: PoolClient,
  ): Promise<string[]> {
    const result = client
      ? await client.query(
          `
            SELECT r.name
            FROM user_roles ur
            INNER JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = $1;
          `,
          [userId],
        )
      : await this.databaseService.query(
          `
            SELECT r.name
            FROM user_roles ur
            INNER JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = $1;
          `,
          [userId],
        );

    return result.rows.map((row) => row.name);
  }

  private async getTargetForManagement(
    actor: Actor,
    targetUserId: string,
    client?: PoolClient,
  ) {
    const target = await this.usersRepository.findById(
      targetUserId,
      client,
    );

    if (!target || target.deleted_at !== null) {
      throw new NotFoundException('User not found.');
    }

    this.assertCanManageTarget(actor, target.roles || []);

    return target;
  }

  // GET: List users.
  async findAll(actor: Actor, filters: UserListFilters) {
  const roles = this.assertCanManageUsers(actor);

  // Super Admin sees privileged accounts; Admin sees Students and Instructors.
  const safeFilters = roles.includes(SUPER_ADMIN)
    ? { ...filters, allowedRoles: PRIVILEGED_ROLES }
    : { ...filters, allowedRoles: [STUDENT, INSTRUCTOR] };

  return this.usersRepository.findAll(safeFilters);
}

  // GET: User details.
  async findOne(actor: Actor, targetUserId: string) {
    this.assertCanManageUsers(actor);

    const target = await this.getTargetForManagement(
      actor,
      targetUserId,
    );

    return target;
  }

  // POST: Create a user.

async create(
  actor: Actor,
  data: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: string;
  },
) {
  this.assertCanManageUsers(actor);

  const normalizedEmail = data.email.trim().toLowerCase();
  const roleName = data.role.trim().toUpperCase();

  this.assertAllowedCreationRole(actor, roleName);

  if (![SUPER_ADMIN, ADMIN, INSTRUCTOR, STUDENT].includes(roleName)) {
    throw new BadRequestException('Invalid user role.');
  }

  if (!normalizedEmail || !data.firstName.trim() || !data.lastName.trim()) {
    throw new BadRequestException(
      'Email, first name and last name are required.',
    );
  }

  // Always check using the normalized email.
  const existing = await this.authRepository.findUserByEmail(
    normalizedEmail,
  );

  if (existing) {
    throw new ConflictException(
      'An account with this email already exists.',
    );
  }

  // Generate a temporary password if one was not provided.
  const plainPassword =
    data.password || randomBytes(16).toString('hex');

  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const createdUser = await this.databaseService.withTransaction(
    async (client) => {
      const role = await this.usersRepository.findRoleByName(
        roleName,
        client,
      );

      if (!role) {
        throw new BadRequestException(
          `Role ${roleName} does not exist.`,
        );
      }

      const userData: CreateUserData = {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        isActive: true,
        isVerified: false,
      };

      const user = await this.usersRepository.createUser(
        userData,
        client,
      );

      await this.usersRepository.assignRole(
        user.user_id,
        role.role_id,
        client,
      );

      return user;
    },
  );

  return {
    success: true,
    message:
      'User created successfully. Email verification may be required before login.',
    user: createdUser,
  };
}


  // PATCH: Update basic user details.
  async update(
    actor: Actor,
    targetUserId: string,
    data: UpdateUserData,
  ) {
    this.assertCanManageUsers(actor);

    await this.getTargetForManagement(actor, targetUserId);

    if (data.email) {
      const existing = await this.authRepository.findUserByEmail(
        data.email,
      );

      if (existing && existing.user_id !== targetUserId) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
    }

    const updated = await this.databaseService.withTransaction(
      async (client) => {
        return this.usersRepository.updateUser(
          targetUserId,
          data,
          client,
        );
      },
    );

    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return {
      success: true,
      message: 'User details updated successfully.',
      user: updated,
    };
  }

  // PATCH: Activate or deactivate a user.

async updateStatus(
  actor: Actor,
  targetUserId: string,
  isActive: boolean,
) {
  this.assertCanManageUsers(actor);

  if (actor.userId === targetUserId && !isActive) {
    throw new ForbiddenException(
      'You cannot deactivate your own account.',
    );
  }

  const result = await this.databaseService.withTransaction(
    async (client) => {
      // Serialize Super Admin protection checks.
      await client.query(
        `SELECT pg_advisory_xact_lock(784512963)`,
      );

      const target = await this.getTargetForManagement(
        actor,
        targetUserId,
        client,
      );

      if (!isActive && target.is_active) {
        const targetRoles = this.normalizeRoles(target.roles || []);

        if (targetRoles.includes(SUPER_ADMIN)) {
          const count =
            await this.usersRepository.countActiveSuperAdmins(client);

          if (count <= 1) {
            throw new ForbiddenException(
              'The last active Super Admin cannot be deactivated.',
            );
          }
        }
      }

      const updated = await this.usersRepository.updateStatus(
        targetUserId,
        isActive,
        client,
      );

      if (!updated) {
        throw new NotFoundException('User not found.');
      }

      if (!isActive) {
        await this.authRepository.revokeAllUserRefreshTokens(
          targetUserId,
          client,
        );
      }

      return updated;
    },
  );

  return {
    success: true,
    message: isActive
      ? 'User activated successfully.'
      : 'User deactivated successfully. All sessions have been revoked.',
    user: result,
  };
}


  // DELETE: Soft-delete a user.

async remove(actor: Actor, targetUserId: string) {
  this.assertCanManageUsers(actor);

  if (actor.userId === targetUserId) {
    throw new ForbiddenException(
      'You cannot delete your own account.',
    );
  }

  const result = await this.databaseService.withTransaction(
    async (client) => {
      // Serialize Super Admin protection checks.
      await client.query(
        `SELECT pg_advisory_xact_lock(784512963)`,
      );

      const target = await this.getTargetForManagement(
        actor,
        targetUserId,
        client,
      );

      const targetRoles = this.normalizeRoles(target.roles || []);

      if (
        targetRoles.includes(SUPER_ADMIN) &&
        target.is_active
      ) {
        const count =
          await this.usersRepository.countActiveSuperAdmins(client);

        if (count <= 1) {
          throw new ForbiddenException(
            'The last active Super Admin cannot be deleted.',
          );
        }
      }

      const deleted = await this.usersRepository.softDelete(
        targetUserId,
        client,
      );

      if (!deleted) {
        throw new NotFoundException('User not found.');
      }

      // Revoke all active refresh tokens.
      await this.authRepository.revokeAllUserRefreshTokens(
        targetUserId,
        client,
      );

      // Invalidate outstanding password reset tokens.
      await client.query(
        `
          UPDATE password_reset_tokens
          SET is_used = TRUE
          WHERE user_id = $1
            AND is_used = FALSE;
        `,
        [targetUserId],
      );

      // Invalidate outstanding email verification OTPs.
      await client.query(
        `
          UPDATE email_otps
          SET is_used = TRUE
          WHERE user_id = $1
            AND is_used = FALSE;
        `,
        [targetUserId],
      );

      return deleted;
    },
  );

  return {
    success: true,
    message:
      'User deleted successfully. The account has been soft-deleted and all sessions revoked.',
    user: result,
  };
}

}
