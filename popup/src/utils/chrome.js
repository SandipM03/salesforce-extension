/**
 * Chrome Extension API utilities
 */

// Check if chrome API is available
const isChromeAvailable = typeof chrome !== 'undefined' && chrome.runtime;

/**
 * Send message to service worker
 */
export async function sendMessage(message) {
  if (!isChromeAvailable) {
    console.warn('[Popup] Chrome API not available');
    return null;
  }
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

/**
 * Load all stored data
 */
export async function loadAllData() {
  const response = await sendMessage({ type: 'GET_ALL_DATA' });
  return response;
}

/**
 * Check if current tab is Salesforce
 */
export async function checkSalesforcePage() {
  return await sendMessage({ type: 'CHECK_SALESFORCE_PAGE' });
}

/**
 * Trigger extraction on active tab
 */
export async function triggerExtraction(objectType = null) {
  return await sendMessage({ type: 'TRIGGER_EXTRACTION', objectType });
}

/**
 * Clear all data
 */
export async function clearAllData() {
  return await sendMessage({ type: 'CLEAR_ALL_DATA' });
}

/**
 * Delete a specific record
 */
export async function deleteRecord(objectType, recordId) {
  return await sendMessage({ type: 'DELETE_RECORD', objectType, recordId });
}
