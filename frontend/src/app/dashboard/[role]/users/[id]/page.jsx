
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Pencil,
} from 'lucide-react';

import { userService } from '@/app/dashboard/services/user.service';
//import ProtectedRoute from '@/components/auth/ProtectedRoute';

function UserDetailsContent() {
  const params = useParams();
  const router = useRouter();

  const role = Array.isArray(params.role) ? params.role[0] : params.role;
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    // User details are restricted to admin only, not super-admin
    if (role === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [role, router]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await userService.getUserById(userId);
      setUser(response?.user || response);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message;
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Unable to load user details.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchUser();
  }, [userId, fetchUser]);

  const formatDate = (date) => {
    if (!date) return 'Not available';

    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fullName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
    : '';

  const detailClass =
    'flex items-start gap-3 rounded-xl border border-slate-100 p-4';

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
          <Loader2 size={22} className="animate-spin" />
          Loading user details...
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6">
          <p className="text-sm text-red-600">
            {error || 'User not found.'}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${role}/users`)}
            className="mt-5 text-sm font-medium text-indigo-600"
          >
            Back to Users
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${role}/users`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Back to Users
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/${role}/users/${userId}/edit`
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            <Pencil size={16} />
            Edit User
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <User size={30} />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {fullName || 'Unnamed User'}
              </h1>
              <p className="mt-1 break-all text-sm text-slate-500">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    user.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    user.is_verified
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {user.is_verified ? 'Verified' : 'Verification pending'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Account Information
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={detailClass}>
              <User size={19} className="mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">First Name</p>
                <p className="mt-1 font-medium text-slate-900">
                  {user.first_name || '—'}
                </p>
              </div>
            </div>

            <div className={detailClass}>
              <User size={19} className="mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Last Name</p>
                <p className="mt-1 font-medium text-slate-900">
                  {user.last_name || '—'}
                </p>
              </div>
            </div>

            <div className={detailClass}>
              <Mail size={19} className="mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email Address</p>
                <p className="mt-1 break-all font-medium text-slate-900">
                  {user.email}
                </p>
              </div>
            </div>

            <div className={detailClass}>
              <Shield size={19} className="mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Assigned Roles</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(user.roles || []).map((userRole) => (
                    <span
                      key={userRole}
                      className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                    >
                      {userRole.replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={detailClass}>
              <Calendar size={19} className="mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Account Created</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatDate(user.created_at)}
                </p>
              </div>
            </div>

            <div className={detailClass}>
              <Clock size={19} className="mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Last Login</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatDate(user.last_login_at)}
                </p>
              </div>
            </div>

            <div className={detailClass}>
              {user.is_active ? (
                <CheckCircle size={19} className="mt-0.5 text-green-600" />
              ) : (
                <XCircle size={19} className="mt-0.5 text-red-600" />
              )}
              <div>
                <p className="text-xs text-slate-500">Account Status</p>
                <p className="mt-1 font-medium text-slate-900">
                  {user.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>

            <div className={detailClass}>
              {user.is_verified ? (
                <CheckCircle size={19} className="mt-0.5 text-green-600" />
              ) : (
                <XCircle size={19} className="mt-0.5 text-amber-600" />
              )}
              <div>
                <p className="text-xs text-slate-500">Email Verification</p>
                <p className="mt-1 font-medium text-slate-900">
                  {user.is_verified ? 'Verified' : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function UserDetailsPage() {
  return <UserDetailsContent />;
}
