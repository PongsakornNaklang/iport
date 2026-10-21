import { NavStack } from '../os/Nav';
import { Empty } from '../os/ui';
import { useAppNav } from './registry';

export function ClockApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('clock');
  return <NavStack root={{ title: 'Clock', node: <Empty title="Clock" /> }} tint="#007aff" active={active} apiRef={apiRef} />;
}
