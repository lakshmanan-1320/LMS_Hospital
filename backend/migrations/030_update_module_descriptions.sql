-- 030: Descriptions that no longer match fully dynamic modules (028).
UPDATE platform_modules
SET description = 'Enrolled courses, course player, progress and resources. Turning it off blocks access to purchased courses.',
    updated_at = CURRENT_TIMESTAMP
WHERE module_key = 'learning';
