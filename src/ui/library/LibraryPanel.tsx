import { Panel } from '../Panel';
export default function LibraryPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Library" side="left" onClose={onClose}>
      <p className="muted">Coming up.</p>
    </Panel>
  );
}
