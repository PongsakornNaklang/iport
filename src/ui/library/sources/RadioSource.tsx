import { useEffect } from 'react';
import { friendlyError } from '@/core/sources/net';
import { countStationClick, RADIO_COUNTRIES, RADIO_TAGS, searchStations, stationTags, stationTrack, topStations, type Station } from '@/core/sources/radio';
import { IconRadio } from '../../icons';
import { addToLibrary, isInLibrary, togglePreview, useLibraryKeys, useSticky } from '../state';
import { Chips, Empty, LoadingRows, Notice, ResultRow, SearchField, useTask } from '../ui';

export function RadioSource() {
  const [country, setCountry] = useSticky('rb.country', 'TH', true);
  const [q, setQ] = useSticky('rb.q', '');
  const [tag, setTag] = useSticky('rb.tag', '');
  const [stations, setStations] = useSticky<Station[] | null>('rb.list', null);
  const task = useTask();
  const keys = useLibraryKeys();

  const load = (c: string, name: string, t: string) =>
    void task.run(async () => {
      setStations(name || t ? await searchStations({ name, tag: t, countrycode: c }) : await topStations(c));
    }, (e) => friendlyError(e, 'the radio directory'));

  useEffect(() => {
    if (!stations) load(country, q, tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countryName = RADIO_COUNTRIES.find((c) => c.code === country)?.name ?? 'Worldwide';

  return (
    <>
      <div className="lib-row-flex">
        <select
          className="select"
          style={{ width: 'auto', flex: 'none' }}
          value={country}
          aria-label="Country"
          onChange={(e) => {
            setCountry(e.target.value);
            load(e.target.value, q, tag);
          }}
        >
          {RADIO_COUNTRIES.map((c) => (
            <option key={c.code || 'all'} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="grow">
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v);
              if (!v) load(country, '', tag);
            }}
            onSubmit={(v) => load(country, v, tag)}
            busy={task.busy}
            button={null}
            placeholder="Station name"
          />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Chips
          value={tag}
          onChange={(t) => {
            setTag(t);
            load(country, q, t);
          }}
          options={[{ value: '', label: 'Top' }, ...RADIO_TAGS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
        />
      </div>
      <Notice error={task.error} />
      {task.busy ? (
        <div style={{ marginTop: 10 }}>
          <LoadingRows n={6} />
        </div>
      ) : stations && stations.length ? (
        <>
          <p className="tiny" style={{ margin: '10px 2px 6px' }}>
            {q || tag ? `${stations.length} stations` : `Most popular · ${countryName}`}
          </p>
          <div className="list">
            {stations.map((s) => {
              const t = stationTrack(s);
              const tags = stationTags(s).slice(0, 3).join(', ');
              return (
                <ResultRow
                  key={s.stationuuid}
                  art={t.artwork}
                  title={s.name}
                  sub={[country ? '' : s.country, tags].filter(Boolean).join(' · ') || s.country}
                  meta={[s.codec, s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' · ') || undefined}
                  previewKey={`rb:${s.stationuuid}`}
                  onPreview={() => {
                    countStationClick(s.stationuuid);
                    void togglePreview(`rb:${s.stationuuid}`, s.url_resolved);
                  }}
                  added={isInLibrary(keys, t)}
                  onAdd={() => {
                    countStationClick(s.stationuuid);
                    addToLibrary([t]);
                  }}
                />
              );
            })}
          </div>
        </>
      ) : stations ? (
        <Empty icon={<IconRadio />} title="No stations found">
          Only stations with secure (https) streams are listed. Try another name, genre or country.
        </Empty>
      ) : null}
      <p className="lib-hint">Stations appear in the iPod’s Radio menu. Only secure (https) streams are shown — browsers block the others on secure pages.</p>
    </>
  );
}
