import { NavStack } from '../os/Nav';
import { Empty } from '../os/ui';
import { useAppNav } from './registry';

export function PhotosApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('photos');
  return <NavStack root={{ title: 'Photos', node: <Empty title="Photos" /> }} tint="#007aff" active={active} apiRef={apiRef} />;
}
