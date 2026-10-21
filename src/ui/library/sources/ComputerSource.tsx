import { useEffect, useRef, useState } from 'react';
import { IconFile, IconFolder, IconUpload } from '../../icons';
import { dragHasFiles, filesFromDataTransfer, sortFiles } from '../dnd';
import { describeSummary, runImport, useImport, VIDEO_PREF_KEY, type VideoKind } from '../importer';
import { useSticky } from '../state';
import { Segmented } from '../ui';

const ACCEPT =
  'audio/*,video/*,image/*,.mp3,.m4a,.m4b,.aac,.wav,.flac,.ogg,.oga,.opus,.aif,.aiff,.webm,.mp4,.m4v,.mov,.mkv,.heic,.vcf,.ics,.lrc';

export function ComputerSource() {
  const [videoAs, setVideoAs] = useSticky<VideoKind>(VIDEO_PREF_KEY, 'movie', true);
  const running = useImport((s) => s.running);
  const done = useImport((s) => s.done);
  const total = useImport((s) => s.total);
  const current = useImport((s) => s.current);
  const last = useImport((s) => s.last);
  const [over, setOver] = useState(false);
  const [showLast, setShowLast] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // not in React's typings
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
  }, []);

  const start = async (list: File[]) => {
    if (!list.length) return;
    setShowLast(true);
    await runImport(sortFiles(list), { videoAs, origin: 'panel' });
  };

  return (
    <>
      <div className="lib-row-flex">
        <button className="btn primary" onClick={() => filesRef.current?.click()} disabled={running}>
          <IconFile /> Add Files…
        </button>
        <button className="btn" onClick={() => folderRef.current?.click()} disabled={running}>
          <IconFolder /> Add Folder…
        </button>
      </div>
      <input
        ref={filesRef}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
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
        style={{ marginTop: 12 }}
        data-own-drop=""
        role="button"
        tabIndex={0}
        onClick={() => !running && filesRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && filesRef.current?.click()}
        onDragEnter={(e) => dragHasFiles(e.dataTransfer) && setOver(true)}
        onDragOver={(e) => {
          if (!dragHasFiles(e.dataTransfer)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(e) => {
          if (!dragHasFiles(e.dataTransfer)) return;
          e.preventDefault();
          setOver(false);
          void filesFromDataTransfer(e.dataTransfer).then(start);
        }}
      >
        <IconUpload />
        <b>Drop songs, videos, photos or whole folders</b>
        <span>or click to choose · you can also drop files anywhere on the page</span>
      </div>

      {running && (
        <div>
          <div className="lib-progress-text">
            <span>
              Importing {Math.min(done + 1, total)} of {total}
            </span>
            <span className="grow">{current ? `— ${current}` : ''}</span>
          </div>
          <div className="progress">
            <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {!running && showLast && last && (
        <div className={`lib-notice ${last.songs + last.videos + last.photos + last.contacts + last.events + last.lyrics ? 'ok' : 'info'}`}>
          {describeSummary(last)}.
          {last.skipped.length > 0 && <span className="tiny"> ({last.skipped.slice(0, 3).join(', ')}{last.skipped.length > 3 ? '…' : ''})</span>}
        </div>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label>Import video files as</label>
        <Segmented
          value={videoAs}
          onChange={setVideoAs}
          options={[
            { value: 'movie', label: 'Movies' },
            { value: 'musicvideo', label: 'Music Videos' },
            { value: 'tvshow', label: 'TV Shows' },
          ]}
        />
      </div>

      <p className="lib-hint">
        <b>Private:</b> files are copied into this browser’s storage (IndexedDB) and never uploaded. Tags and album art are read from the files (MP3, AAC/M4A, FLAC, OGG/Opus, WAV, AIFF; MP4/MOV/WebM video).
        Photos go to <b>Photos</b>; <b>.vcf</b> contacts and <b>.ics</b> calendars go to <b>Info</b>; <b>.lrc</b> lyrics attach to matching songs.
      </p>
    </>
  );
}
