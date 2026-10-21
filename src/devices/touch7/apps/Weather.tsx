/**
 * Weather (iOS 15) from Open-Meteo (free, no key). Uses the browser's
 * location, falling back to Bangkok; the last forecast is cached so the app
 * still shows something offline.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchWithTimeout } from '../../../core/sources/net';
import { useSettings } from '../../../core/settings/store';
import { Glyph } from '../os/glyphs';
import { os, usePrefs } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Spinner } from './shared';

export interface Wx {
  city: string;
  at: number;
  utcOffset: number;
  current: { temp: number; feels: number; humidity: number; isDay: boolean; code: number; wind: number; windDir: number; pressure: number; visibility: number };
  hourly: { time: string[]; temp: number[]; code: number[]; isDay: number[]; precip: number[] };
  daily: { time: string[]; code: number[]; max: number[]; min: number[]; sunrise: string[]; sunset: string[]; uv: number[]; precip: number[] };
}

const BANGKOK = { lat: 13.7563, lon: 100.5018, city: 'Bangkok' };

function position(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const t = window.setTimeout(() => resolve(null), 7000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        window.clearTimeout(t);
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => {
        window.clearTimeout(t);
        resolve(null);
      },
      { maximumAge: 30 * 60_000, timeout: 6500 },
    );
  });
}

async function cityName(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetchWithTimeout(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { timeout: 6000 });
    const j = (await r.json()) as { city?: string; locality?: string; principalSubdivision?: string };
    return j.city || j.locality || j.principalSubdivision || 'My Location';
  } catch {
    return 'My Location';
  }
}

export async function loadWeather(): Promise<Wx> {
  const pos = await position();
  const lat = pos?.lat ?? BANGKOK.lat;
  const lon = pos?.lon ?? BANGKOK.lon;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility' +
    '&hourly=temperature_2m,weather_code,is_day,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max' +
    '&timezone=auto&forecast_days=10';
  const [r, city] = await Promise.all([fetchWithTimeout(url, { timeout: 10_000 }), pos ? cityName(lat, lon) : Promise.resolve(BANGKOK.city)]);
  if (!r.ok) throw new Error(`Weather service error ${r.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await r.json()) as any;
  const c = j.current;
  return {
    city,
    at: Date.now(),
    utcOffset: j.utc_offset_seconds ?? 0,
    current: {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      isDay: !!c.is_day,
      code: c.weather_code,
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      pressure: c.pressure_msl,
      visibility: c.visibility,
    },
    hourly: { time: j.hourly.time, temp: j.hourly.temperature_2m, code: j.hourly.weather_code, isDay: j.hourly.is_day, precip: j.hourly.precipitation_probability },
    daily: {
      time: j.daily.time,
      code: j.daily.weather_code,
      max: j.daily.temperature_2m_max,
      min: j.daily.temperature_2m_min,
      sunrise: j.daily.sunrise,
      sunset: j.daily.sunset,
      uv: j.daily.uv_index_max,
      precip: j.daily.precipitation_probability_max,
    },
  };
}

// ------------------------------------------------------------------ conditions

export function condition(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return code >= 65 ? 'Heavy Rain' : 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Cloudy';
}

type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
function kind(code: number): Kind {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

export function WxIcon({ code, day, size = 22 }: { code: number; day: boolean; size?: number }) {
  const k = kind(code);
  if (k === 'clear') return day ? <Glyph name="sun.max.fill" size={size} style={{ color: '#ffd60a' }} /> : <Glyph name="moon.stars.fill" size={size} style={{ color: '#fff' }} />;
  if (k === 'partly')
    return (
      <span className="t7w-ico" style={{ width: size, height: size }}>
        <Glyph name={day ? 'sun.max.fill' : 'moon.fill'} size={size * 0.72} style={{ color: day ? '#ffd60a' : '#fff', position: 'absolute', right: -size * 0.05, top: -size * 0.08 }} />
        <Glyph name="cloud.fill" size={size * 0.86} style={{ color: '#fff', position: 'absolute', left: 0, bottom: 0 }} />
      </span>
    );
  const g = k === 'fog' ? 'cloud.fog.fill' : k === 'rain' ? 'cloud.rain.fill' : k === 'snow' ? 'cloud.snow.fill' : k === 'storm' ? 'cloud.bolt.fill' : 'cloud.fill';
  return <Glyph name={g} size={size} style={{ color: '#fff' }} />;
}

function sky(code: number | undefined, day: boolean): string {
  if (code === undefined) return 'linear-gradient(180deg, #2f6fc2 0%, #5d9be0 100%)';
  const k = kind(code);
  if (!day) {
    if (k === 'clear' || k === 'partly') return 'linear-gradient(180deg, #0b1630 0%, #1d3058 60%, #2c4373 100%)';
    return 'linear-gradient(180deg, #1b2230 0%, #323c4e 100%)';
  }
  if (k === 'clear') return 'linear-gradient(180deg, #2a6fd4 0%, #4f97ea 55%, #7db7f0 100%)';
  if (k === 'partly') return 'linear-gradient(180deg, #3a77c7 0%, #6aa1df 60%, #94bde8 100%)';
  if (k === 'rain' || k === 'storm') return 'linear-gradient(180deg, #404b5c 0%, #5f6d80 100%)';
  if (k === 'snow' || k === 'fog') return 'linear-gradient(180deg, #7d8a99 0%, #a5b0bc 100%)';
  return 'linear-gradient(180deg, #5d7493 0%, #8ea3bc 100%)';
}

// ------------------------------------------------------------------ app

export default function Weather() {
  const cached = usePrefs((s) => s.weather) as { at: number; data: Wx } | null;
  const unit = usePrefs((s) => s.weatherUnit);
  const use24h = useSettings((s) => s.use24h);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const wx = cached?.data ?? null;

  const refresh = () => {
    setLoading(true);
    setError(false);
    loadWeather()
      .then((d) => usePrefs.getState().set('weather', { at: Date.now(), data: d }))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!cached || Date.now() - cached.at > 20 * 60_000) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const T = (c: number) => Math.round(unit === 'F' ? (c * 9) / 5 + 32 : c);
  const day = wx ? wx.current.isDay : true;

  // "now" in the forecast's time zone
  const view = useMemo(() => {
    if (!wx) return null;
    const localNow = new Date(Date.now() + wx.utcOffset * 1000);
    const iso = localNow.toISOString().slice(0, 13);
    let i0 = wx.hourly.time.findIndex((t) => t.slice(0, 13) === iso);
    if (i0 < 0) i0 = 0;
    const hours = Array.from({ length: 24 }, (_, k) => i0 + k).filter((i) => i < wx.hourly.time.length);
    return { hours, today: 0 };
  }, [wx]);

  const fmtHour = (iso: string, idx: number) => {
    if (idx === 0) return 'Now';
    const h = Number(iso.slice(11, 13));
    return use24h ? `${String(h).padStart(2, '0')}` : `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`;
  };
  const fmtClock = (iso: string) => {
    const h = Number(iso.slice(11, 13));
    const m = iso.slice(14, 16);
    return use24h ? `${String(h).padStart(2, '0')}:${m}` : `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
  };

  const lo = wx ? Math.min(...wx.daily.min) : 0;
  const hi = wx ? Math.max(...wx.daily.max) : 1;

  return (
    <div className="t7w" style={{ background: sky(wx?.current.code, day) }}>
      <Scroller className="t7w-scroll">
        <div className="t7w-head">
          <div className="t7w-city">{wx?.city ?? BANGKOK.city}</div>
          <div className="t7w-temp">{wx ? `${T(wx.current.temp)}°` : loading ? '' : '--'}</div>
          <div className="t7w-cond">{wx ? condition(wx.current.code) : loading ? 'Updating…' : ''}</div>
          {wx && (
            <div className="t7w-hl">
              H:{T(wx.daily.max[0])}° L:{T(wx.daily.min[0])}°
            </div>
          )}
        </div>
        {loading && !wx && (
          <div className="t7a-loading">
            <Spinner light />
          </div>
        )}
        {!wx && error && (
          <div className="t7w-card t7w-err">
            <Glyph name="exclamationmark.triangle" size={26} />
            <div>Weather isn’t available right now. Check your internet connection.</div>
            <button onClick={refresh}>Try Again</button>
          </div>
        )}
        {wx && view && (
          <>
            {error && <div className="t7w-stale">Last updated {new Date(wx.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}
            <div className="t7w-card">
              <div className="t7w-summary">
                {condition(wx.daily.code[0])} conditions today. Wind gusts up to {Math.round(wx.current.wind)} km/h.
              </div>
              <Scroller axis="x" className="t7w-hours" innerClassName="t7w-hours-in">
                {view.hours.map((i, k) => (
                  <div key={i} className="t7w-hour">
                    <span className="h">{fmtHour(wx.hourly.time[i], k)}</span>
                    <span className="i">
                      <WxIcon code={wx.hourly.code[i]} day={!!wx.hourly.isDay[i]} size={24} />
                      {wx.hourly.precip[i] >= 30 && kind(wx.hourly.code[i]) !== 'clear' && <small>{wx.hourly.precip[i]}%</small>}
                    </span>
                    <span className="t">{T(wx.hourly.temp[i])}°</span>
                  </div>
                ))}
              </Scroller>
            </div>
            <div className="t7w-card">
              <div className="t7w-label">
                <Glyph name="calendar" size={12} /> 10-DAY FORECAST
              </div>
              {wx.daily.time.map((d, i) => {
                const a = ((wx.daily.min[i] - lo) / (hi - lo || 1)) * 100;
                const b = ((wx.daily.max[i] - lo) / (hi - lo || 1)) * 100;
                return (
                  <div key={d} className="t7w-day">
                    <span className="d">{i === 0 ? 'Today' : new Date(`${d}T12:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="i">
                      <WxIcon code={wx.daily.code[i]} day size={22} />
                      {wx.daily.precip[i] >= 30 && kind(wx.daily.code[i]) !== 'clear' && <small>{wx.daily.precip[i]}%</small>}
                    </span>
                    <span className="lo">{T(wx.daily.min[i])}°</span>
                    <span className="bar">
                      <i style={{ left: `${a}%`, right: `${100 - b}%` }} />
                      {i === 0 && <b style={{ left: `${((wx.current.temp - lo) / (hi - lo || 1)) * 100}%` }} />}
                    </span>
                    <span className="hi">{T(wx.daily.max[i])}°</span>
                  </div>
                );
              })}
            </div>
            <div className="t7w-tiles">
              <Tile glyph="sun.max.fill" label="UV INDEX" value={String(Math.round(wx.daily.uv[0] ?? 0))} sub={uvText(wx.daily.uv[0] ?? 0)} />
              <Tile glyph="sunrise" label="SUNSET" value={fmtClock(wx.daily.sunset[0])} sub={`Sunrise: ${fmtClock(wx.daily.sunrise[1] ?? wx.daily.sunrise[0])}`} />
              <Tile glyph="wind" label="WIND" value={`${Math.round(wx.current.wind)}`} unit="km/h" sub={compass(wx.current.windDir)} />
              <Tile glyph="drop" label="PRECIPITATION" value={`${wx.daily.precip[0] ?? 0}%`} sub="Chance today" />
              <Tile glyph="thermometer" label="FEELS LIKE" value={`${T(wx.current.feels)}°`} sub={wx.current.feels > wx.current.temp + 1 ? 'Humidity is making it feel warmer.' : 'Similar to the actual temperature.'} />
              <Tile glyph="humidity" label="HUMIDITY" value={`${Math.round(wx.current.humidity)}%`} sub={`The dew point is ${T(dew(wx.current.temp, wx.current.humidity))}° right now.`} />
              <Tile glyph="eye" label="VISIBILITY" value={`${Math.round((wx.current.visibility ?? 0) / 1000)}`} unit="km" sub={(wx.current.visibility ?? 0) > 9000 ? 'Perfectly clear view.' : 'Haze is affecting visibility.'} />
              <Tile glyph="gauge" label="PRESSURE" value={`${Math.round(wx.current.pressure)}`} unit="hPa" sub="" />
            </div>
            <div className="t7w-credit">Weather data by Open-Meteo.com</div>
          </>
        )}
      </Scroller>
      <div className="t7w-bar">
        <button aria-label="Map" onClick={() => os.toast('Weather Maps', 'map')}>
          <Glyph name="map" size={22} />
        </button>
        <div className="t7w-dots">
          <Glyph name="location.fill" size={10} />
          <span />
        </div>
        <button
          aria-label="List"
          onClick={() =>
            os.showMenu(
              [
                { label: 'Celsius', glyph: unit === 'C' ? 'checkmark' : undefined, onPress: () => usePrefs.getState().set('weatherUnit', 'C') },
                { label: 'Fahrenheit', glyph: unit === 'F' ? 'checkmark' : undefined, onPress: () => usePrefs.getState().set('weatherUnit', 'F') },
                { label: 'Refresh', glyph: 'arrow.clockwise', onPress: refresh },
              ],
              420,
            )
          }
        >
          <Glyph name="list.bullet" size={22} />
        </button>
      </div>
    </div>
  );
}

function Tile({ glyph, label, value, unit, sub }: { glyph: string; label: string; value: string; unit?: string; sub: string }) {
  return (
    <div className="t7w-tile">
      <div className="t7w-label">
        <Glyph name={glyph} size={12} /> {label}
      </div>
      <div className="t7w-tv">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="t7w-ts">{sub}</div>
    </div>
  );
}

function uvText(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}
function compass(deg: number): string {
  const d = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `Wind from the ${d[Math.round(((deg % 360) / 45)) % 8]}`;
}
function dew(t: number, rh: number): number {
  const a = 17.27;
  const b = 237.7;
  const g = (a * t) / (b + t) + Math.log(Math.max(1, rh) / 100);
  return (b * g) / (a - g);
}
