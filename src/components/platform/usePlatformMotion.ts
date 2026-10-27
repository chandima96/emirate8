'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Restrained marketing animations (port of js/animations.js): hero entrance, scroll reveals, staggered groups,
 * image mask reveals, parallax and the map outline draw. Content is fully visible without JavaScript and the whole
 * thing is skipped for prefers-reduced-motion. Everything is scoped to `rootRef` and reverted on unmount.
 */
export function usePlatformMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    gsap.registerPlugin(ScrollTrigger);
    const ease = 'power3.out';
    const $$ = (s: string, r: Element = root): Element[] => Array.from(r.querySelectorAll(s));

    const ctx = gsap.context(() => {
      /* Hero entrance */
      const hero = root.querySelector('[data-hero]');
      if (hero) {
        const tl = gsap.timeline({ defaults: { ease } });
        const frame = hero.querySelector('[data-hero-frame]');
        const img = hero.querySelector('[data-hero-img]');
        if (frame)
          tl.fromTo(
            frame,
            { clipPath: 'inset(0 0 0 100%)' },
            { clipPath: 'inset(0 0 0 0%)', duration: 1.15, ease: 'power4.inOut' },
            0,
          );
        if (img) tl.fromTo(img, { scale: 1.06 }, { scale: 1, duration: 1.5 }, 0);
        tl.from($$('[data-hero-eyebrow]', hero), { y: 12, opacity: 0, duration: 0.5 }, 0.15);
        tl.from($$('[data-line] > span', hero), { yPercent: 110, duration: 0.8, stagger: 0.09 }, 0.25);
        tl.from($$('[data-hero-fade]', hero), { y: 14, opacity: 0, duration: 0.6, stagger: 0.1 }, 0.7);
        tl.from($$('[data-hero-cta] > *', hero), { y: 10, opacity: 0, duration: 0.5, stagger: 0.08 }, 0.85);
        if (img)
          gsap.to(img, {
            yPercent: 6,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
          });
      }

      /* Generic reveals */
      $$('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.65,
          ease,
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        });
      });
      $$('[data-stagger]').forEach((group) => {
        gsap.from(group.children, {
          y: 24,
          opacity: 0,
          duration: 0.6,
          ease,
          stagger: 0.1,
          scrollTrigger: { trigger: group, start: 'top 85%', once: true },
        });
      });

      /* Image mask reveals */
      $$('[data-img-reveal]').forEach((el) => {
        const im = el.querySelector('img');
        const t = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 82%', once: true } });
        t.fromTo(
          el,
          { clipPath: 'inset(100% 0 0 0)' },
          { clipPath: 'inset(0% 0 0 0)', duration: 1.05, ease: 'power4.inOut' },
          0,
        );
        if (im) t.fromTo(im, { scale: 1.05 }, { scale: 1, duration: 1.2, ease }, 0);
      });

      /* Subtle parallax on major architectural images */
      $$('[data-parallax]').forEach((el) => {
        const amt = parseFloat(el.getAttribute('data-parallax')) || 5;
        gsap.fromTo(
          el,
          { yPercent: -amt },
          {
            yPercent: amt,
            ease: 'none',
            scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });

      /* Map outline draw + marker fade */
      const map = root.querySelector('[data-map]');
      if (map) {
        const outline = map.querySelector('[data-map-outline]');
        const pins = map.querySelectorAll('.map-pin .pin-inner');
        const mt = gsap.timeline({ scrollTrigger: { trigger: map, start: 'top 78%', once: true } });
        if (outline && outline.getTotalLength) {
          const len = outline.getTotalLength();
          mt.fromTo(
            outline,
            { strokeDasharray: len, strokeDashoffset: len },
            {
              strokeDashoffset: 0,
              duration: 1.6,
              ease: 'power2.inOut',
              clearProps: 'strokeDasharray,strokeDashoffset',
            },
            0,
          );
          mt.from(map.querySelector('[data-map-land]'), { opacity: 0, duration: 0.8 }, 0.6);
        }
        mt.from(pins, { opacity: 0, duration: 0.45, stagger: 0.08, ease }, 0.9);
      }
    }, root);

    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState === 'complete') refresh();
    else window.addEventListener('load', refresh);
    return () => {
      window.removeEventListener('load', refresh);
      ctx.revert();
    };
  }, [rootRef]);
}
