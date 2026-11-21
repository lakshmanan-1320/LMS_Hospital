'use client';

import ModuleGate from '@/components/layout/ModuleGate';

/** Instructor Profiles pages follow Dynamic Module Management (public website visibility). */
export default function InstructorsLayout({ children }) {
  return <ModuleGate moduleKey="instructor_profiles">{children}</ModuleGate>;
}
