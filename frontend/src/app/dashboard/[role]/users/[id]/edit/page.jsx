
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

import { userService } from '@/app/dashboard/services/user.service';
//import ProtectedRoute from '@/components/auth/ProtectedRoute';

function EditUserContent() {
  const params = useParams();
  const router = useRouter();

  const role = Array.isArray(params.role) ? params.role[0] : params.role;
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    // User editing is restricted to admin only, not super-admin
    if (role === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [role, router]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await userService.getUserById(userId);
      const user = response?.user || response;

      setFormData({
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        email: user?.email || '',
      });
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

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setSaving(true);

      await userService.updateUser(userId, formData);

      router.push(`/dashboard/${role}/users`);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message;
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Unable to update user.'
      );
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-bold text-slate-900">
            Edit User
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Update the user's account information.
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
              Loading user details...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                />
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
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${role}/users`)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}


export default function EditUserPage() {
  return <EditUserContent />;
}
