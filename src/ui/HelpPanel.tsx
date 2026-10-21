import { Panel } from './Panel';
export default function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="How to use" side="right" onClose={onClose}>
      <p className="muted">Coming up.</p>
    </Panel>
  );
}
