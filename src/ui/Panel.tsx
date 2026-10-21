import type { ReactNode } from 'react';
import { IconClose } from './icons';

export function Panel({
  title,
  side,
  onClose,
  children,
  tabs,
  footer,
}: {
  title: ReactNode;
  side: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
  tabs?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className={`panel ${side}`} data-no-stage="" data-no-device-keys="">
      <div className="panel-head">
        <h2>{title}</h2>
        <button className="panel-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>
      </div>
      {tabs}
      <div className="panel-body">{children}</div>
      {footer}
    </aside>
  );
}
