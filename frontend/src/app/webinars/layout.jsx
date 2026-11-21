'use client';

import ModuleGate from '@/components/layout/ModuleGate';

/** Live Webinars pages follow Dynamic Module Management (public website visibility). */
export default function WebinarsLayout({ children }) {
  return <ModuleGate moduleKey="webinars">{children}</ModuleGate>;
}
