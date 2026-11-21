import { create } from 'zustand';
import { rolesPermissionsService } from '../services/roles-permissions.service';

const errorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message || err?.message || fallback;
  return Array.isArray(msg) ? msg.join(', ') : msg;
};

/**
 * Super Admin Roles & Permissions state. Edits are drafted per role, reviewed as a diff,
 * and saved with a reason (audit log).
 */
export const useRolesPermissionsStore = create((set, get) => ({
  roles: [],
  permissions: [],
  selectedRole: 'ADMIN',
  /** Draft permission set for the selected role (codes). */
  draft: [],
  isLoading: false,
  isSaving: false,
  error: null,
  saveError: null,
  successMessage: null,

  fetchMatrix: async () => {
    set({ isLoading: true, error: null });
    try {
      const { roles, permissions } = await rolesPermissionsService.getMatrix();
      const selected = roles.find((r) => r.name === get().selectedRole) || roles.find((r) => r.isEditable);
      set({
        roles,
        permissions,
        selectedRole: selected?.name || 'ADMIN',
        draft: selected ? [...selected.permissions] : [],
        isLoading: false,
      });
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to load roles and permissions'), isLoading: false });
    }
  },

  selectRole: (roleName) => {
    const role = get().roles.find((r) => r.name === roleName);
    set({ selectedRole: roleName, draft: role ? [...role.permissions] : [], saveError: null });
  },

  togglePermission: (code) =>
    set((state) => ({
      draft: state.draft.includes(code) ? state.draft.filter((c) => c !== code) : [...state.draft, code],
    })),

  resetDraft: () => {
    const role = get().roles.find((r) => r.name === get().selectedRole);
    set({ draft: role ? [...role.permissions] : [], saveError: null });
  },

  /** { added, removed } between the saved role and the draft. */
  getDiff: () => {
    const { roles, selectedRole, draft } = get();
    const saved = roles.find((r) => r.name === selectedRole)?.permissions || [];
    return {
      added: draft.filter((c) => !saved.includes(c)).sort(),
      removed: saved.filter((c) => !draft.includes(c)).sort(),
    };
  },

  saveDraft: async (reason) => {
    const { selectedRole, draft } = get();
    set({ isSaving: true, saveError: null });
    try {
      const res = await rolesPermissionsService.updateRolePermissions(selectedRole, { permissions: draft, reason });
      set((state) => ({
        isSaving: false,
        roles: state.roles.map((r) => (r.name === selectedRole ? res.role : r)),
        draft: [...res.role.permissions],
        successMessage: `${selectedRole.replace('_', ' ')} permissions updated (+${res.added.length} / -${res.removed.length}).`,
      }));
      return { success: true };
    } catch (err) {
      set({ isSaving: false, saveError: errorMessage(err, 'Failed to update permissions') });
      return { success: false };
    }
  },

  clearSuccess: () => set({ successMessage: null }),
}));

export default useRolesPermissionsStore;
