import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The tab bar at the top of a panel: an iOS-style segmented control whose
 * white thumb slides to the chosen tab.
 */
export function SegTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number; ready: boolean } | null>(null);

  // Follow the selected tab (and size changes: fonts loading, the panel resizing).
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const place = () => {
      const b = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!b) return;
      setThumb((cur) => ({ x: b.offsetLeft, w: b.offsetWidth, ready: cur !== null }));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div ref={bar} className={`panel-tabs ${className ?? ''}`} role="tablist">
      {thumb && (
        <span
          className={`panel-tabs-thumb ${thumb.ready ? 'ready' : ''}`}
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
          aria-hidden="true"
        />
      )}
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          className={value === it.id ? 'on' : ''}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
