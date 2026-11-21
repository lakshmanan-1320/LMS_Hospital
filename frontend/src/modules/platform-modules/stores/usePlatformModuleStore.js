import { create } from 'zustand';
import { platformModuleService } from '../services/platform-module.service';

const errorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message || err?.message || fallback;
  return Array.isArray(msg) ? msg.join(', ') : msg;
};

/**
 * Views of the Module Management screen:
 * - 'platform': master switch, turns modules on/off for everyone
 * - 'public':   who sees a module on the public website (while it's on)
 * - a role:     whether that role sees a module (while it's on)
 *
 * Every module is configurable in every view, except two safety locks enforced by the
 * backend (sign-in for everyone, Module Management for Super Admin) so nobody gets locked out.
 */
export const MODULE_VIEWS = [
  { key: 'platform', label: 'Everyone (master on/off)', short: 'everyone', group: 'Master switch' },
  { key: 'public', label: 'Public website visitors', short: 'public website visitors', group: 'Who can see a module' },
  { key: 'STUDENT', label: 'Students', short: 'students', group: 'Who can see a module' },
  { key: 'INSTRUCTOR', label: 'Instructors', short: 'instructors', group: 'Who can see a module' },
  { key: 'ADMIN', label: 'Admins', short: 'admins', group: 'Who can see a module' },
  { key: 'SUPER_ADMIN', label: 'Super Admins', short: 'super admins', group: 'Who can see a module' },
];

/** Is this module safety-locked in the given view (can't be switched off or hidden)? */
export const safetyLocked = (module, view) => {
  const lock = module.safetyLock;
  if (!lock) return false;
  if (view === 'platform') return true;
  if (view === 'public') return lock.lockPublic;
  return lock.lockedRoles === 'all' || (lock.lockedRoles || []).includes(view);
};

/**
 * How a module appears in a view (every module is listed in every view):
 * - 'toggle': Super Admin decides
 * - 'locked': safety lock (sign-in, Module Management for Super Admin) or not built yet
 * - 'na':     public view only, for modules that have no public pages
 */
export const rowMode = (module, view) => {
  if (view === 'public' && !module.supportsPublic) return 'na';
  if (safetyLocked(module, view)) return 'locked';
  if (view === 'platform' && module.status === 'coming_soon') return 'locked';
  return 'toggle';
};

/** Kept for callers that only need "has a switch in this view". */
export const appliesToView = (module, view) => rowMode(module, view) === 'toggle';

/** Why a module has no setting in this view, in plain words. */
export const notApplicableReason = () => 'No public pages: signed-in users only';

/** Why a row is locked. */
export const lockReason = (module, view) =>
  safetyLocked(module, view) ? module.safetyLock.reason : 'Not built yet: cannot be turned on';

/** Saved value of a module's setting in the given view. */
export const savedValue = (module, view) => {
  if (view === 'platform') return module.isEnabled;
  if (view === 'public') return module.publicVisible;
  return module.roleVisibility?.[view] === true;
};

/** Can the Super Admin change this module's setting in this view? */
export const isLocked = (module, view) => rowMode(module, view) !== 'toggle';

/**
 * Super Admin Module Management state: pick a view, Edit, toggle, then Save all changes
 * together with one reason (impact preview for anything being turned off or hidden).
 */
export const usePlatformModuleStore = create((set, get) => ({
  modules: [],
  view: 'platform',
  isEditing: false,
  /** key -> boolean, only for modules changed in the current view */
  draft: {},
  isLoading: false,
  error: null,
  successMessage: null,

  isReviewOpen: false,
  impacts: [],
  isImpactLoading: false,
  isSaving: false,
  saveError: null,

  fetchModules: async () => {
    set({ isLoading: true, error: null });
    try {
      const modules = await platformModuleService.listModules();
      set({ modules, isLoading: false });
      return modules;
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to load modules'), isLoading: false });
      return [];
    }
  },

  /** Current value in the view (draft if edited, else saved). */
  valueOf: (module) => {
    const { draft, view } = get();
    return module.key in draft ? draft[module.key] : savedValue(module, view);
  },

  /** Changed modules in the current view: [{ module, from, to }]. */
  getChanges: () => {
    const { draft, view, modules } = get();
    return Object.entries(draft)
      .map(([key, to]) => {
        const module = modules.find((m) => m.key === key);
        return module ? { module, from: savedValue(module, view), to } : null;
      })
      .filter((c) => c && c.from !== c.to);
  },

  setView: (view) => set({ view, draft: {}, isEditing: false, saveError: null }),
  startEditing: () => set({ isEditing: true, draft: {}, saveError: null }),
  cancelEditing: () => set({ isEditing: false, draft: {}, saveError: null, isReviewOpen: false }),

  toggle: (module) => {
    const { draft, view } = get();
    const current = module.key in draft ? draft[module.key] : savedValue(module, view);
    const next = { ...draft, [module.key]: !current };
    if (next[module.key] === savedValue(module, view)) delete next[module.key];
    set({ draft: next });
  },

  /** Open the review dialog; load impact for anything being turned off or hidden. */
  openReview: async () => {
    const changes = get().getChanges();
    if (changes.length === 0) return;
    set({ isReviewOpen: true, impacts: [], saveError: null });
    const removals = changes.filter((c) => c.from && !c.to).slice(0, 10);
    if (removals.length === 0) return;
    set({ isImpactLoading: true });
    try {
      const impacts = await Promise.all(removals.map((c) => platformModuleService.getImpact(c.module.key)));
      set({ impacts, isImpactLoading: false });
    } catch (err) {
      set({ saveError: errorMessage(err, 'Could not load the impact preview'), isImpactLoading: false });
    }
  },

  closeReview: () => set({ isReviewOpen: false, impacts: [], saveError: null }),

  save: async (reason) => {
    const { view } = get();
    const changes = get().getChanges().map(({ module, to }) => {
      if (view === 'platform') return { key: module.key, isEnabled: to };
      if (view === 'public') return { key: module.key, publicVisible: to };
      return { key: module.key, roleVisibility: { [view]: to } };
    });
    if (changes.length === 0) return { success: false };

    set({ isSaving: true, saveError: null });
    try {
      await platformModuleService.updateModulesBatch(changes, reason);
      await get().fetchModules();
      set({
        isSaving: false,
        isReviewOpen: false,
        isEditing: false,
        draft: {},
        impacts: [],
        successMessage: `${changes.length} change${changes.length === 1 ? '' : 's'} saved.`,
      });
      return { success: true };
    } catch (err) {
      set({ isSaving: false, saveError: errorMessage(err, 'Failed to save changes') });
      return { success: false };
    }
  },

  clearSuccess: () => set({ successMessage: null }),
}));

export default usePlatformModuleStore;
