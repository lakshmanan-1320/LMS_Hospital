'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Search,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Power,
  Trash2,
  Eye,
  GraduationCap,
  Presentation,
} from 'lucide-react';

import { userService } from '@/app/dashboard/services/user.service';
//import ProtectedRoute from '@/components/auth/ProtectedRoute';

function UserManagementContent() {
  const params = useParams();
  const router = useRouter();

  const role = Array.isArray(params.role) ? params.role[0] : params.role;

  useEffect(() => {
    // User management is restricted to admin only, not super-admin
    if (role === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [role, router]);

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('STUDENT');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await userService.getUsers({
        search,
        role: selectedRole,
        status: selectedStatus,
        page: pagination.page,
        limit: pagination.limit,
      });

      setUsers(response?.users || []);
      setPagination((current) => ({
        ...current,
        ...(response?.pagination || {}),
      }));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Unable to load users. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [search, selectedRole, selectedStatus, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleStatusChange = async (user) => {
  const nextStatus = !user.is_active;

  const confirmed = window.confirm(
    `Are you sure you want to ${
      nextStatus ? 'activate' : 'deactivate'
    } ${user.first_name} ${user.last_name}?`
  );

  if (!confirmed) return;

  try {
    await userService.updateUserStatus(user.user_id, nextStatus);
    await fetchUsers();
  } catch (err) {
    window.alert(
      err?.response?.data?.message ||
        err?.message ||
        'Unable to update user status.'
    );
  }
};

const handleDeleteUser = async (user) => {
  const confirmed = window.confirm(
    `Are you sure you want to delete ${user.first_name} ${user.last_name}? This action will remove the user from the active user list.`
  );

  if (!confirmed) return;

  try {
    await userService.deleteUser(user.user_id);
    await fetchUsers();
  } catch (err) {
    window.alert(
      err?.response?.data?.message ||
        err?.message ||
        'Unable to delete user.'
    );
  }
};
  const formatDate = (date) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getFullName = (user) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User';
  };

  if (role === 'super-admin') {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              User Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage platform users, roles and account status.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {role === 'admin' && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${role}/users/create`)}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                + Add User
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Total {selectedRole === 'STUDENT' ? 'students' : 'instructors'}
              </p>
              <Users className="text-indigo-600" size={20} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {pagination.total}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Current page</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {pagination.page}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total pages</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {pagination.totalPages}
            </p>
          </div>
        </div>

        <div
          className="flex gap-2 border-b border-slate-200"
          role="group"
          aria-label="Filter users by type"
        >
          {[
            { id: 'STUDENT', label: 'Students', Icon: GraduationCap },
            { id: 'INSTRUCTOR', label: 'Instructors', Icon: Presentation },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={selectedRole === id}
              onClick={() => {
                setSelectedRole(id);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
                selectedRole === id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                placeholder="Search by name or email..."
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">
              {selectedRole === 'STUDENT' ? 'Students' : 'Instructors'}
            </h2>
            <span className="text-sm text-slate-500">
              {pagination.total} {selectedRole === 'STUDENT' ? 'students' : 'instructors'}
            </span>
          </div>

          {error && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">User</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Verified</th>
                    <th className="px-5 py-4">Joined</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {getFullName(user)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {user.email}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || []).map((userRole) => (
                            <span
                              key={userRole}
                              className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                            >
                              {userRole.replaceAll('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {user.is_verified ? 'Verified' : 'Pending'}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-5 py-4">
  <div className="flex items-center gap-2">
    <button
  type="button"
  onClick={() =>
    router.push(
      `/dashboard/${role}/users/${user.user_id}`
    )
  }
  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
>
  <Eye size={14} />
  View
</button>
    <button
      type="button"
      onClick={() =>
        router.push(
          `/dashboard/${role}/users/${user.user_id}/edit`
        )
      }
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
    >
      <Pencil size={14} />
      Edit
    </button>

    <button
      type="button"
      onClick={() => handleStatusChange(user)}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
        user.is_active
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-green-200 text-green-600 hover:bg-green-50'
      }`}
    >
      <Power size={14} />
      {user.is_active ? 'Deactivate' : 'Activate'}
    </button>
    <button
  type="button"
  onClick={() => handleDeleteUser(user)}
  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
>
  <Trash2 size={14} />
  Delete
</button>
  </div>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
                className="rounded-lg border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                disabled={
                  pagination.page >= pagination.totalPages || loading
                }
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
                className="rounded-lg border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function UserManagementPage() {
  return <UserManagementContent />;
}
