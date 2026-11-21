
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, BookOpen, SlidersHorizontal, RefreshCw, ShoppingCart } from 'lucide-react';
import { courseService } from '@/modules/courses/services/course.service';
import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useModuleAccess } from '@/stores/usePlatformConfigStore';
import { useCartStore } from '@/stores/useCartStore';

const PAGE_SIZE = 12;

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
};

export default function CourseCataloguePage() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role || 'student';
  const { user } = useAuthStore();
  // Dynamic Module Management: Cart & Checkout turned off pauses new enrollments (paid and free).
  const salesOpen = useModuleAccess('cart_checkout') !== 'none';
  // Purchasing is role-independent: every signed-in role can browse, add to cart and enroll.
  const canPurchase = Boolean(user);

  const {
    cart,
    actionLoading,
    addToCart,
    isInCart,
    enrollFreeCourse: storeEnrollFree,
    fetchCart,
  } = useCartStore();

  const [enrolledCourseIds, setEnrolledCourseIds] = useState(new Set());
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.CATEGORIES.BASE, {
        params: { isActive: true, page: 1, limit: 100 },
      });

      setCategories(
        Array.isArray(response)
          ? response
          : response?.items || response?.categories || [],
      );
    } catch (err) {
      console.error('Category loading failed:', err);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    if (canPurchase) {
      try {
        fetchCart();
        const enrollmentResponse = await courseService.getMyEnrollments();

        setEnrolledCourseIds(
          new Set(
            (enrollmentResponse?.items || [])
              .map((item) => item.course_id),
          ),
        );
      } catch (enrollmentError) {
        console.error('Enrollment status loading failed:', enrollmentError);
      }
    }
    try {
      const response = await courseService.getPublicCatalogue({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        categoryId: categoryId || undefined,
        sortBy: 'published_at',
        sortOrder: 'DESC',
      });

      setCourses(response?.items || []);
      setTotal(response?.total || 0);
    } catch (err) {
      setError(err.message || 'Unable to load courses.');
      setCourses([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, canPurchase]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatPrice = (course) => {
    if (course.isFree) return 'Free';

    const price = course.discountPrice ?? course.price ?? 0;
    return `${course.currency || 'INR'} ${Number(price).toLocaleString('en-IN')}`;
  };

  const handleEnroll = async (courseId) => {
    setEnrollingCourseId(courseId);
    setError('');

    try {
      const result = await storeEnrollFree(courseId);
      if (result.success) {
        setEnrolledCourseIds((previous) => {
          const updated = new Set(previous);
          updated.add(courseId);
          return updated;
        });
      } else {
        setError(result.error || 'Unable to enroll in this course.');
      }
    } catch (err) {
      setError(err?.message || 'Unable to enroll in this course.');
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const handleAddToCart = async (courseId) => {
    setError('');
    const result = await addToCart(courseId);
    if (!result.success) {
      setError(result.error || 'Failed to add course to cart.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-600">LEARN SOMETHING NEW</p>
          <h1 className="text-2xl font-bold text-slate-900">
            Course Catalogue
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Discover courses and explore new skills.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Available courses</p>
            <p className="text-xl font-bold text-slate-900">{total}</p>
          </div>

          {canPurchase && (
            <button
              type="button"
              onClick={() => router.push('/cart')}
              className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition shadow-sm"
            >
              <ShoppingCart size={18} className="text-teal-600" />
              <span>My Cart</span>
              {cart?.summary?.itemCount > 0 && (
                <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
                  {cart.summary.itemCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search courses..."
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="relative sm:w-64">
          <SlidersHorizontal
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-teal-500"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option
                key={category.categoryId || category.category_id}
                value={category.categoryId || category.category_id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button
            onClick={loadCourses}
            className="flex items-center gap-2 font-semibold"
          >
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <BookOpen size={42} className="mx-auto mb-3 text-slate-300" />
          <h2 className="font-semibold text-slate-800">
            No courses found
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Try another search or category.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <article
                key={course.courseId}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen size={48} className="text-slate-300" />
                    </div>
                  )}

                  {course.isFeatured && (
                    <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                      Featured
                    </span>
                  )}
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                      {course.categoryName || 'General'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {LEVEL_LABELS[course.level] || 'All Levels'}
                    </span>
                  </div>

                  <h2 className="line-clamp-2 text-lg font-bold text-slate-900">
                    {course.title}
                  </h2>

                  <p className="line-clamp-2 min-h-10 text-sm text-slate-500">
                    {course.subtitle || course.description || 'Explore this course.'}
                  </p>

                  {course.instructorName && (
                    <p className="text-xs text-slate-500">
                      Instructor: {course.instructorName}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">
                      {course.language || 'Language not specified'}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatPrice(course)}
                    </span>
                  </div>
{canPurchase && (
  <div className="pt-2">
    <button
  type="button"
  onClick={() =>
    router.push(`/courses/${course.slug || course.courseId}`)
  }
  className="mb-2 w-full rounded-xl border border-teal-600 px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
>
  View Course Details
</button>
    {user?.userId && course.instructorId === user.userId && !enrolledCourseIds.has(course.courseId) ? (
      // Udemy-style: your own course can't be bought or enrolled in; open it in instructor preview.
      <button
        type="button"
        onClick={() => router.push(`/my-learning/${course.courseId}`)}
        className="w-full rounded-xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
      >
        Your course · Go to course
      </button>
    ) : enrolledCourseIds.has(course.courseId) ? (
      <button
        type="button"
        onClick={() => router.push('/my-learning')}
        className="w-full rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 hover:bg-green-100"
      >
        Already Enrolled · Go to My Learning
      </button>
    ) : !salesOpen ? (
      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-500">
        Enrollment is temporarily paused
      </div>
    ) : course.isFree ? (
      <button
        type="button"
        disabled={enrollingCourseId === course.courseId}
        onClick={() => handleEnroll(course.courseId)}
        className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {enrollingCourseId === course.courseId ? (
          <>
            <RefreshCw size={15} className="animate-spin" />
            Enrolling...
          </>
        ) : (
          'Enroll Now — Free'
        )}
      </button>
    ) : isInCart(course.courseId) ? (
      <button
        type="button"
        onClick={() => router.push('/cart')}
        className="w-full rounded-xl border border-teal-600 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-100 flex items-center justify-center gap-2 transition"
      >
        <ShoppingCart size={16} />
        In Cart · View Cart
      </button>
    ) : (
      <button
        type="button"
        disabled={actionLoading[course.courseId] === 'adding'}
        onClick={() => handleAddToCart(course.courseId)}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition shadow-sm"
      >
        {actionLoading[course.courseId] === 'adding' ? (
          <>
            <RefreshCw size={15} className="animate-spin" />
            Adding to Cart...
          </>
        ) : (
          <>
            <ShoppingCart size={16} />
            Add to Cart
          </>
        )}
      </button>
    )}
  </div>
)}
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
