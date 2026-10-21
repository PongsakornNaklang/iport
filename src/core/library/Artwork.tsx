import type { CSSProperties } from 'react';
import { DEFAULT_ARTWORK, useArtworkUrl } from './artwork';

/**
 * Album artwork with all the edge cases handled: IndexedDB blobs, missing
 * art (grey note tile), and YouTube thumbnails (4:3 with black bars — we
 * zoom in so a square crop shows only the picture).
 */
export function Artwork({
  src,
  size,
  radius = 0,
  style,
  className,
  alt = '',
}: {
  src: string | undefined;
  /** px, or omit to fill the parent */
  size?: number;
  radius?: number;
  style?: CSSProperties;
  className?: string;
  alt?: string;
}) {
  const url = useArtworkUrl(src);
  const yt = !!url && /i\.ytimg\.com\/vi\/[^/]+\/(hq|sd)default/.test(url);
  return (
    <div
      className={className}
      style={{
        width: size ?? '100%',
        height: size ?? '100%',
        borderRadius: radius,
        overflow: 'hidden',
        background: '#d6d6dc',
        flex: 'none',
        position: 'relative',
        ...style,
      }}
    >
      <img
        src={url ?? DEFAULT_ARTWORK}
        alt={alt}
        draggable={false}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK;
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: yt ? 'scale(1.34)' : undefined,
        }}
      />
    </div>
  );
}
