export default function EmptyState({ objectType }) {
  const labels = {
    opportunities: 'opportunities',
    leads: 'leads',
    contacts: 'contacts',
    accounts: 'accounts',
    tasks: 'tasks'
  };
  
  return (
    <div className="card text-center py-10 px-5">
      <div className="text-4xl mb-3 opacity-50">📭</div>
      <h3 className="text-sm font-medium text-gray-800 mb-1">
        No {labels[objectType] || 'records'} found
      </h3>
      <p className="text-xs text-gray-500">
        Navigate to Salesforce and data will be extracted automatically.
      </p>
    </div>
  );
}
