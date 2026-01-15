import { formatCurrency } from '../utils/format';

export default function StatsGrid({ records }) {
  const totalAmount = records.reduce((sum, o) => {
    const amt = typeof o.amount === 'number' ? o.amount : parseFloat(o.amount) || 0;
    return sum + amt;
  }, 0);
  
  const openOpps = records.filter(o => 
    !o.stage?.toLowerCase().includes('closed')
  ).length;
  
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      <div className="card p-3 text-center">
        <div className="text-xl font-bold text-sf-blue">{records.length}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Opportunities</div>
      </div>
      <div className="card p-3 text-center">
        <div className="text-xl font-bold text-sf-blue">{formatCurrency(totalAmount)}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Pipeline</div>
      </div>
      <div className="card p-3 text-center">
        <div className="text-xl font-bold text-sf-blue">{openOpps}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Open</div>
      </div>
    </div>
  );
}
