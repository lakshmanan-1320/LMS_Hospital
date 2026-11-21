'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PublicCourseCard from './PublicCourseCard';

/**
 * A titled, horizontally scrolling row of course cards with arrow buttons.
 * @param {{ title: React.ReactNode, courses: object[], subtitle?: React.ReactNode }} props
 */
export default function CourseCarousel({ title, subtitle, courses = [] }) {
  const scroller = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [courses.length]);

  if (!courses.length) return null;

  const scrollBy = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 260), behavior: 'smooth' });
  };

  const arrow =
    'absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-lg transition hover:bg-slate-50 md:flex';

  return (
    <section className="space-y-3" aria-label={typeof title === 'string' ? title : undefined}>
      <div>
        <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="relative">
        {canLeft && (
          <button type="button" onClick={() => scrollBy(-1)} className={`${arrow} -left-4`} aria-label="Previous courses">
            <ChevronLeft size={20} />
          </button>
        )}
        <div
          ref={scroller}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {courses.map((c) => (
            <div key={c.courseId} className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-[31%] lg:w-[23%] xl:w-[19%]">
              <PublicCourseCard course={c} />
            </div>
          ))}
        </div>
        {canRight && (
          <button type="button" onClick={() => scrollBy(1)} className={`${arrow} -right-4`} aria-label="More courses">
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </section>
  );
}
