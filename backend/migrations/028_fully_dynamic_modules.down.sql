-- Restore pre-028 behaviour: core modules always on, configurable roles back to the toggleable set.
UPDATE platform_modules SET is_enabled = TRUE WHERE is_core = TRUE;
ALTER TABLE platform_modules ADD CONSTRAINT chk_core_always_enabled CHECK (NOT is_core OR is_enabled);

UPDATE platform_modules SET supported_roles = '{}' WHERE is_core = TRUE;
UPDATE platform_modules SET supported_roles = array_remove(audience_roles, 'SUPER_ADMIN')
WHERE is_core = FALSE AND module_key NOT IN ('cart_checkout', 'coupons', 'refunds');
UPDATE platform_modules SET supported_roles = audience_roles
WHERE module_key IN ('cart_checkout', 'coupons', 'refunds');

UPDATE platform_modules SET supports_public = FALSE, public_visible = FALSE WHERE module_key = 'learning';

DELETE FROM module_role_access mra
USING platform_modules m, roles r
WHERE mra.module_key = m.module_key AND mra.role_id = r.role_id
  AND NOT (r.name = ANY (m.supported_roles));
