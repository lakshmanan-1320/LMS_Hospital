'use client';

import { MonitorPlay, FileText, File, Download, Smartphone, Trophy } from 'lucide-react';
import { formatHours } from '../../utils/courseFormat';

/**
 * "This course includes": figures come from the landing API; the certificate line appears
 * only when the Certificates module is switched on (decided by the backend).
 */
export default function CourseIncludes({ includes }) {
  if (!includes) return null;
  const rows = [
    includes.videoSeconds > 0 && { icon: MonitorPlay, text: `${formatHours(includes.videoSeconds)} on-demand video` },
    includes.articles > 0 && { icon: FileText, text: `${includes.articles} article${includes.articles === 1 ? '' : 's'}` },
    includes.documents > 0 && { icon: File, text: `${includes.documents} document${includes.documents === 1 ? '' : 's'}` },
    includes.resources > 0 && { icon: Download, text: `${includes.resources} downloadable resource${includes.resources === 1 ? '' : 's'}` },
    { icon: Smartphone, text: 'Access on mobile and desktop' },
    includes.certificate && { icon: Trophy, text: 'Certificate of completion' },
  ].filter(Boolean);

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">This course includes:</h2>
      <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.text} className="flex items-center gap-3 text-sm text-slate-700">
            <r.icon size={16} className="shrink-0 text-slate-600" /> {r.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
