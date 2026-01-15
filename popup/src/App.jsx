import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import SearchBar from './components/SearchBar';
import ActionsBar from './components/ActionsBar';
import StatsGrid from './components/StatsGrid';
import DataTable from './components/DataTable';
import KanbanView from './components/KanbanView';
import EmptyState from './components/EmptyState';
import Footer from './components/Footer';
import { sendMessage, loadAllData, checkSalesforcePage } from './utils/chrome';

const TABS = [
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'leads', label: 'Leads' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'tasks', label: 'Tasks' },
];

const INITIAL_DATA = {
  opportunities: { records: [], lastSync: null },
  leads: { records: [], lastSync: null },
  contacts: { records: [], lastSync: null },
  accounts: { records: [], lastSync: null },
  tasks: { records: [], lastSync: null },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('opportunities');
  const [data, setData] = useState(INITIAL_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // table | kanban | raw
  const [isSalesforcePage, setIsSalesforcePage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const [sfCheck, storedData] = await Promise.all([
        checkSalesforcePage(),
        loadAllData()
      ]);
      setIsSalesforcePage(sfCheck?.isSalesforce || false);
      if (storedData) setData(storedData);
      setIsLoading(false);
    }
    init();
  }, []);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    await sendMessage({ type: 'TRIGGER_EXTRACTION' });
    // Wait a bit for extraction to complete
    setTimeout(async () => {
      const storedData = await loadAllData();
      if (storedData) setData(storedData);
    }, 1000);
  }, []);

  // Clear all data
  const handleClearAll = useCallback(async () => {
    if (!confirm('Clear all stored data?')) return;
    await sendMessage({ type: 'CLEAR_ALL_DATA' });
    setData(INITIAL_DATA);
  }, []);

  // Delete single record
  const handleDeleteRecord = useCallback(async (objectType, recordId) => {
    await sendMessage({ type: 'DELETE_RECORD', objectType, recordId });
    const storedData = await loadAllData();
    if (storedData) setData(storedData);
  }, []);

  // Filter records by search
  const getFilteredRecords = useCallback(() => {
    const records = data[activeTab]?.records || [];
    if (!searchQuery) return records;
    
    const query = searchQuery.toLowerCase();
    return records.filter(record =>
      Object.values(record).some(val => {
        if (typeof val === 'string') return val.toLowerCase().includes(query);
        if (typeof val === 'number') return val.toString().includes(query);
        return false;
      })
    );
  }, [data, activeTab, searchQuery]);

  const filteredRecords = getFilteredRecords();
  const currentData = data[activeTab] || { records: [], lastSync: null };

  // Toggle view mode
  const cycleViewMode = () => {
    setViewMode(prev => prev === 'table' ? 'kanban' : prev === 'kanban' ? 'raw' : 'table');
  };

  if (isLoading) {
    return (
      <div className="w-[500px] h-[400px] flex items-center justify-center bg-gray-100">
        <div className="w-6 h-6 border-3 border-gray-300 border-t-sf-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-[500px] min-h-[400px] max-h-[600px] flex flex-col bg-gray-100 text-gray-900 text-[13px]">
      <Header isSalesforcePage={isSalesforcePage} />
      
      <Tabs 
        tabs={TABS} 
        activeTab={activeTab} 
        data={data} 
        onTabChange={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-3">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        
        <ActionsBar 
          viewMode={viewMode}
          onRefresh={handleRefresh}
          onCycleView={cycleViewMode}
          onClear={handleClearAll}
        />
        
        {activeTab === 'opportunities' && (
          <StatsGrid records={data.opportunities?.records || []} />
        )}
        
        {filteredRecords.length === 0 ? (
          <EmptyState objectType={activeTab} />
        ) : viewMode === 'raw' ? (
          <pre className="bg-gray-900 text-gray-300 p-3 rounded-lg text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
            {JSON.stringify(currentData, null, 2)}
          </pre>
        ) : viewMode === 'kanban' && activeTab === 'opportunities' ? (
          <KanbanView records={filteredRecords} />
        ) : (
          <DataTable 
            records={filteredRecords} 
            objectType={activeTab}
            onDelete={(id) => handleDeleteRecord(activeTab, id)}
          />
        )}
      </div>
      
      <Footer lastSync={currentData.lastSync} />
    </div>
  );
}
