import { UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { isOperationsAdmin } from './operations.policy';

/**
 * Purchase policy (Udemy-style): buying a course is NOT tied to a role.
 *
 * Any authenticated, active account (STUDENT, INSTRUCTOR, ADMIN, SUPER_ADMIN) may buy any
 * eligible course. Course-level eligibility (published, active, not your own course, not already
 * enrolled) is checked by the cart/enrollment services, and paid access is granted only after a
 * verified, captured payment (OrdersService.checkout).
 *
 * Course MANAGEMENT stays permission/role based (courses:*, RolesGuard) and is unaffected by this.
 *
 * Inactive / deleted accounts never reach here: JwtAuthGuard rejects them.
 *
 * There is no guest checkout (Udemy-style): buying always requires a signed-in account, and the
 * course goes to that account. To buy for another email, sign in/register as that email first.
 */
export function assertCanPurchase(user: AuthenticatedUser | undefined | null): asserts user is AuthenticatedUser {
  if (!user?.userId) {
    throw new UnauthorizedException('Please sign in to purchase or enroll in courses.');
  }
}

/** Platform admins can view any buyer's orders, transactions and refunds. */
export function isPlatformAdmin(user: AuthenticatedUser | undefined | null): boolean {
  return isOperationsAdmin(user);
}
