-- ==========================================================
-- 029: Sign-in is platform infrastructure, not a switchable module.
-- The auth routes skip module checks (@SkipModuleCheck), so the registry entry is removed and
-- it no longer appears in Module Management. Its visibility rows and audit entries cascade.
-- ==========================================================
DELETE FROM platform_modules WHERE module_key = 'auth';
