import { Panel } from '../Panel';
export default function CustomizePanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Customize" side="right" onClose={onClose}>
      <p className="muted">Coming up.</p>
    </Panel>
  );
}
