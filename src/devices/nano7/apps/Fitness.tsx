import { NavStack } from '../os/Nav';
import { Empty } from '../os/ui';
import { useAppNav } from './registry';

export function FitnessApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('fitness');
  return <NavStack root={{ title: 'Fitness', node: <Empty title="Fitness" /> }} tint="#007aff" active={active} apiRef={apiRef} />;
}
