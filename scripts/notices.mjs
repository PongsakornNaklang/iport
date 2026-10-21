// Writes the licenses of every open-source package that ships in the app
// to public/third-party-notices.txt and THIRD-PARTY-NOTICES.md.
// Runs automatically before `npm run build` (see "prebuild").
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dirs = execSync('npm ls --omit=dev --all --parseable', { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n')
  .slice(1);

const seen = new Map();
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (pkg.name.startsWith('@types/') || seen.has(pkg.name)) continue;
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const text = file ? readFileSync(join(dir, file), 'utf8').trim() : `Licensed under ${pkg.license}.`;
  const license = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? 'UNKNOWN');
  const repo = (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url) ?? pkg.homepage ?? '';
  seen.set(pkg.name, { name: pkg.name, version: pkg.version, license, repo, text });
}
const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));

const header = 'iPort includes the following open-source software. Each remains under its own license.';
const txt = [header, '', ...list.map((p) => `${'='.repeat(72)}\n${p.name} ${p.version} (${p.license})\n${p.repo}\n\n${p.text}\n`)].join('\n');
writeFileSync(join(root, 'public/third-party-notices.txt'), txt);

const md = [
  '# Third-party notices',
  '',
  header,
  'The full license texts ship with every build as `third-party-notices.txt`.',
  '',
  '| Package | Version | License |',
  '| --- | --- | --- |',
  ...list.map((p) => `| ${p.name} | ${p.version} | ${p.license} |`),
  '',
].join('\n');
writeFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), md);
if (!existsSync(join(root, 'public'))) throw new Error('public/ missing');
console.log(`notices: ${list.length} packages`);
