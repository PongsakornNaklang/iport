/**
 * "Drop anywhere" import, like dragging files onto iTunes.
 *
 *   const dropActive = useGlobalFileDrop();
 *   …
 *   <GlobalDropOverlay active={dropActive} />
 *
 * Drops on elements marked `data-own-drop` (the Library panel's drop zones)
 * are left to them.
 */
import { useEffect, useState } from 'react';
import { dragHasFiles, filesFromDataTransfer, sortFiles } from './dnd';
import { importWithToast, useImport } from './importer';
import './globalDrop.css';

function inOwnZone(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('[data-own-drop]');
}

export function useGlobalFileDrop(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const onOver = (e: DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return;
      e.preventDefault(); // allow dropping (and stop the browser from opening the file)
      window.clearTimeout(timer);
      if (inOwnZone(e.target)) {
        setActive(false);
        return;
      }
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setActive(true);
      // dragleave is unreliable across child elements; expire instead
      timer = window.setTimeout(() => setActive(false), 250);
    };
    const onLeave = (e: DragEvent) => {
      if (!e.relatedTarget) {
        window.clearTimeout(timer);
        setActive(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return;
      window.clearTimeout(timer);
      setActive(false);
      if (e.defaultPrevented || inOwnZone(e.target)) return;
      e.preventDefault();
      void filesFromDataTransfer(e.dataTransfer!).then((files) => importWithToast(sortFiles(files), 'global'));
    };
    window.addEventListener('dragenter', onOver);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('dragenter', onOver);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);
  return active;
}

export function GlobalDropOverlay({ active }: { active: boolean }) {
  const running = useImport((s) => s.running && s.origin === 'global');
  const done = useImport((s) => s.done);
  const total = useImport((s) => s.total);
  const current = useImport((s) => s.current);
  return (
    <>
      <div className={`gdrop ${active ? 'on' : ''}`} aria-hidden={!active}>
        <div className="gdrop-box">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <div className="gdrop-title">Drop to add to your iPod</div>
          <div className="gdrop-sub">Songs, videos, folders and photos are copied into this browser — nothing is uploaded.</div>
        </div>
      </div>
      {running && (
        <div className="gdrop-hud" role="status">
          <div className="gdrop-hud-text">
            Importing {Math.min(done + 1, total)} of {total}
            {current ? <span> — {current}</span> : null}
          </div>
          <div className="gdrop-hud-bar">
            <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
