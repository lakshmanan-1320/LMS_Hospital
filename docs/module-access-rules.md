# Module access rules

How the LMS decides whether a request may use a platform module. Enforced in the backend by
`ModuleAccessGuard` (`backend/src/common/guards/module-access.guard.ts`). The frontend only hides
menus; it is never the security boundary.

## Two separate settings

| Setting | Who changes it | Question it answers | Where it lives |
|---|---|---|---|
| **Module availability** | Super Admin (Module Management) | Is this feature switched on, and for which audiences? | `platform_modules`, `module_role_access` |
| **Permissions** | Super Admin (Roles & Permissions) | What may this role do inside an available feature? | `role_permissions` |

Admin manages users (Students and Instructors) within the permissions Super Admin defines.
Admin cannot change module availability or role permissions.

## The four checks (in order, on every request)

1. **Module enabled?** The module is on platform-wide.
2. **Visible to this audience?** Audience is the **public website** (anonymous / `@Public()` routes)
   or the caller's **role** (Student, Instructor, Admin). No per-user overrides.
3. **Role has the permission?** `RolesGuard` / `PermissionsGuard`.
4. **Owns the record?** In the services: own course, enrolled, own order.

Guard order in `app.module.ts`: `JwtAuthGuard` → `ModuleAccessGuard` → `RolesGuard` → `PermissionsGuard`.

## Module types

| Type | Behaviour |
|---|---|
| **Core** | Always on, audiences fixed, never blocked. Auth, catalog, categories, learning, payments, orders, teaching workspace, user management, enrollments, dashboard, and all governance modules. |
| **Toggleable** | Super Admin can turn on/off and choose audiences: instructor profiles, webinars, cart & checkout, coupons, refunds, instructor students, instructor performance, SMS/email/WhatsApp campaigns, reports. |
| **Coming soon** | Registered but cannot be enabled until built: reviews & ratings, certificates, wishlist, notifications, instructor earnings. |

Out of scope (not registered): Q&A, quizzes, assignments, payouts.

## When a module is turned off ("soft disable")

There are **two explicit paths** in the guard. Do not collapse them into one blanket block.

| Caller | Request | Result |
|---|---|---|
| **Admin** | `GET` / `HEAD` | **Allowed, read-only**: historical data stays reachable for support and audits. |
| Super Admin | any | `403`: governance-only, no operational data access. |
| Admin | `POST` / `PUT` / `PATCH` / `DELETE` | `403` `MODULE_DISABLED` |
| Student, Instructor | any | `403` `MODULE_DISABLED` |
| Anonymous (public website) | any | `404` `MODULE_DISABLED` |

Also:

- **Data is never deleted.** Turning the module back on restores everything.
- **Money in flight is never blocked.** Payments and orders are core, so payment verification
  and checkout completion always work. Only *starting a new payment* (`POST /payments/orders`)
  belongs to `cart_checkout`, so turning that off pauses new sales without stranding paid users.
- **Paid course access is never blocked.** Learning (player, progress, resources) is core.
- **Webhooks are exempt** (`@SkipModuleCheck()`): Razorpay, Zoom, Zoho, WhatsApp status callbacks.
- **Integrations stay configurable** while their feature is off (provider/gateway setup endpoints
  belong to the core `integrations` module), so they can be set up before a module is enabled.

## When a module is on but hidden from an audience

| Caller | Result |
|---|---|
| Public website, module not public | `404` `MODULE_NOT_AVAILABLE` |
| Role not in the module's visible roles | `403` `MODULE_NOT_AVAILABLE` |

## Super Admin change rules

- A reason (5–500 chars) is required and stored in `module_audit_logs` with before/after state and actor.
- Core modules: locked. Coming-soon modules: cannot be enabled.
- Only the module's supported audiences can be configured.
- Dependencies: a module can't be enabled before what it depends on (coupons needs cart & checkout),
  and can't be disabled while an enabled module depends on it.
- Changes apply immediately on the instance that saved them; other instances pick them up within 30 seconds.

## Error format

```json
{ "success": false, "statusCode": 403, "message": "Coupons & Discounts is currently unavailable.",
  "code": "MODULE_DISABLED", "module": "coupons" }
```

## Rules for developers

- Every controller has `@RequireModule(MODULE_KEYS.X)`; a handler may override it with its own key.
  `test-platform-modules.ts` fails if any route is untagged or uses an unknown key.
- Use `@SkipModuleCheck()` only for provider webhooks and infrastructure endpoints (health).
- `GET` handlers must not change data: Admin can call them on disabled modules.
- A new feature starts as a registry entry (migration) before its endpoints ship.

## API

| Method | Path | Who |
|---|---|---|
| `GET` | `/platform-modules/public-config` | Public |
| `GET` | `/platform-modules` | Super Admin |
| `PATCH` | `/platform-modules/:moduleKey` | Super Admin (`{ isEnabled?, publicVisible?, roleVisibility?, reason }`) |
| `GET` | `/platform-modules/audit-logs?moduleKey=&page=&limit=` | Super Admin |
| `PATCH` | `/platform-modules` | Super Admin (`{ changes: [{ key, isEnabled?, publicVisible?, roleVisibility? }], reason }`; all or nothing, dependencies checked against the final state) |
| `GET` | `/platform-modules/:moduleKey/impact` | Super Admin |
| `GET` | `/audit-logs?source=&search=&from=&to=&page=&limit=` | Super Admin (`audit_logs:read`) |
| `GET` | `/settings/integrations` | Super Admin |

## Super Admin is governance-only (Phase 2)

| Super Admin can | Super Admin cannot |
|---|---|
| Module Management, module audit log | Orders ledger, other users' orders and payments |
| Platform settings (incl. refund policy), OAuth / meeting providers | Coupons management, refund review, refund audit ledger |
| SMS / Email / WhatsApp gateway configuration, SMS (DLT) templates | Campaign templates (email, WhatsApp), audiences, sending, outbox logs |
| User accounts (Admin accounts) | Enrollments, courses, categories, curriculum, webinars |
| Dashboard overview (aggregate counts) | Read-only access to disabled modules |
| Buy courses like any account: cart, apply coupons, own orders, own refund requests | |

How it is enforced:

- `RolesGuard` and `PermissionsGuard` no longer let Super Admin through automatically: it must be
  listed in `@Roles()` or hold the permission.
- Super Admin's role permissions are `admins:manage`, `audit_logs:read`, `platform:manage` (migration 024).
- Service-level "is admin" checks use `isOperationsAdmin()` / `hasOperationsAdminRole()`
  (`common/policies/operations.policy.ts`), which is Admin only.
- The frontend `ProtectedRoute` no longer lets Super Admin into other roles' dashboards.

## Governance screens (Phase 3)

| Screen | Route | Backend |
|---|---|---|
| Module Management | `/dashboard/super-admin/modules` | `GET/PATCH /platform-modules`, `GET /platform-modules/:key/impact` |
| Admin Accounts | `/dashboard/super-admin/admin-accounts` | `/users` (Super Admin is scoped to Admin and Super Admin accounts) |
| Integrations hub | `/dashboard/super-admin/integrations` | `GET /settings/integrations` (status only, never secrets) |
| Audit Logs | `/dashboard/super-admin/audit-logs` | `GET /audit-logs` (module changes, webinars, course media; permission `audit_logs:read`) |

- Turning a module off, or hiding it from an audience, shows an impact preview first: affected
  active users, public website, work in progress (e.g. upcoming webinars, queued campaigns,
  pending refunds), and modules that must be turned off first.
- User management split: Super Admin creates/deactivates Admin (and Super Admin) accounts;
  Admin manages Students and Instructors. The last active Super Admin cannot be deactivated.
- The financial ledger (orders/refunds) is not in the governance audit log; it stays with Admin.

## Roles & Permissions (Phase 4)

Screen: `/dashboard/super-admin/roles-permissions`. API: `GET /roles-permissions`,
`PATCH /roles-permissions/roles/:roleName` with `{ permissions: string[], reason }` (full set).

- Super Admin edits the permission sets of **Admin, Instructor and Student**. Roles cannot be
  created or deleted.
- The **Super Admin role is locked**, and the governance permissions (`admins:manage`,
  `audit_logs:read`, `platform:manage`) can never be granted to another role.
- Changes apply on the user's **next request**: `JwtAuthGuard` reads roles and permissions from the
  database every time. An empty permission set is respected; it never falls back to the token's claims.
- Every change is audited (`role_permission_audit_logs`, shown in Audit Logs under "Roles & permissions")
  with granted/revoked codes, reason and actor.
- Permissions govern course, curriculum, media, category, enrollment and instructor-profile actions.
  Orders, refunds, coupons and campaigns are fixed to the Admin role (`@Roles`).
- Migration 025 grants Admin `courses:create` and `courses:edit_own` (the Admin course screen offers
  "New Course"; Admin never had these before).

## Menus and pages follow the registry (Phase 5)

- `GET /platform-modules/my-access` (any signed-in user) returns `full`, `read_only` or `none` per module,
  using the same decision as `ModuleAccessGuard`. Guests use `GET /platform-modules/public-config`.
- Frontend: `PlatformConfigInitializer` (root layout) loads both and re-checks on navigation at most every
  30 seconds; `useModuleAccess(key)` / `usePublicModule(key)` (`stores/usePlatformConfigStore`) read them.
- **Dashboard menus** hide items of modules the user can't use. Admins see a turned-off module marked
  **OFF** and its pages open with a read-only banner. Opening a hidden module's page shows
  "This feature isn't available".
- **Public website**: Live Webinars / Instructors links, the homepage webinar section, the cart icon and
  "My cart" follow the module settings. `/webinars`, `/instructors` and `/cart` are gated
  (`components/layout/ModuleGate`). With Cart & Checkout off, course cards and course pages show
  "Enrollment paused" (paid and free).
- Hiding is UI only; the backend still enforces every request.

There is no background job scheduler in the backend: bulk campaigns run when an Admin sends them, so a
turned-off campaign module simply refuses new sends.

Tests: `npx ts-node --transpile-only src/modules/platform-modules/test-platform-modules.ts` (from `backend/`).

## Fully dynamic modules (migration 028) — supersedes "Core modules are locked"

- **Every module can be turned on/off and shown/hidden for every role (Student, Instructor, Admin,
  Super Admin) and the public website** from Module Management. "Core" is now only an
  **Essential** hint: the review dialog warns before turning one off or hiding it.
- **Two safety locks** remain, enforced in the backend (`SAFETY_LOCKS`), so nobody gets locked out:
  - `auth` (sign-in): always on and visible to everyone.
  - `module_management`: always on and visible to Super Admin.
- Coming-soon modules still can't be turned on until they are built.
- `GET /platform-modules/public-config` and `GET /platform-modules/my-access` skip module checks:
  every page needs them to build menus.
- Module visibility decides whether a role can **reach** a module. What it can **do** inside is still
  decided by permissions (Roles & Permissions) and, for orders, refunds, coupons, campaigns and
  governance endpoints, by fixed role checks (`@Roles`). Making those fully dynamic means converting
  `@Roles` to permissions.
- Dashboard menus and routes map every item to its module, for every role including Super Admin.

**Update (migration 029):** sign-in (`auth`) is no longer a module. Its routes skip module checks like
the health check, it isn't listed in Module Management, and Module Management for Super Admin is the
only safety lock. On the screen, read mode lists only modules the selected audience can use right now
(on and visible); **Edit** shows every module with its switch.

## Reviews & Ratings follows the same pattern (migration 031)

- Reach: the `reviews_ratings` module (Module Management), configurable for every role and the public website.
- Actions: permissions only, no fixed roles (`@Roles` removed):
  - `reviews:create` — write/edit own review (Student by default)
  - `reviews:reply` — reply on own courses, list own course reviews (Instructor, Admin by default)
  - `reviews:moderate` — hide/restore/delete any review, act on others' replies (Admin by default)
- Super Admin gets no review permissions (governance-only). Migration 026 was fixed; 031 restores
  Super Admin to `admins:manage`, `audit_logs:read`, `platform:manage` on databases where 026 already ran.
- New features must follow the same rules: register the module in `platform_modules`, tag every
  controller with `@RequireModule`, and guard actions with permissions (not `@Roles` or role-name checks).
