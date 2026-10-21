import type { ComponentType } from 'react';
import { Page } from '../os/ui';
const mk = (t: string) => () => <Page title={t} />;
export const STUBS: Record<string, ComponentType> = {
  messages: mk('Messages'), facetime: mk('FaceTime'), mail: mk('Mailboxes'), maps: mk('Maps'), appstore: mk('Today'), books: mk('Reading Now'),
  findmy: mk('Find My'), home: mk('Home'), files: mk('Browse'), shortcuts: mk('Shortcuts'), translate: mk('Translate'), tips: mk('Tips'),
};
