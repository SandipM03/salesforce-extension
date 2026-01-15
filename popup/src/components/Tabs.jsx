export default function Tabs({ tabs, activeTab, data, onTabChange }) {
  return (
    <div className="flex bg-white border-b border-gray-200 shrink-0">
      {tabs.map(tab => {
        const count = data[tab.id]?.records?.length || 0;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`tab ${isActive ? 'tab-active' : ''}`}
          >
            {tab.label}
            <span className={`ml-1 min-w-[18px] px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
              isActive ? 'bg-sf-blue text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
