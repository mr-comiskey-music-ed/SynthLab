import React, { useLayoutEffect, useRef, useState } from 'react';

/** A panel shrunk to fit its box: measured once and on resize, scaled down, height kept in step. */
export const ShrinkToFit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ scale: 0.5, h: 0 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / Math.max(1, i.offsetWidth));
      setFit({ scale, h: i.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height: fit.h || undefined }}>
      <div ref={inner} className="w-max origin-top-left" style={{ transform: `scale(${fit.scale})` }}>
        {children}
      </div>
    </div>
  );
};
