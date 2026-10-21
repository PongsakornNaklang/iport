import { describe, expect, it } from 'vitest';
import { episodeTrack, parseApplePodcastUrl, parseFeed } from './podcasts';
import { parseXml, textOf, child } from './xml';
import { decodeEntities, parseClock, stripHtml } from './text';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generator: test -->
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>The Test &amp; Show</title>
    <link>https://example.com</link>
    <itunes:author>Jane Doe</itunes:author>
    <itunes:image href="https://example.com/cover.jpg"/>
    <description><![CDATA[<p>A show about <b>tests</b>.</p>]]></description>
    <item>
      <title>Episode 1: Hello</title>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
      <enclosure url="http://cdn.example.com/ep1.mp3?x=1&amp;y=2" length="123" type="audio/mpeg"/>
      <itunes:duration>01:02:03</itunes:duration>
      <itunes:episode>1</itunes:episode>
      <guid isPermaLink="false">ep-1</guid>
      <description>First &lt;i&gt;episode&lt;/i&gt; &#8211; welcome!</description>
    </item>
    <item>
      <title><![CDATA[Episode 2 <video>]]></title>
      <pubDate>Mon, 08 Jan 2024 10:00:00 PST</pubDate>
      <enclosure url="https://cdn.example.com/ep2.mp4" type="video/mp4" />
      <itunes:duration>754</itunes:duration>
      <itunes:image href="https://example.com/ep2.jpg" />
      <content:encoded><![CDATA[<p>Line one</p><p>Line&nbsp;two</p>]]></content:encoded>
    </item>
    <item>
      <title>No media — skipped</title>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Cast</title>
  <author><name>Atom Author</name></author>
  <logo>https://example.com/logo.png</logo>
  <entry>
    <title>Atom ep</title>
    <published>2023-05-02T12:00:00Z</published>
    <link rel="alternate" href="https://example.com/ep"/>
    <link rel="enclosure" type="audio/mp4" href="https://example.com/a.m4a"/>
    <summary>Hi</summary>
  </entry>
</feed>`;

describe('xml', () => {
  it('parses elements, attributes, entities and CDATA', () => {
    const doc = parseXml('<a x="1" y=\'two &amp; three\'><b>hi &lt;there&gt;</b><c/><![CDATA[<raw>]]></a>');
    const a = child(doc, 'a')!;
    expect(a.attrs).toEqual({ x: '1', y: 'two & three' });
    expect(textOf(a, 'b')).toBe('hi <there>');
    expect(a.text).toBe('<raw>');
    expect(a.children.map((c) => c.name)).toEqual(['b', 'c']);
  });
  it('tolerates unclosed tags and stray <', () => {
    const doc = parseXml('<r><p>one<p>two</r> 1 < 2');
    expect(child(doc, 'r')!.children.length).toBe(1);
  });
});

describe('text helpers', () => {
  it('decodes and strips', () => {
    expect(decodeEntities('&amp;&#39;&#x1F600;&hellip;&bogus;')).toBe("&'😀…&bogus;");
    expect(stripHtml('<p>Hello<br>world</p><ul><li>a</li></ul>')).toBe('Hello\nworld\n• a');
  });
  it('parses clocks', () => {
    expect(parseClock('01:02:03')).toBe(3723);
    expect(parseClock('5:07')).toBe(307);
    expect(parseClock('754')).toBe(754);
    expect(parseClock('nope')).toBeUndefined();
  });
});

describe('parseFeed', () => {
  it('reads RSS 2.0 podcasts', () => {
    const f = parseFeed(RSS);
    expect(f.title).toBe('The Test & Show');
    expect(f.author).toBe('Jane Doe');
    expect(f.artwork).toBe('https://example.com/cover.jpg');
    expect(f.description).toBe('A show about tests.');
    expect(f.episodes).toHaveLength(2);
    const [ep2, ep1] = f.episodes; // newest first
    expect(ep1).toMatchObject({
      guid: 'ep-1',
      title: 'Episode 1: Hello',
      url: 'http://cdn.example.com/ep1.mp3?x=1&y=2',
      video: false,
      duration: 3723,
      episode: 1,
      description: 'First episode – welcome!',
      pubDate: Date.UTC(2024, 0, 1, 10),
    });
    expect(ep2).toMatchObject({ title: 'Episode 2 <video>', video: true, duration: 754, artwork: 'https://example.com/ep2.jpg', description: 'Line one\nLine two' });
    expect(ep2.pubDate).toBeGreaterThan(ep1.pubDate!);
  });

  it('reads Atom feeds', () => {
    const f = parseFeed(ATOM);
    expect(f.title).toBe('Atom Cast');
    expect(f.author).toBe('Atom Author');
    expect(f.artwork).toBe('https://example.com/logo.png');
    expect(f.episodes).toEqual([
      expect.objectContaining({ title: 'Atom ep', url: 'https://example.com/a.m4a', pubDate: Date.UTC(2023, 4, 2, 12), description: 'Hi' }),
    ]);
  });

  it('rejects non-feeds', () => {
    expect(() => parseFeed('<html><body>hi</body></html>')).toThrow(/podcast feed/);
  });

  it('makes podcast tracks', () => {
    const f = parseFeed(RSS);
    const t = episodeTrack(f, f.episodes[1]);
    expect(t).toMatchObject({ source: 'podcast', mediaType: 'podcast', show: 'The Test & Show', album: 'The Test & Show', artist: 'Jane Doe', artwork: 'https://example.com/cover.jpg', duration: 3723 });
    expect(episodeTrack(f, f.episodes[0]).hasVideo).toBe(true);
  });

  it('reads Apple Podcasts links', () => {
    expect(parseApplePodcastUrl('https://podcasts.apple.com/th/podcast/the-daily/id1200361736?i=1000')).toBe('1200361736');
    expect(parseApplePodcastUrl('https://example.com/id123')).toBeNull();
  });
});
