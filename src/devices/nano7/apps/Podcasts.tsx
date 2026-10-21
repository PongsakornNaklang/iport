import { NavStack } from '../os/Nav';
import { Empty } from '../os/ui';
import { useAppNav } from './registry';

export function PodcastsApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('podcasts');
  return <NavStack root={{ title: 'Podcasts', node: <Empty title="Podcasts" /> }} tint="#007aff" active={active} apiRef={apiRef} />;
}
