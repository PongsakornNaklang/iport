/** Photos: import images, browse by album, favourite, delete. They feed the iPods' Photos app. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { blobUrl } from '@/core/db';
import { useLibrary } from '@/core/library/store';
import type { Photo } from '@/core/types';
import { IconFolder, IconTrash, IconUpload } from '../icons';
import { dragHasFiles, filesFromDataTransfer, sortFiles } from './dnd';
import { IconBackArrow, IconPhoto, IconStar } from './icons';
import { describeSummary, runImport, useImport } from './importer';
import { useSticky } from './state';
import { Chips, Confirm, Empty, Sheet, useIncremental } from './ui';

function useBlobUrl(key: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!key) return;
    blobUrl(key).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [key]);
  return url;
}

function Thumb({ p, onOpen }: { p: Photo; onOpen: () => void }) {
  const url = useBlobUrl(p.blobKey);
  return (
    <button className="lib-photo" onClick={onOpen} title={p.name}>
      {url && <img src={url} alt={p.name} loading="lazy" decoding="async" draggable={false} />}
      {p.favorite && (
        <span className="fav">
          <IconStar filled />
        </span>
      )}
    </button>
  );
}

export function PhotosTab() {
  const photos = useLibrary((s) => s.photos);
  const [album, setAlbum] = useSticky('ph.album', '');
  const [viewing, setViewing] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const running = useImport((s) => s.running);
  const done = useImport((s) => s.done);
  const total = useImport((s) => s.total);
  const last = useImport((s) => s.last);
  const [showLast, setShowLast] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  const albums = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of photos) if (p.album) m.set(p.album, (m.get(p.album) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [photos]);
  const favCount = photos.filter((p) => p.favorite).length;

  const list = useMemo(() => {
    const l = album === '★' ? photos.filter((p) => p.favorite) : album ? photos.filter((p) => p.album === album) : photos;
    return [...l].sort((a, b) => b.addedAt - a.addedAt);
  }, [photos, album]);
  const [shown, sentinel] = useIncremental(list.length, 90, album);

  const start = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|avif|bmp|heic)$/i.test(f.name));
    if (!images.length) return;
    setShowLast(true);
    await runImport(sortFiles(images), { origin: 'panel' });
  };

  const idx = viewing ? list.findIndex((p) => p.id === viewing) : -1;

  return (
    <>
      <div className="lib-row-flex">
        <button className="btn primary" onClick={() => filesRef.current?.click()} disabled={running}>
          <IconPhoto /> Add Photos…
        </button>
        <button className="btn" onClick={() => folderRef.current?.click()} disabled={running}>
          <IconFolder /> Add Folder…
        </button>
      </div>
      <input
        ref={filesRef}
        type="file"
        accept="image/*,.heic"
        multiple
        hidden
        onChange={(e) => {
          void start(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void start(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <div
        className={`dropzone lib-dropzone ${over ? 'over' : ''}`}
        style={{ marginTop: 10, padding: '14px 12px' }}
        data-own-drop=""
        onClick={() => filesRef.current?.click()}
        onDragOver={(e) => {
          if (!dragHasFiles(e.dataTransfer)) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver(false)}
        onDrop={(e) => {
          if (!dragHasFiles(e.dataTransfer)) return;
          e.preventDefault();
          setOver(false);
          void filesFromDataTransfer(e.dataTransfer).then(start);
        }}
      >
        <IconUpload />
        <span>
          <b>Drop photos or folders</b> — each folder becomes an album
        </span>
      </div>
      {running && (
        <div style={{ marginTop: 10 }}>
          <div className="progress">
            <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {!running && showLast && last && <div className="lib-notice ok">{describeSummary(last)}.</div>}

      {photos.length === 0 ? (
        <Empty icon={<IconPhoto />} title="No photos yet">
          Add pictures to see them in the iPod’s Photos app and slideshows.
        </Empty>
      ) : (
        <div className="section">
          <div className="section-title">
            <span className="grow">
              {list.length} photo{list.length === 1 ? '' : 's'}
            </span>
            <button className="btn small ghost danger" style={{ color: 'var(--ui-danger)' }} onClick={() => setConfirmAll(true)}>
              {album ? 'Delete these…' : 'Delete all…'}
            </button>
          </div>
          {(albums.length > 0 || favCount > 0) && (
            <div style={{ marginBottom: 10 }}>
              <Chips
                value={album}
                onChange={setAlbum}
                options={[
                  { value: '', label: 'All Photos', count: photos.length },
                  ...(favCount ? [{ value: '★', label: 'Favorites', count: favCount }] : []),
                  ...albums.map(([name, n]) => ({ value: name, label: name, count: n })),
                ]}
              />
            </div>
          )}
          <div className="lib-photos">
            {list.slice(0, shown).map((p) => (
              <Thumb key={p.id} p={p} onOpen={() => setViewing(p.id)} />
            ))}
          </div>
          {shown < list.length && <div ref={sentinel} style={{ height: 1 }} />}
        </div>
      )}

      {viewing && idx >= 0 && (
        <Viewer
          photo={list[idx]}
          index={idx}
          count={list.length}
          onNav={(d) => setViewing(list[(idx + d + list.length) % list.length].id)}
          onClose={() => setViewing(null)}
        />
      )}
      {confirmAll && (
        <Confirm
          title={`Delete ${list.length} photo${list.length === 1 ? '' : 's'}?`}
          message="They are removed from every iPod and erased from this browser."
          confirm="Delete"
          danger
          onConfirm={() => list.forEach((p) => useLibrary.getState().removePhoto(p.id))}
          onClose={() => setConfirmAll(false)}
        />
      )}
    </>
  );
}

function Viewer({ photo, index, count, onNav, onClose }: { photo: Photo; index: number; count: number; onNav: (d: number) => void; onClose: () => void }) {
  const url = useBlobUrl(photo.blobKey);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onNav(-1);
      else if (e.key === 'ArrowRight') onNav(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNav]);
  return (
    <Sheet
      title={`${index + 1} of ${count}`}
      onClose={onClose}
      cancel={null}
      actions={
        <button className="btn small primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="lib-viewer">
        <div className="lib-viewer-img">
          {url && <img src={url} alt={photo.name} />}
          {count > 1 && (
            <>
              <button className="lib-viewer-nav prev" onClick={() => onNav(-1)} aria-label="Previous">
                <IconBackArrow />
              </button>
              <button className="lib-viewer-nav next" onClick={() => onNav(1)} aria-label="Next">
                <IconBackArrow style={{ transform: 'scaleX(-1)' }} />
              </button>
            </>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{photo.name}</div>
          <div className="tiny">
            {[photo.width && photo.height ? `${photo.width} × ${photo.height}` : '', photo.album, new Date(photo.addedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="lib-row-flex">
          <button className="btn" onClick={() => useLibrary.getState().togglePhotoFavorite(photo.id)}>
            <IconStar filled={photo.favorite} style={{ color: photo.favorite ? '#ff9f0a' : undefined }} /> {photo.favorite ? 'Favorite' : 'Add to Favorites'}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (count > 1) onNav(1);
              else onClose();
              useLibrary.getState().removePhoto(photo.id);
            }}
          >
            <IconTrash /> Delete
          </button>
        </div>
      </div>
    </Sheet>
  );
}
