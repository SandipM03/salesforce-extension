import { formatCurrency, truncate } from '../utils/format';

const STAGES = [
  'Prospecting',
  'Qualification', 
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost'
];

function matchStage(oppStage) {
  if (!oppStage) return 'Prospecting';
  const s = oppStage.toLowerCase();
  return STAGES.find(stage => 
    s.includes(stage.toLowerCase().split(' ')[0])
  ) || 'Prospecting';
}

export default function KanbanView({ records }) {
  // Group records by stage
  const byStage = {};
  STAGES.forEach(s => byStage[s] = []);
  
  records.forEach(opp => {
    const stage = matchStage(opp.stage);
    byStage[stage].push(opp);
  });
  
  const stageColors = {
    'Prospecting': 'bg-gray-100',
    'Qualification': 'bg-blue-50',
    'Proposal': 'bg-orange-50',
    'Negotiation': 'bg-red-50',
    'Closed Won': 'bg-green-50',
    'Closed Lost': 'bg-gray-200'
  };
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {STAGES.map(stage => (
        <div key={stage} className={`min-w-[130px] shrink-0 rounded-lg p-2 ${stageColors[stage]}`}>
          <div className="text-[10px] font-semibold uppercase text-gray-500 mb-2 px-1">
            {stage} ({byStage[stage].length})
          </div>
          
          <div className="space-y-2">
            {byStage[stage].map((opp, idx) => (
              <div key={opp.id || idx} className="bg-white border border-gray-200 rounded p-2 shadow-sm">
                <div className="text-[11px] font-medium text-gray-800 mb-1">
                  {truncate(opp.name, 18)}
                </div>
                <div className="text-[11px] font-semibold text-sf-blue">
                  {formatCurrency(opp.amount)}
                </div>
              </div>
            ))}
            
            {byStage[stage].length === 0 && (
              <div className="text-[10px] text-gray-400 text-center py-4">
                No opps
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
