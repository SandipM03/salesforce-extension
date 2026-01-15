export default function ActionsBar({ viewMode, onRefresh, onCycleView, onClear }) {
  const viewLabels = { table: '📋 Table', kanban: '📊 Kanban', raw: '{ } Raw' };
  
  return (
    <div className="flex gap-2 mb-3">
      <button onClick={onRefresh} className="btn btn-primary">
        ↻ Refresh
      </button>
      <button onClick={onCycleView} className="btn btn-secondary">
        {viewLabels[viewMode] || '📋 Table'}
      </button>
      <button onClick={onClear} className="btn btn-danger text-[11px] px-2">
        🗑 Clear
      </button>
    </div>
  );
}
