/**
 * Salesforce CRM Extractor - Content Script
 * Handles page detection, data extraction, and DOM observation
 */

(function() {
  'use strict';
  
  // Prevent double injection
  if (window.__SF_EXTRACTOR_LOADED__) {
    console.log('[SF Extractor] Already loaded, skipping...');
    return;
  }
  window.__SF_EXTRACTOR_LOADED__ = true;
  
  console.log('[SF Extractor] Content script loaded');

  // ============================================
  // FIELD MAPS - Define what to extract per object
  // ============================================
  
  const FIELD_MAPS = {
    OPPORTUNITY: {
      name: ['Opportunity Name', 'Name'],
      amount: ['Amount'],
      stage: ['Stage'],
      probability: ['Probability (%)','Probability'],
      closeDate: ['Close Date'],
      accountName: ['Account Name'],
      ownerName: ['Opportunity Owner', 'Owner'],
      type: ['Type'],
      leadSource: ['Lead Source'],
      nextStep: ['Next Step'],
      description: ['Description']
    },
    LEAD: {
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
      website: ['Website'],
      address: ['Address']
    },
    CONTACT: {
      name: ['Name', 'Contact Name'],
      accountName: ['Account Name'],
      email: ['Email'],
      phone: ['Phone'],
      mobilePhone: ['Mobile'],
      title: ['Title'],
      department: ['Department'],
      ownerName: ['Contact Owner', 'Owner'],
      mailingAddress: ['Mailing Address']
    },
    ACCOUNT: {
      name: ['Account Name', 'Name'],
      industry: ['Industry'],
      type: ['Type'],
      phone: ['Phone'],
      website: ['Website'],
      ownerName: ['Account Owner', 'Owner'],
      billingAddress: ['Billing Address'],
      annualRevenue: ['Annual Revenue'],
      employees: ['Employees'],
      description: ['Description']
    },
    TASK: {
      subject: ['Subject'],
      dueDate: ['Due Date'],
      status: ['Status'],
      priority: ['Priority'],
      relatedTo: ['Related To', 'Name'],
      assignedTo: ['Assigned To'],
      comments: ['Comments', 'Description']
    }
  };

  // ============================================
  // PAGE DETECTION - Identify Salesforce object type
  // ============================================
  
  const PAGE_PATTERNS = {
    // URL-based detection
    OPPORTUNITY: {
      urlPatterns: ['/Opportunity/', '/006/', 'objectApiName=Opportunity'],
      headerTexts: ['Opportunity', 'Opportunities'],
      listViewIndicators: ['Opportunities |', 'Recently Viewed']
    },
    LEAD: {
      urlPatterns: ['/Lead/', '/00Q/', 'objectApiName=Lead'],
      headerTexts: ['Lead', 'Leads'],
      listViewIndicators: ['Leads |', 'All Open Leads']
    },
    CONTACT: {
      urlPatterns: ['/Contact/', '/003/', 'objectApiName=Contact'],
      headerTexts: ['Contact', 'Contacts'],
      listViewIndicators: ['Contacts |']
    },
    ACCOUNT: {
      urlPatterns: ['/Account/', '/001/', 'objectApiName=Account'],
      headerTexts: ['Account', 'Accounts'],
      listViewIndicators: ['Accounts |']
    },
    TASK: {
      urlPatterns: ['/Task/', '/00T/', 'objectApiName=Task'],
      headerTexts: ['Task', 'Tasks'],
      listViewIndicators: ['Tasks |']
    }
  };

  /**
   * Detect current page type
   */
  function detectPageType() {
    const url = window.location.href;
    const pageTitle = document.title;
    
    // Check Lightning metadata
    const appName = document.querySelector('[data-app-id]')?.getAttribute('data-app-id');
    const objectApiName = new URLSearchParams(window.location.search).get('objectApiName');
    
    for (const [objectType, patterns] of Object.entries(PAGE_PATTERNS)) {
      // URL pattern match
      if (patterns.urlPatterns.some(p => url.includes(p))) {
        return { type: objectType, viewType: detectViewType(objectType) };
      }
      
      // Header text match
      const header = document.querySelector('h1, [class*="slds-page-header__title"]');
      if (header && patterns.headerTexts.some(t => header.textContent.includes(t))) {
        return { type: objectType, viewType: detectViewType(objectType) };
      }
    }
    
    return null;
  }

  /**
   * Detect if viewing record or list
   */
  function detectViewType(objectType) {
    const url = window.location.href;
    
    // Record view patterns
    if (url.includes('/view') || url.match(/\/[a-zA-Z0-9]{15,18}$/)) {
      return 'record';
    }
    
    // List view patterns
    if (url.includes('/list') || url.includes('filterName=')) {
      return 'list';
    }
    
    // Check for list table presence
    if (document.querySelector('table[data-aura-class="uiVirtualDataTable"]') ||
        document.querySelector('[class*="listViewContent"]')) {
      return 'list';
    }
    
    // Check for record detail presence
    if (document.querySelector('[class*="recordLayout"]') ||
        document.querySelector('[class*="forceRecordLayout"]')) {
      return 'record';
    }
    
    return 'unknown';
  }

  // ============================================
  // DOM HELPERS - Reusable extraction utilities
  // ============================================

  /**
   * Wait for Lightning DOM to be ready
   */
  function waitForLightningDom(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      function check() {
        // Check for Lightning container
        const hasLightning = document.querySelector('[class*="oneAlohaPage"]') ||
                            document.querySelector('[class*="forceRecordLayout"]') ||
                            document.querySelector('[class*="slds-"]');
        
        if (hasLightning) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Lightning DOM timeout'));
        } else {
          requestAnimationFrame(check);
        }
      }
      
      check();
    });
  }

  /**
   * Get field value by label text
   */
  function getFieldValue(labelTexts, container = document) {
    const labels = Array.isArray(labelTexts) ? labelTexts : [labelTexts];
    
    for (const labelText of labels) {
      // Strategy 1: SLDS form element structure
      const sldsLabel = container.querySelector(`[class*="slds-form-element__label"]:not([class*="hidden"])`);
      const formElements = container.querySelectorAll('[class*="slds-form-element"]');
      
      for (const formEl of formElements) {
        const label = formEl.querySelector('[class*="slds-form-element__label"], label');
        if (label && label.textContent.trim().includes(labelText)) {
          const value = formEl.querySelector('[class*="slds-form-element__static"]') ||
                       formEl.querySelector('[class*="uiOutputText"]') ||
                       formEl.querySelector('[class*="forceOutputField"]') ||
                       formEl.querySelector('lightning-formatted-text') ||
                       formEl.querySelector('lightning-formatted-number') ||
                       formEl.querySelector('[class*="test-id__field-value"]');
          if (value) {
            return normalizeValue(value.textContent);
          }
        }
      }
      
      // Strategy 2: Lightning record form fields
      const recordFields = container.querySelectorAll('[class*="forcePageBlockItem"], [class*="recordLayout"]');
      for (const field of recordFields) {
        const label = field.querySelector('span[class*="label"], [class*="fieldLabel"]');
        if (label && label.textContent.trim().includes(labelText)) {
          const valueEl = field.querySelector('[class*="fieldValue"], [class*="outputField"]');
          if (valueEl) {
            return normalizeValue(valueEl.textContent);
          }
        }
      }
      
      // Strategy 3: Highlights panel
      const highlights = container.querySelectorAll('[class*="highlightsPanel"] [class*="field"]');
      for (const field of highlights) {
        if (field.textContent.includes(labelText)) {
          const valueEl = field.querySelector('[class*="value"], lightning-formatted-text');
          if (valueEl) {
            return normalizeValue(valueEl.textContent);
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Normalize extracted values
   */
  function normalizeValue(value) {
    if (!value) return null;
    
    let normalized = value.trim()
      .replace(/\s+/g, ' ')  // Multiple spaces to single
      .replace(/[\r\n]+/g, ' '); // Newlines to space
    
    // Handle currency
    if (normalized.match(/^\$[\d,]+(\.\d{2})?$/)) {
      normalized = parseFloat(normalized.replace(/[$,]/g, ''));
    }
    
    // Handle percentage
    if (normalized.match(/^\d+(\.\d+)?%$/)) {
      normalized = parseFloat(normalized.replace('%', ''));
    }
    
    return normalized || null;
  }

  /**
   * Extract record ID from URL or page
   */
  function extractRecordId() {
    const url = window.location.href;
    
    // Pattern: /view?recordId=xxxxx or /r/Object/xxxxx/view
    const urlMatch = url.match(/[a-zA-Z0-9]{15,18}/);
    if (urlMatch) {
      return urlMatch[0];
    }
    
    // From data attribute
    const recordEl = document.querySelector('[data-record-id]');
    if (recordEl) {
      return recordEl.getAttribute('data-record-id');
    }
    
    return null;
  }

  // ============================================
  // EXTRACTION LOGIC
  // ============================================

  /**
   * Extract single record data
   */
  function extractRecordData(objectType) {
    const fieldMap = FIELD_MAPS[objectType];
    if (!fieldMap) {
      console.warn(`[SF Extractor] No field map for: ${objectType}`);
      return null;
    }
    
    const recordId = extractRecordId();
    if (!recordId) {
      console.warn('[SF Extractor] Could not extract record ID');
      return null;
    }
    
    const record = { id: recordId, _objectType: objectType };
    
    // Extract each field
    for (const [fieldKey, labelOptions] of Object.entries(fieldMap)) {
      const value = getFieldValue(labelOptions);
      if (value !== null) {
        record[fieldKey] = value;
      }
    }
    
    // Add metadata
    record._extractedAt = new Date().toISOString();
    record._sourceUrl = window.location.href;
    
    console.log('[SF Extractor] Extracted record:', record);
    return record;
  }

  /**
   * Extract list view data
   */
  function extractListData(objectType) {
    const fieldMap = FIELD_MAPS[objectType];
    if (!fieldMap) {
      return [];
    }
    
    const records = [];
    
    // Find list table
    const table = document.querySelector('table[role="grid"]') ||
                  document.querySelector('[class*="uiVirtualDataTable"] table') ||
                  document.querySelector('[class*="listViewContent"] table');
    
    if (!table) {
      console.warn('[SF Extractor] No list table found');
      return [];
    }
    
    // Get headers for column mapping
    const headers = [];
    const headerCells = table.querySelectorAll('th');
    headerCells.forEach(th => {
      headers.push(th.textContent.trim());
    });
    
    // Extract rows
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const record = { _objectType: objectType };
      
      // Try to get record ID from row link
      const link = row.querySelector('a[href*="/"]');
      if (link) {
        const idMatch = link.href.match(/\/([a-zA-Z0-9]{15,18})/);
        if (idMatch) {
          record.id = idMatch[1];
        }
      }
      
      // Map cells to fields
      cells.forEach((cell, index) => {
        if (index < headers.length) {
          const header = headers[index];
          
          // Find matching field key
          for (const [fieldKey, labelOptions] of Object.entries(fieldMap)) {
            if (labelOptions.some(label => header.includes(label))) {
              record[fieldKey] = normalizeValue(cell.textContent);
              break;
            }
          }
        }
      });
      
      // Only add records with an ID
      if (record.id) {
        record._extractedAt = new Date().toISOString();
        record._sourceUrl = window.location.href;
        records.push(record);
      }
    });
    
    console.log(`[SF Extractor] Extracted ${records.length} list records`);
    return records;
  }

  /**
   * Main extraction function
   */
  async function performExtraction(targetObjectType = null) {
    try {
      await waitForLightningDom();
      
      const pageInfo = detectPageType();
      if (!pageInfo) {
        console.log('[SF Extractor] Not on a Salesforce object page');
        return null;
      }
      
      // If target specified, only extract if matching
      if (targetObjectType && pageInfo.type !== targetObjectType) {
        console.log(`[SF Extractor] Page type ${pageInfo.type} doesn't match target ${targetObjectType}`);
        return null;
      }
      
      console.log(`[SF Extractor] Detected: ${pageInfo.type} (${pageInfo.viewType})`);
      
      let records = [];
      
      if (pageInfo.viewType === 'record') {
        const record = extractRecordData(pageInfo.type);
        if (record) {
          records = [record];
        }
      } else if (pageInfo.viewType === 'list') {
        records = extractListData(pageInfo.type);
      }
      
      if (records.length > 0) {
        // Send to service worker
        chrome.runtime.sendMessage({
          type: 'EXTRACTED_DATA',
          objectType: pageInfo.type,
          records: records
        }, response => {
          if (response?.success) {
            showFeedbackBadge(`Saved ${records.length} ${pageInfo.type}(s)`);
          }
        });
        
        return records;
      }
      
      return null;
    } catch (error) {
      console.error('[SF Extractor] Extraction error:', error);
      return null;
    }
  }

  // ============================================
  // SHADOW DOM FEEDBACK BADGE
  // ============================================

  /**
   * Show floating feedback badge using Shadow DOM
   */
  function showFeedbackBadge(message, duration = 3000) {
    // Create container if not exists
    let container = document.getElementById('sf-extractor-badge-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sf-extractor-badge-container';
      document.body.appendChild(container);
      
      // Attach shadow DOM
      const shadow = container.attachShadow({ mode: 'closed' });
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        :host {
          all: initial;
        }
        .badge {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #0176d3;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 999999;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .badge.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .badge.success {
          background: #2e844a;
        }
        .badge.error {
          background: #c23934;
        }
      `;
      shadow.appendChild(style);
      
      const badge = document.createElement('div');
      badge.className = 'badge';
      shadow.appendChild(badge);
      
      container._shadow = shadow;
    }
    
    const badge = container._shadow.querySelector('.badge');
    badge.textContent = message;
    badge.className = 'badge visible success';
    
    // Auto-remove
    setTimeout(() => {
      badge.classList.remove('visible');
    }, duration);
  }

  // ============================================
  // MUTATION OBSERVER - SPA Navigation
  // ============================================

  let extractionTimeout = null;
  const DEBOUNCE_MS = 1500;

  /**
   * Observe DOM changes for SPA navigation
   */
  function setupMutationObserver() {
    const targetNode = document.querySelector('#main') || 
                       document.querySelector('[class*="oneAlohaPage"]') ||
                       document.body;
    
    const observer = new MutationObserver((mutations) => {
      // Debounce extraction
      if (extractionTimeout) {
        clearTimeout(extractionTimeout);
      }
      
      extractionTimeout = setTimeout(() => {
        const pageInfo = detectPageType();
        if (pageInfo) {
          console.log('[SF Extractor] Page change detected, extracting...');
          performExtraction();
        }
      }, DEBOUNCE_MS);
    });
    
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
    
    console.log('[SF Extractor] MutationObserver active');
  }

  // ============================================
  // MESSAGE HANDLER - From popup/service worker
  // ============================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[SF Extractor] Received message:', message.type);
    
    if (message.type === 'EXTRACT_NOW') {
      performExtraction(message.objectType).then(records => {
        sendResponse({ success: true, count: records?.length || 0 });
      });
      return true; // Async response
    }
    
    if (message.type === 'GET_PAGE_INFO') {
      const pageInfo = detectPageType();
      sendResponse({ pageInfo });
      return false;
    }
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  async function init() {
    try {
      await waitForLightningDom();
      console.log('[SF Extractor] Lightning DOM ready');
      
      // Initial extraction
      setTimeout(() => {
        performExtraction();
      }, 1000);
      
      // Setup observer for SPA navigation
      setupMutationObserver();
      
    } catch (error) {
      console.warn('[SF Extractor] Init error:', error);
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
