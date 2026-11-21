
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react';

import { userService } from '@/app/dashboard/services/user.service';
//import ProtectedRoute from '@/components/auth/ProtectedRoute';

function CreateUserContent() {
  const params = useParams();
  const router = useRouter();

  const role = Array.isArray(params.role) ? params.role[0] : params.role;

  useEffect(() => {
    // User creation is restricted to admin only, not super-admin
    if (role === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [role, router]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'STUDENT',
    isActive: true,
    isVerified: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);

      const payload = {
        ...formData,
        password: formData.password || undefined,
      };

      await userService.createUser(payload);

      router.push(`/dashboard/${role}/users`);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message;

      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Unable to create user. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/${role}/users`)}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to Users
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <UserPlus size={23} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Create New User
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Add a new member to your Elevate learning platform.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  First Name *
                </label>
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  minLength={1}
                  maxLength={100}
                  className={inputClass}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Last Name *
                </label>
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  minLength={1}
                  maxLength={100}
                  className={inputClass}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                maxLength={255}
                className={inputClass}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                minLength={8}
                maxLength={72}
                className={inputClass}
                placeholder="Leave blank to use backend-generated password"
              />
              <p className="mt-2 text-xs text-slate-500">
                Optional. If blank, the backend generates a temporary password.
                No invitation email is sent by the current implementation.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                User Role *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                {role === 'super-admin' && (
                  <>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-4 rounded-xl bg-slate-50 p-4">
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Activate this account
              </label>

              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="isVerified"
                  checked={formData.isVerified}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Mark email as verified
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${role}/users`)}
                disabled={loading}
                className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={17} />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function CreateUserPage() {
  return <CreateUserContent />;
}
