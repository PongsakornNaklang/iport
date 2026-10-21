import { useEffect, useRef } from 'react';
import { ScrollView, type ScrollApi } from './ScrollView';

const ROW = 32;

/** iOS 7 picker wheel: flick to spin, snaps to a row; the centre row is the value. */
export function Wheel({
  items,
  value,
  onChange,
  label,
  width,
  dark,
}: {
  items: string[];
  value: number;
  onChange: (i: number) => void;
  /** unit shown to the right of the centre row ("hours") */
  label?: string;
  width?: number;
  dark?: boolean;
}) {
  const ref = useRef<ScrollApi>(null);
  const last = useRef(value);
  useEffect(() => {
    if (Math.round((ref.current?.get() ?? 0) / ROW) !== value) ref.current?.scrollTo(value * ROW);
    last.current = value;
  }, [value]);
  return (
    <div className={`n7-wheel ${dark ? 'dark' : ''}`} style={{ width }} data-noswipe>
      <ScrollView
        ref={ref}
        snap={ROW}
        indicator={false}
        onSettle={(y) => {
          const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ROW)));
          if (i !== last.current) {
            last.current = i;
            onChange(i);
          }
        }}
      >
        <div style={{ height: ROW * 2 }} />
        {items.map((it, i) => (
          <div
            key={i}
            className="n7-wheel-item"
            onClick={() => {
              ref.current?.scrollTo(i * ROW, true);
              if (i !== last.current) {
                last.current = i;
                onChange(i);
              }
            }}
          >
            {it}
          </div>
        ))}
        <div style={{ height: ROW * 2 }} />
      </ScrollView>
      <div className="n7-wheel-band">{label && <span>{label}</span>}</div>
      <div className="n7-wheel-fade" />
    </div>
  );
}
