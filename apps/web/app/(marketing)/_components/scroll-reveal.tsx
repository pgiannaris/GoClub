'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@kit/ui/utils';

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: React.PropsWithChildren<{
  className?: string;
  delay?: number;
}>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -10% 0px',
      },
    );

    const node = ref.current;
    if (node) {
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'motion-reduce:transform-none motion-reduce:opacity-100 transition-[opacity,transform,filter] duration-700 ease-out will-change-transform',
        visible
          ? 'translate-y-0 opacity-100 blur-0'
          : 'translate-y-8 opacity-0 blur-[2px]',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
