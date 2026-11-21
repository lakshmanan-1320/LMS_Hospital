'use client';

import Link from 'next/link';
import { PauseCircle, Eye } from 'lucide-react';

/**
 * Shown instead of a page whose module is turned off or not available to this visitor.
 */
export default function ModuleUnavailable({ title = 'This feature isn’t available', homeHref = '/' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <PauseCircle size={28} />
      </div>
      <h1 className="mt-5 text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        This part of the platform is currently turned off or not available for your account. Please check back later.
      </p>
      <Link href={homeHref} className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
        Go back
      </Link>
    </div>
  );
}

/** Banner for Admins viewing a turned-off module's existing records. */
export function ModuleReadOnlyBanner() {
  return (
    <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:mx-6 lg:mx-8">
      <Eye size={16} className="mt-0.5 flex-shrink-0" />
      <span>
        This module is turned off. You can view existing records, but changes are disabled until a Super Admin turns it back on.
      </span>
    </div>
  );
}
