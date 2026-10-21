/**
 * Drag & drop helpers: turn a DataTransfer (files and whole folders) into a
 * flat File list. Folder recursion uses the File and Directory Entries API
 * (DataTransferItem.webkitGetAsEntry), supported by every current browser.
 */

/** True when a drag carries files from the OS (not text or an <img> from the page). */
export function dragHasFiles(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types ?? []).includes('Files');
}

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const out: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) resolve(out);
        else {
          out.push(...batch);
          next(); // Chrome returns at most 100 entries per call
        }
      }, reject);
    next();
  });
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

const HIDDEN = /^(\.|__MACOSX$|Thumbs\.db$|desktop\.ini$)/i;

async function walk(entry: FileSystemEntry, out: File[], depth: number): Promise<void> {
  if (HIDDEN.test(entry.name) || depth > 12 || out.length > 20_000) return;
  if (entry.isFile) {
    try {
      const f = await fileOf(entry as FileSystemFileEntry);
      // keep the folder path so photos get album names (like a folder import)
      const rel = entry.fullPath.replace(/^\//, '');
      if (rel.includes('/')) {
        try {
          Object.defineProperty(f, 'webkitRelativePath', { value: rel });
        } catch {
          /* read-only in this browser */
        }
      }
      out.push(f);
    } catch {
      /* unreadable file */
    }
  } else if (entry.isDirectory) {
    const children = await readAll((entry as FileSystemDirectoryEntry).createReader()).catch(() => []);
    for (const c of children) await walk(c, out, depth + 1);
  }
}

/**
 * Must be called synchronously inside the drop handler (entries are only
 * available during the event); the returned promise resolves later.
 */
export function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  const plain: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== 'file') continue;
    const e = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (e) entries.push(e);
    else {
      const f = item.getAsFile();
      if (f) plain.push(f);
    }
  }
  if (!entries.length && !plain.length) return Promise.resolve(Array.from(dt.files ?? []));
  return (async () => {
    const out = [...plain];
    for (const e of entries) await walk(e, out, 0);
    return out;
  })();
}

/** Sort files so albums import in track order (folder, then natural file name). */
export function sortFiles(files: File[]): File[] {
  const path = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
  return [...files].sort((a, b) => path(a).localeCompare(path(b), undefined, { numeric: true, sensitivity: 'base' }));
}
