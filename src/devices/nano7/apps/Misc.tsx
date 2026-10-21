import { NavStack } from '../os/Nav';
import { Empty } from '../os/ui';
import { useAppNav } from './registry';

export function ITunesUApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('itunesu');
  return <NavStack root={{ title: 'iTunes U', node: <Empty title="iTunes U" /> }} tint="#ff9500" active={active} apiRef={apiRef} />;
}
export function VoiceMemosApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('voicememos');
  return <NavStack root={{ title: 'Voice Memos', node: <Empty title="Voice Memos" /> }} tint="#ff3b30" active={active} apiRef={apiRef} />;
}
