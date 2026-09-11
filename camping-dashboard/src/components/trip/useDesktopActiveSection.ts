'use client';

import { useEffect, useState } from 'react';
import { desktopSectionHeading } from './desktopSectionNavigation';
import { TRIP_PRIMARY_DESTINATIONS, tripDestinationHref } from './tripNavigation';

/** Visual rail state only; route targeting and guards remain owned by navigation. */
export function useDesktopActiveSection(pathname: string, tripId: string) {
  const [observed, setObserved] = useState<{ pathname: string; path: string } | null>(null);
  useEffect(() => {
    if (!desktopSectionHeading(pathname, tripId) || !window.IntersectionObserver) return;
    const workspace = document.querySelector('[data-desktop-workspace-document]');
    if (!workspace) return;
    const sections = TRIP_PRIMARY_DESTINATIONS.map(({ segment }) => {
      const path = tripDestinationHref(tripId, segment);
      const heading = workspace.querySelector<HTMLElement>(`#${desktopSectionHeading(path, tripId)}`);
      return { path, element: heading?.closest('section') ?? heading };
    }).filter((section) => section.element != null);
    const end = workspace.querySelector('[data-desktop-workspace-end]');
    // Match the existing destination headings' 24px scroll margin. Observe the
    // whole section so very tall sections retain ownership until their end.
    let atEnd = false;
    const update = () => {
      let active = sections[0];
      for (const section of sections) {
        if (section.element!.getBoundingClientRect().top <= 25) active = section;
      }
      if (window.scrollY > 0 && atEnd) {
        active = sections[sections.length - 1];
      }
      if (active) setObserved(previous => previous?.pathname === pathname && previous.path === active.path
        ? previous : { pathname, path: active.path });
    };
    let observer: IntersectionObserver;
    const observeSections = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(update, {
        rootMargin: `-24px 0px -${Math.max(0, window.innerHeight - 25)}px 0px`, threshold: 0,
      });
      sections.forEach(section => observer.observe(section.element!));
    };
    observeSections();
    // A separate viewport-end observer handles a short final section that cannot
    // reach the activation line. It never observes individual sections.
    const endObserver = new IntersectionObserver(entries => {
      atEnd = entries.some(entry => entry.isIntersecting);
      update();
    });
    if (end) endObserver.observe(end);
    window.addEventListener('resize', observeSections);
    return () => {
      observer.disconnect();
      endObserver.disconnect();
      window.removeEventListener('resize', observeSections);
    };
  }, [pathname, tripId]);
  return observed?.pathname === pathname ? observed.path : pathname;
}
