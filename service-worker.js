/**
 * Salesforce CRM Extractor - Service Worker
 * Handles storage, deduplication, and message routing
 */

// ============================================
// STORAGE KEYS
// ============================================

// Keys match singular names from content script (OPPORTUNITY, LEAD, etc.)
const STORAGE_KEYS = {
  OPPORTUNITY: 'sf_opportunities',
  LEAD: 'sf_leads',
  CONTACT: 'sf_contacts',
  ACCOUNT: 'sf_accounts',
  TASK: 'sf_tasks',
  METADATA: 'sf_metadata'
};

// Mapping from plural (popup) to singular (storage)
const PLURAL_TO_SINGULAR = {
  opportunities: 'OPPORTUNITY',
  leads: 'LEAD',
  contacts: 'CONTACT',
  accounts: 'ACCOUNT',
  tasks: 'TASK'
};

// ============================================
// STORAGE HELPERS
// ============================================

/**
 * Get data from Chrome local storage
 */
async function getStoredData(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] || { records: [], lastSync: null };
  } catch (error) {
    console.error(`[SF Extractor] Error reading ${key}:`, error);
    return { records: [], lastSync: null };
  }
}

/**
 * Save data to Chrome local storage atomically
 */
async function saveData(key, data) {
  try {
    await chrome.storage.local.set({ [key]: data });
    console.log(`[SF Extractor] Saved ${data.records.length} records to ${key}`);
    return true;
  } catch (error) {
    console.error(`[SF Extractor] Error saving ${key}:`, error);
    return false;
  }
}

/**
 * Clear all stored data
 */
async function clearAllData() {
  try {
    await chrome.storage.local.clear();
    console.log('[SF Extractor] All data cleared');
    return true;
  } catch (error) {
    console.error('[SF Extractor] Error clearing data:', error);
    return false;
  }
}

/**
 * Clear specific object type data
 */
async function clearObjectData(objectType) {
  // Handle both singular and plural forms
  const singular = PLURAL_TO_SINGULAR[objectType.toLowerCase()] || objectType.toUpperCase();
  const key = STORAGE_KEYS[singular];
  if (!key) {
    return false;
  }
  try {
    await chrome.storage.local.remove(key);
    console.log(`[SF Extractor] Cleared ${objectType} data`);
    return true;
  } catch (error) {
    console.error(`[SF Extractor] Error clearing ${objectType}:`, error);
    return false;
  }
}

// ============================================
// DEDUPLICATION & MERGE LOGIC
// ============================================

/**
 * Deduplicate and merge incoming records with existing data
 * Never overwrites blindly - updates existing, inserts new
 */
function deduplicateAndMerge(existingRecords, incomingRecords) {
  const recordMap = new Map();
  
  // Index existing records by ID
  for (const record of existingRecords) {
    if (record.id) {
      recordMap.set(record.id, record);
    }
  }
  
  // Merge incoming records
  for (const incoming of incomingRecords) {
    if (!incoming.id) {
      console.warn('[SF Extractor] Skipping record without ID:', incoming);
      continue;
    }
    
    const existing = recordMap.get(incoming.id);
    
    if (existing) {
      // Update existing record - merge fields, keep newer data
      recordMap.set(incoming.id, {
        ...existing,
        ...incoming,
        updatedAt: new Date().toISOString(),
        createdAt: existing.createdAt || incoming.createdAt
      });
    } else {
      // Insert new record
      recordMap.set(incoming.id, {
        ...incoming,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }
  
  return Array.from(recordMap.values());
}

/**
 * Process and store extracted data
 */
async function processExtractedData(objectType, records) {
  if (!records || records.length === 0) {
    return { success: true, count: 0 };
  }
  
  // Handle both singular and plural forms
  const singular = PLURAL_TO_SINGULAR[objectType.toLowerCase()] || objectType.toUpperCase();
  const key = STORAGE_KEYS[singular];
  if (!key) {
    console.error(`[SF Extractor] Unknown object type: ${objectType}`);
    return { success: false, error: 'Unknown object type' };
  }
  
  // Load existing data
  const existingData = await getStoredData(key);
  
  // Deduplicate and merge
  const mergedRecords = deduplicateAndMerge(existingData.records, records);
  
  // Save atomically
  const dataToSave = {
    records: mergedRecords,
    lastSync: new Date().toISOString(),
    objectType: objectType
  };
  
  const success = await saveData(key, dataToSave);
  
  return {
    success,
    count: mergedRecords.length,
    newRecords: mergedRecords.length - existingData.records.length
  };
}

// ============================================
// DATA RETRIEVAL
// ============================================

/**
 * Get all stored data for popup display
 */
async function getAllStoredData() {
  const data = {};
  
  // Return data with plural keys for popup compatibility
  const typeMapping = {
    OPPORTUNITY: 'opportunities',
    LEAD: 'leads',
    CONTACT: 'contacts',
    ACCOUNT: 'accounts',
    TASK: 'tasks'
  };
  
  for (const [objectType, key] of Object.entries(STORAGE_KEYS)) {
    if (objectType !== 'METADATA') {
      const stored = await getStoredData(key);
      const pluralKey = typeMapping[objectType] || objectType.toLowerCase();
      data[pluralKey] = stored;
    }
  }
  
  return data;
}

/**
 * Get data for specific object type
 */
async function getObjectData(objectType) {
  // Handle both singular and plural forms
  const singular = PLURAL_TO_SINGULAR[objectType.toLowerCase()] || objectType.toUpperCase();
  const key = STORAGE_KEYS[singular];
  if (!key) {
    return { success: false, error: 'Unknown object type' };
  }
  
  const data = await getStoredData(key);
  return { success: true, data };
}

/**
 * Delete a specific record by ID
 */
async function deleteRecord(objectType, recordId) {
  // Handle both singular and plural forms
  const singular = PLURAL_TO_SINGULAR[objectType.toLowerCase()] || objectType.toUpperCase();
  const key = STORAGE_KEYS[singular];
  if (!key) {
    return { success: false, error: 'Unknown object type' };
  }
  
  const existingData = await getStoredData(key);
  const filteredRecords = existingData.records.filter(r => r.id !== recordId);
  
  if (filteredRecords.length === existingData.records.length) {
    return { success: false, error: 'Record not found' };
  }
  
  const dataToSave = {
    ...existingData,
    records: filteredRecords,
    lastSync: new Date().toISOString()
  };
  
  const success = await saveData(key, dataToSave);
  return { success, remainingCount: filteredRecords.length };
}

// ============================================
// MESSAGE HANDLING
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SF Extractor] Message received:', message.type);
  
  // Handle async operations
  (async () => {
    let response;
    
    switch (message.type) {
      // From content script: extracted data
      case 'EXTRACTED_DATA':
        response = await processExtractedData(message.objectType, message.records);
        break;
      
      // From popup: get all data
      case 'GET_ALL_DATA':
        response = await getAllStoredData();
        break;
      
      // From popup: get specific object data
      case 'GET_OBJECT_DATA':
        response = await getObjectData(message.objectType);
        break;
      
      // From popup: clear all data
      case 'CLEAR_ALL_DATA':
        response = { success: await clearAllData() };
        break;
      
      // From popup: clear specific object data
      case 'CLEAR_OBJECT_DATA':
        response = { success: await clearObjectData(message.objectType) };
        break;
      
      // From popup: delete specific record
      case 'DELETE_RECORD':
        response = await deleteRecord(message.objectType, message.recordId);
        break;
      
      // From popup: trigger extraction on active tab
      case 'TRIGGER_EXTRACTION':
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await chrome.tabs.sendMessage(tab.id, { 
              type: 'EXTRACT_NOW',
              objectType: message.objectType 
            });
            response = { success: true };
          } else {
            response = { success: false, error: 'No active tab' };
          }
        } catch (error) {
          response = { success: false, error: error.message };
        }
        break;
      
      // From popup: check if on Salesforce page
      case 'CHECK_SALESFORCE_PAGE':
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const isSalesforce = tab?.url?.includes('salesforce.com') || 
                              tab?.url?.includes('force.com');
          response = { isSalesforce, url: tab?.url };
        } catch (error) {
          response = { isSalesforce: false, error: error.message };
        }
        break;
      
      default:
        response = { success: false, error: 'Unknown message type' };
    }
    
    sendResponse(response);
  })();
  
  // Return true to indicate async response
  return true;
});

// ============================================
// INSTALLATION HANDLER
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SF Extractor] Extension installed:', details.reason);
  
  // Initialize metadata
  chrome.storage.local.set({
    [STORAGE_KEYS.METADATA]: {
      installedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    }
  });
});

console.log('[SF Extractor] Service worker initialized');
