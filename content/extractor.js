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

  // Object types that support Kanban view in Salesforce
  const KANBAN_CAPABLE_OBJECTS = ['OPPORTUNITY'];

  /**
   * Check if current page is explicitly a Kanban view
   * Kanban is only available for Opportunities and requires explicit view mode
   */
  function isKanbanView(objectType) {
    // Only Opportunities support Kanban in Salesforce
    if (!KANBAN_CAPABLE_OBJECTS.includes(objectType)) {
      return false;
    }

    const url = window.location.href;
    const pathname = window.location.pathname;
    const search = window.location.search;

    // URL-based detection (most reliable)
    if (pathname.includes('/Opportunity/kanban') || 
        search.includes('view=kanban') ||
        search.includes('chartType=kanban')) {
      return true;
    }

    // DOM-based detection - only for Opportunity pages
    // Check for actual Kanban board elements (not just partial class matches)
    const kanbanBoard = document.querySelector(
      '.forceListViewManagerKanbanBoard, ' +
      '.opportunityBoard, ' +
      '[class*="forceKanban"][class*="Board"], ' +
      '.pathBoard'
    );

    // Verify it's actually a Kanban board with columns/lanes
    if (kanbanBoard) {
      const hasKanbanStructure = kanbanBoard.querySelector(
        '[class*="column"], [class*="lane"], [class*="stage"]'
      );
      return !!hasKanbanStructure;
    }

    return false;
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
    
    // Check Kanban FIRST but only for capable objects
    if (isKanbanView(objectType)) {
      return 'kanban';
    }
    
    // List view patterns
    if (url.includes('/list') || url.includes('filterName=') || url.includes('/home')) {
      return 'list';
    }
    
    // Check for list table presence - expanded selectors for newer Lightning
    const listSelectors = [
      'table[data-aura-class="uiVirtualDataTable"]',
      '[class*="listViewContent"]',
      '[class*="forceListViewManager"]',
      'lightning-datatable',
      '[class*="lst-list"]',
      'table[role="grid"]',
      '.slds-table[role="grid"]'
    ];
    
    for (const selector of listSelectors) {
      if (document.querySelector(selector)) {
        return 'list';
      }
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
  function waitForLightningDom(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      function check() {
        // Check for Lightning container or list view elements
        const hasLightning = document.querySelector('[class*="oneAlohaPage"]') ||
                            document.querySelector('[class*="forceRecordLayout"]') ||
                            document.querySelector('[class*="forceListViewManager"]') ||
                            document.querySelector('[class*="lst-list"]') ||
                            document.querySelector('lightning-datatable') ||
                            document.querySelector('table[role="grid"]') ||
                            document.querySelector('table.slds-table') ||
                            document.querySelector('[class*="slds-page-header"]') ||
                            document.querySelector('[class*="slds-"]');
        
        // For list views, also wait for table rows to load
        const url = window.location.href;
        const isListView = url.includes('/list') || url.includes('filterName=') || url.includes('/home');
        
        if (hasLightning) {
          if (isListView) {
            // Try to find table data using deep query (including shadow DOM)
            const hasTableData = document.querySelector('table[role="grid"] tbody tr') ||
                                document.querySelector('.slds-table tbody tr') ||
                                document.querySelector('table tbody tr') ||
                                document.querySelector('[class*="forceListViewManager"] tr[data-row-key-value]') ||
                                document.querySelector('[data-row-key-value]') ||
                                deepQuerySelector('table tbody tr');
            if (hasTableData) {
              // Wait a bit more for full render
              setTimeout(() => resolve(true), 500);
            } else if (Date.now() - startTime > timeout) {
              // Resolve anyway after timeout - table might be empty or use different structure
              console.log('[SF Extractor] List view loaded, proceeding with extraction');
              resolve(true);
            } else {
              setTimeout(check, 300);
            }
          } else {
            resolve(true);
          }
        } else if (Date.now() - startTime > timeout) {
          // Resolve anyway - page might use different structure
          console.log('[SF Extractor] Timeout waiting for Lightning DOM, proceeding anyway');
          resolve(true);
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
    record._sourceView = 'record';
    
    console.log('[SF Extractor] Extracted record:', record);
    return record;
  }

  /**
   * Deep query selector that traverses shadow DOM
   */
  function deepQuerySelector(selector, root = document) {
    // First try regular querySelector
    let result = root.querySelector(selector);
    if (result) return result;
    
    // Get all elements that might have shadow roots
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        result = deepQuerySelector(selector, el.shadowRoot);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  /**
   * Deep query selector all that traverses shadow DOM
   */
  function deepQuerySelectorAll(selector, root = document) {
    let results = Array.from(root.querySelectorAll(selector));
    
    // Get all elements that might have shadow roots
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        const shadowResults = deepQuerySelectorAll(selector, el.shadowRoot);
        results = results.concat(shadowResults);
      }
    }
    
    return results;
  }

  /**
   * Extract list view data
   */
  function extractListData(objectType) {
    try {
      const fieldMap = FIELD_MAPS[objectType];
      if (!fieldMap) {
        console.warn(`[SF Extractor] No field map for: ${objectType}`);
        return [];
      }
      
      const records = [];
      
      // Find list table - try multiple selectors for different SF Lightning versions
      const tableSelectors = [
        'table[role="grid"]',
        'table.slds-table',
        '.slds-table[role="grid"]',
        '[class*="uiVirtualDataTable"] table',
        '[class*="listViewContent"] table',
        'lightning-datatable table',
        '[data-aura-class="uiVirtualDataTable"]',
        '[class*="forceListViewManager"] table',
        '[class*="forceListViewManagerGrid"] table',
        '[class*="virtualDataTable"] table',
        '[class*="listViewContainer"] table',
        '[class*="lst-"] table'
      ];
      
      let table = null;
      
      // First try regular DOM
      for (const selector of tableSelectors) {
        try {
          table = document.querySelector(selector);
          if (table) {
            console.log(`[SF Extractor] Found table with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      
      // If not found, try deep shadow DOM traversal
      if (!table) {
        for (const selector of tableSelectors) {
          try {
            table = deepQuerySelector(selector);
            if (table) {
              console.log(`[SF Extractor] Found table in shadow DOM with selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
      
      // Try to find inside iframes as well
      if (!table) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              for (const selector of tableSelectors) {
                table = iframeDoc.querySelector(selector);
                if (table) {
                  console.log(`[SF Extractor] Found table in iframe with selector: ${selector}`);
                  break;
                }
              }
              if (table) break;
            }
          } catch (e) {
            // Cross-origin iframe, skip
          }
        }
      }
      
      if (!table) {
        // Log more detailed debugging info
        const allTables = deepQuerySelectorAll('table');
        const allGrids = deepQuerySelectorAll('[role="grid"]');
        console.warn('[SF Extractor] No list table found. Available tables:', 
          allTables.length,
          'Available grids:', 
          allGrids.length);
        
        // If we found tables but couldn't match selectors, try the first one
        if (allTables.length > 0) {
          table = allTables[0];
          console.log('[SF Extractor] Using first available table as fallback');
        } else if (allGrids.length > 0) {
          // Grid might be the table itself or contain a table
          const grid = allGrids[0];
          table = grid.tagName === 'TABLE' ? grid : grid.querySelector('table');
          if (!table) table = grid; // Use grid as table-like structure
          console.log('[SF Extractor] Using grid element as fallback');
        }
      }
      
      if (!table) {
        console.warn('[SF Extractor] No table or grid elements found in DOM');
        return [];
      }
      
      // Get headers for column mapping - extract clean header text
      const headers = [];
      const headerCells = table.querySelectorAll('th');
      headerCells.forEach(th => {
        // Get header text, preferring specific elements over full textContent
        const headerLink = th.querySelector('a[title], span[title]');
        const headerSpan = th.querySelector('.slds-truncate, [class*="headerText"], span:not([class*="icon"])');
        let headerText = '';
        
        if (headerLink && headerLink.title) {
          headerText = headerLink.title;
        } else if (headerLink) {
          headerText = headerLink.textContent?.trim() || '';
        } else if (headerSpan) {
          headerText = headerSpan.textContent?.trim() || '';
        } else {
          headerText = th.textContent?.trim() || '';
        }
        
        // Clean up header text - remove sort indicators, etc.
        headerText = headerText.replace(/[\u2191\u2193↑↓]/g, '').trim();
        headers.push(headerText);
      });
      
      console.log('[SF Extractor] Headers found:', headers);
    
    // Extract rows
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      // Skip hidden rows or header rows
      if (row.hidden || row.getAttribute('aria-hidden') === 'true') {
        return;
      }
      
      const cells = row.querySelectorAll('td');
      const record = { _objectType: objectType };
      
      // Try to get record ID from row - check multiple sources
      let recordId = row.getAttribute('data-row-key-value') || 
                     row.getAttribute('data-record-id') ||
                     row.getAttribute('data-row-id');
      
      if (!recordId) {
        // Look for ID in links
        const links = row.querySelectorAll('a[href*="/lightning/r/"], a[href*="/"]');
        for (const link of links) {
          const idMatch = link.href.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$|\?)/);
          if (idMatch && idMatch[1].match(/^[a-zA-Z0-9]{15,18}$/)) {
            // Validate it looks like a Salesforce ID (starts with specific prefixes)
            const potentialId = idMatch[1];
            if (potentialId.length === 15 || potentialId.length === 18) {
              recordId = potentialId;
              break;
            }
          }
        }
      }
      
      if (!recordId) {
        console.log('[SF Extractor] Skipping row without ID');
        return;
      }
      
      record.id = recordId;
      
      // Map cells to fields
      cells.forEach((cell, index) => {
        if (index < headers.length) {
          const header = headers[index];
          if (!header) return; // Skip empty headers
          
          // Extract cell value properly
          const cellValue = extractCellValue(cell);
          
          // Find matching field key
          for (const [fieldKey, labelOptions] of Object.entries(fieldMap)) {
            // Ensure labelOptions is an array
            const labels = Array.isArray(labelOptions) ? labelOptions : [labelOptions];
            if (labels.some(label => header.toLowerCase().includes(label.toLowerCase()))) {
              record[fieldKey] = cellValue;
              break;
            }
          }
        }
      });
      
      record._extractedAt = new Date().toISOString();
      record._sourceUrl = window.location.href;
      record._sourceView = 'list';
      records.push(record);
    });
    
    console.log(`[SF Extractor] Extracted ${records.length} list records`);
    return records;
    } catch (error) {
      console.error('[SF Extractor] List extraction error:', error);
      return [];
    }
  }
  
  /**
   * Extract clean value from a table cell
   */
  function extractCellValue(cell) {
    // Skip cells that are just checkboxes or action buttons
    if (cell.querySelector('input[type="checkbox"]') && !cell.querySelector('a, span[class*="output"]')) {
      return null;
    }
    
    // Priority 1: Lightning formatted elements
    const formattedEl = cell.querySelector(
      'lightning-formatted-text, ' +
      'lightning-formatted-number, ' +
      'lightning-formatted-email, ' +
      'lightning-formatted-phone, ' +
      'lightning-formatted-url, ' +
      'lightning-formatted-date-time'
    );
    if (formattedEl) {
      return normalizeValue(formattedEl.textContent);
    }
    
    // Priority 2: SLDS output elements
    const outputEl = cell.querySelector(
      '[class*="uiOutputText"], ' +
      '[class*="uiOutputEmail"], ' +
      '[class*="uiOutputPhone"], ' +
      '[class*="uiOutputUrl"], ' +
      '[class*="forceOutputField"], ' +
      '.slds-truncate'
    );
    if (outputEl) {
      return normalizeValue(outputEl.textContent);
    }
    
    // Priority 3: Links (get text content, not href)
    const link = cell.querySelector('a[href*="/lightning/r/"], a[data-refid], a.slds-truncate');
    if (link) {
      // Get the visible text, not including any hidden elements
      const linkText = link.textContent?.trim();
      if (linkText && !linkText.toLowerCase().includes('edit') && !linkText.toLowerCase().includes('delete')) {
        return normalizeValue(linkText);
      }
    }
    
    // Priority 4: Span with actual content (not icons)
    const spans = cell.querySelectorAll('span:not([class*="icon"]):not([class*="slds-assistive"])');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && text.length > 0 && !text.match(/^[\s\u200b]*$/)) {
        return normalizeValue(text);
      }
    }
    
    // Priority 5: Direct text content (filtered)
    let textContent = '';
    for (const node of cell.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        textContent += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip buttons, icons, and action elements
        const tagName = node.tagName?.toLowerCase();
        const className = node.className || '';
        if (tagName === 'button' || 
            tagName === 'lightning-button-icon' ||
            className.includes('icon') ||
            className.includes('action') ||
            className.includes('button')) {
          continue;
        }
        // Get text from safe elements
        if (tagName === 'a' || tagName === 'span' || tagName === 'div') {
          const innerText = node.textContent?.trim();
          if (innerText && !innerText.toLowerCase().includes('edit') && !innerText.toLowerCase().includes('delete')) {
            textContent += ' ' + innerText;
          }
        }
      }
    }
    
    textContent = textContent.trim();
    if (textContent) {
      return normalizeValue(textContent);
    }
    
    return null;
  }

  /**
   * Extract data from Kanban/Board view (used for Opportunities)
   */
  function extractKanbanData(objectType) {
    try {
      const fieldMap = FIELD_MAPS[objectType];
      if (!fieldMap) {
        console.warn(`[SF Extractor] No field map for: ${objectType}`);
        return [];
      }
      
      const records = [];
      
      // Find Kanban cards - try multiple selectors
      const cardSelectors = [
        '[class*="kanbanCard"]',
        '[class*="forceKanbanCard"]',
        '.opportunityCard',
        '[class*="pathBoardCard"]',
        '[class*="kanban"] [class*="card"]',
        '.forceListViewManagerKanbanBoard [class*="item"]'
      ];
      
      let cards = [];
      for (const selector of cardSelectors) {
        cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
          console.log(`[SF Extractor] Found ${cards.length} Kanban cards with selector: ${selector}`);
          break;
        }
      }
      
      if (cards.length === 0) {
        console.info('[SF Extractor] Kanban view detected but no cards found (board may be empty)');
        return [];
      }
      
      cards.forEach(card => {
        const record = { _objectType: objectType };
        
        // Get record ID from card link or data attribute
        const cardLink = card.querySelector('a[href*="/lightning/r/"], a[href*="/"]');
        let recordId = card.getAttribute('data-record-id') || 
                       card.getAttribute('data-item-id');
        
        if (!recordId && cardLink) {
          const idMatch = cardLink.href.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$|\?)/);
          if (idMatch) {
            recordId = idMatch[1];
          }
        }
        
        if (!recordId) {
          return; // Skip cards without ID
        }
        
        record.id = recordId;
        
        // Extract name - usually the main link text
        if (cardLink) {
          const nameText = cardLink.textContent?.trim();
          if (nameText && !nameText.toLowerCase().includes('edit')) {
            record.name = normalizeValue(nameText);
          }
        }
        
        // Extract other fields from card content
        const cardFields = card.querySelectorAll('[class*="field"], [class*="detail"], span, div');
        cardFields.forEach(field => {
          const text = field.textContent?.trim();
          if (!text) return;
          
          // Try to match against field map labels
          for (const [fieldKey, labelOptions] of Object.entries(fieldMap)) {
            if (record[fieldKey]) continue; // Already have this field
            
            const labels = Array.isArray(labelOptions) ? labelOptions : [labelOptions];
            
            // Check if this field contains a label pattern
            for (const label of labels) {
              if (text.toLowerCase().includes(label.toLowerCase())) {
                // Extract the value after the label
                const parts = text.split(/[:\-]/);
                if (parts.length > 1) {
                  record[fieldKey] = normalizeValue(parts.slice(1).join(':').trim());
                }
                break;
              }
            }
          }
        });
        
        // Try to get stage from parent column header (for Opportunity Kanban)
        const column = card.closest('[class*="column"], [class*="lane"], [class*="stage"]');
        if (column && !record.stage) {
          const columnHeader = column.querySelector('[class*="header"], [class*="title"], h2, h3');
          if (columnHeader) {
            const stageText = columnHeader.textContent?.trim();
            // Remove count from stage name (e.g., "Prospecting (1)" -> "Prospecting")
            const stageName = stageText.replace(/\s*\(\d+\)\s*$/, '').trim();
            if (stageName) {
              record.stage = stageName;
            }
          }
        }
        
        // Extract amount if visible
        const amountEl = card.querySelector('[class*="amount"], [class*="currency"]');
        if (amountEl && !record.amount) {
          record.amount = normalizeValue(amountEl.textContent);
        }
        
        // Extract account name from card
        const accountEl = card.querySelectorAll('a');
        accountEl.forEach(link => {
          const href = link.href || '';
          if (href.includes('/Account/') || href.includes('/001')) {
            if (!record.accountName) {
              record.accountName = normalizeValue(link.textContent);
            }
          }
        });
        
        record._extractedAt = new Date().toISOString();
        record._sourceUrl = window.location.href;
        record._sourceView = 'kanban';
        records.push(record);
      });
      
      console.log(`[SF Extractor] Extracted ${records.length} Kanban records`);
      return records;
    } catch (error) {
      console.error('[SF Extractor] Kanban extraction error:', error);
      return [];
    }
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
      } else if (pageInfo.viewType === 'kanban' && KANBAN_CAPABLE_OBJECTS.includes(pageInfo.type)) {
        // Only extract Kanban for objects that support it (Opportunities)
        records = extractKanbanData(pageInfo.type);
        // If Kanban extraction failed, try list extraction as fallback
        if (records.length === 0) {
          console.info('[SF Extractor] Kanban board empty, trying list extraction fallback');
          records = extractListData(pageInfo.type);
        }
      } else if (pageInfo.viewType === 'list' || pageInfo.viewType === 'kanban') {
        // List view or non-Kanban-capable object detected as kanban (fallback to list)
        records = extractListData(pageInfo.type);
      }
      
      if (records.length > 0) {
        // Send to service worker with proper error handling
        sendMessageSafe({
          type: 'EXTRACTED_DATA',
          objectType: pageInfo.type,
          records: records
        }).then(response => {
          if (response?.success) {
            showFeedbackBadge(`Saved ${records.length} ${pageInfo.type}(s)`);
          }
        }).catch(err => {
          console.warn('[SF Extractor] Could not send to background:', err.message);
        });
        
        return records;
      }
      
      return null;
    } catch (error) {
      console.error('[SF Extractor] Extraction error:', error);
      return null;
    }
  }
  
  /**
   * Safely send message to background script, handling extension context errors
   */
  function sendMessageSafe(message) {
    return new Promise((resolve, reject) => {
      try {
        // Check if extension context is still valid
        if (!chrome?.runtime?.id) {
          reject(new Error('Extension context invalidated'));
          return;
        }
        
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
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
        try {
          const pageInfo = detectPageType();
          if (pageInfo) {
            console.log('[SF Extractor] Page change detected, extracting...');
            performExtraction().catch(err => {
              console.error('[SF Extractor] Auto-extraction error:', err);
            });
          }
        } catch (err) {
          console.error('[SF Extractor] Observer callback error:', err);
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

  // Check if extension context is valid before adding listener
  if (chrome?.runtime?.id) {
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Double-check context is still valid
        if (!chrome?.runtime?.id) {
          return false;
        }
        
        console.log('[SF Extractor] Received message:', message.type);
        
        if (message.type === 'EXTRACT_NOW') {
          performExtraction(message.objectType)
            .then(records => {
              sendResponse({ success: true, count: records?.length || 0 });
            })
            .catch(err => {
              console.error('[SF Extractor] Extract error:', err);
              sendResponse({ success: false, error: err.message });
            });
          return true; // Async response
        }
        
        if (message.type === 'GET_PAGE_INFO') {
          const pageInfo = detectPageType();
          sendResponse({ pageInfo });
          return false;
        }
      });
    } catch (e) {
      console.warn('[SF Extractor] Could not add message listener:', e.message);
    }
  }

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
