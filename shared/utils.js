/**
 * Salesforce CRM Extractor - Shared Utilities
 * Common helpers used across content scripts
 */

// ============================================
// FIELD DEFINITIONS
// ============================================

export const OPPORTUNITY_FIELDS = {
  name: ['Opportunity Name', 'Name'],
  amount: ['Amount'],
  stage: ['Stage'],
  probability: ['Probability (%)', 'Probability'],
  closeDate: ['Close Date'],
  accountName: ['Account Name'],
  ownerName: ['Opportunity Owner', 'Owner'],
  type: ['Type'],
  leadSource: ['Lead Source'],
  nextStep: ['Next Step'],
  description: ['Description']
};

export const LEAD_FIELDS = {
  name: ['Name', 'Lead Name'],
  company: ['Company'],
  email: ['Email'],
  phone: ['Phone'],
  status: ['Lead Status', 'Status'],
  leadSource: ['Lead Source'],
  industry: ['Industry'],
  rating: ['Rating'],
  ownerName: ['Lead Owner', 'Owner'],
  title: ['Title'],
  website: ['Website']
};

export const CONTACT_FIELDS = {
  name: ['Name', 'Contact Name'],
  accountName: ['Account Name'],
  email: ['Email'],
  phone: ['Phone'],
  mobilePhone: ['Mobile'],
  title: ['Title'],
  department: ['Department'],
  ownerName: ['Contact Owner', 'Owner']
};

export const ACCOUNT_FIELDS = {
  name: ['Account Name', 'Name'],
  industry: ['Industry'],
  type: ['Type'],
  phone: ['Phone'],
  website: ['Website'],
  ownerName: ['Account Owner', 'Owner'],
  annualRevenue: ['Annual Revenue'],
  employees: ['Employees']
};

export const TASK_FIELDS = {
  subject: ['Subject'],
  dueDate: ['Due Date'],
  status: ['Status'],
  priority: ['Priority'],
  relatedTo: ['Related To', 'Name'],
  assignedTo: ['Assigned To']
};

// ============================================
// VALUE NORMALIZATION
// ============================================

/**
 * Normalize extracted values - clean up whitespace, parse numbers
 */
export function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  
  let normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ');
  
  // Empty string check
  if (!normalized || normalized === '-' || normalized === '--') {
    return null;
  }
  
  // Currency parsing ($1,234.56)
  const currencyMatch = normalized.match(/^\$?([\d,]+(?:\.\d{2})?)$/);
  if (currencyMatch) {
    return parseFloat(currencyMatch[1].replace(/,/g, ''));
  }
  
  // Percentage parsing (50%)
  const percentMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]);
  }
  
  // Number parsing (plain numbers)
  if (/^[\d,]+$/.test(normalized)) {
    return parseInt(normalized.replace(/,/g, ''), 10);
  }
  
  return normalized;
}

/**
 * Parse Salesforce date formats
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Already ISO format
  if (dateStr.includes('T')) {
    return dateStr;
  }
  
  // Common SF formats: "1/15/2026", "Jan 15, 2026"
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }
  
  return dateStr;
}

// ============================================
// DOM HELPERS
// ============================================

/**
 * Wait for DOM element with timeout
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element not found: ${selector}`));
      } else {
        requestAnimationFrame(check);
      }
    }
    
    check();
  });
}

/**
 * Wait for condition with timeout
 */
export function waitUntil(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      if (condition()) {
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Condition timeout'));
      } else {
        requestAnimationFrame(check);
      }
    }
    
    check();
  });
}

/**
 * Observe until condition met, then execute callback
 */
export function observeUntil(container, condition, callback, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Check immediately
    if (condition()) {
      const result = callback();
      resolve(result);
      return;
    }
    
    const observer = new MutationObserver(() => {
      if (condition()) {
        observer.disconnect();
        const result = callback();
        resolve(result);
      } else if (Date.now() - startTime > timeout) {
        observer.disconnect();
        reject(new Error('Observer timeout'));
      }
    });
    
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Fallback timeout
    setTimeout(() => {
      observer.disconnect();
      if (condition()) {
        resolve(callback());
      } else {
        reject(new Error('Observer timeout (fallback)'));
      }
    }, timeout);
  });
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================
// SALESFORCE SPECIFIC HELPERS
// ============================================

/**
 * Extract Salesforce record ID from URL
 */
export function extractRecordIdFromUrl(url = window.location.href) {
  // Pattern 1: /r/Object/ID/view
  const rMatch = url.match(/\/r\/\w+\/([a-zA-Z0-9]{15,18})\/view/);
  if (rMatch) return rMatch[1];
  
  // Pattern 2: /Object/ID/...
  const directMatch = url.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$|\?)/);
  if (directMatch) return directMatch[1];
  
  // Pattern 3: recordId query param
  const params = new URLSearchParams(url.split('?')[1] || '');
  const recordId = params.get('recordId');
  if (recordId) return recordId;
  
  return null;
}

/**
 * Detect Salesforce object type from URL
 */
export function detectObjectTypeFromUrl(url = window.location.href) {
  // Object API names in URL
  const objectPatterns = {
    Opportunity: ['/Opportunity/', '/006/'],
    Lead: ['/Lead/', '/00Q/'],
    Contact: ['/Contact/', '/003/'],
    Account: ['/Account/', '/001/'],
    Task: ['/Task/', '/00T/'],
    Event: ['/Event/', '/00U/'],
    Case: ['/Case/', '/500/']
  };
  
  for (const [objectType, patterns] of Object.entries(objectPatterns)) {
    if (patterns.some(p => url.includes(p))) {
      return objectType;
    }
  }
  
  // Check objectApiName query param
  const params = new URLSearchParams(url.split('?')[1] || '');
  const apiName = params.get('objectApiName');
  if (apiName) {
    return apiName;
  }
  
  return null;
}

/**
 * Check if Lightning Experience page
 */
export function isLightningExperience() {
  return !!(
    document.querySelector('[class*="oneAlohaPage"]') ||
    document.querySelector('[class*="slds-"]') ||
    document.querySelector('lightning-formatted-text')
  );
}

/**
 * Check if Classic Salesforce page
 */
export function isClassicSalesforce() {
  return !!(
    document.querySelector('#bodyCell') ||
    document.querySelector('.bPageBlock')
  );
}

// ============================================
// STORAGE HELPERS
// ============================================

/**
 * Generate unique ID if none exists
 */
export function ensureId(record) {
  if (!record.id) {
    record.id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return record;
}

/**
 * Add metadata to record
 */
export function addRecordMetadata(record, objectType) {
  return {
    ...record,
    _objectType: objectType,
    _extractedAt: new Date().toISOString(),
    _sourceUrl: window.location.href
  };
}
