import { formatCurrency, formatDate, getStageConfig, truncate } from '../utils/format';

// Column definitions per object type
const COLUMNS = {
  opportunities: [
    { key: 'name', label: 'Name', format: (v) => truncate(v, 25) },
    { key: 'amount', label: 'Amount', format: formatCurrency },
    { key: 'stage', label: 'Stage', format: (v) => v, isStage: true },
    { key: 'closeDate', label: 'Close Date', format: formatDate },
  ],
  leads: [
    { key: 'name', label: 'Name', format: (v) => truncate(v, 20) },
    { key: 'company', label: 'Company', format: (v) => truncate(v, 20) },
    { key: 'status', label: 'Status' },
    { key: 'email', label: 'Email', format: (v) => truncate(v, 20) },
  ],
  contacts: [
    { key: 'name', label: 'Name', format: (v) => truncate(v, 20) },
    { key: 'accountName', label: 'Account', format: (v) => truncate(v, 15) },
    { key: 'email', label: 'Email', format: (v) => truncate(v, 20) },
    { key: 'phone', label: 'Phone' },
  ],
  accounts: [
    { key: 'name', label: 'Name', format: (v) => truncate(v, 25) },
    { key: 'industry', label: 'Industry' },
    { key: 'type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
  ],
  tasks: [
    { key: 'subject', label: 'Subject', format: (v) => truncate(v, 25) },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'dueDate', label: 'Due Date', format: formatDate },
  ],
};

export default function DataTable({ records, objectType, onDelete }) {
  const columns = COLUMNS[objectType] || COLUMNS.opportunities;
  
  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50">
            {columns.map(col => (
              <th key={col.key} className="table-cell font-semibold text-gray-500 text-[11px] uppercase tracking-wide">
                {col.label}
              </th>
            ))}
            <th className="table-cell w-8"></th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr key={record.id || idx} className="hover:bg-blue-50/30">
              {columns.map(col => {
                const value = record[col.key];
                const formatted = col.format ? col.format(value) : (value || '-');
                
                if (col.isStage) {
                  const stageConfig = getStageConfig(value);
                  return (
                    <td key={col.key} className="table-cell">
                      <span className={`badge ${stageConfig.class}`}>
                        {truncate(stageConfig.label, 12)}
                      </span>
                    </td>
                  );
                }
                
                return (
                  <td key={col.key} className="table-cell text-gray-700" title={value}>
                    {formatted}
                  </td>
                );
              })}
              <td className="table-cell">
                <button 
                  onClick={() => onDelete(record.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-sf-red hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
