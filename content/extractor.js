/**
 * Salesforce CRM Extractor - Refactored Content Script
 * ---------------------------------------------------
 * Handles page detection, view detection, data extraction,
 * and SPA observation in Salesforce Lightning.
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__SF_EXTRACTOR_LOADED__) {
    console.log('[SF Extractor] Already loaded, skipping...');
    return;
  }
  window.__SF_EXTRACTOR_LOADED__ = true;

  console.log('[SF Extractor] Refactored content script loaded');

  // =========================================
  // FIELD DEFINITIONS
  // =========================================

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

  const KANBAN_CAPABLE = ['OPPORTUNITY'];

  // =========================================
  // VIEW & PAGE DETECTION MODULE
  // =========================================

  function detectPageType() {
    const url = window.location.href;
    const page = { type: null, viewType: 'unknown' };

    Object.keys(PAGE_PATTERNS).forEach(objectType => {
      const patterns = PAGE_PATTERNS[objectType];
      if (patterns.urlPatterns.some(p => url.includes(p))) {
        page.type = objectType;
      }
    });

    if (page.type) {
      page.viewType = detectViewType(page.type);
    }

    return page;
  }

  function detectViewType(objectType) {
    if (isKanbanView(objectType)) return 'kanban';
    if (isListView()) return 'list';
    if (isRecordView()) return 'record';
    return 'unknown';
  }

  function isKanbanView(objectType) {
    if (!KANBAN_CAPABLE.includes(objectType)) return false;
    const url = window.location.href.toLowerCase();
    return url.includes('view=kanban') || url.includes('/kanban');
  }

  function isListView() {
    const url = window.location.href.toLowerCase();
    return url.includes('/list') || url.includes('filtername=') || !!document.querySelector('table[role="grid"]');
  }

  function isRecordView() {
    const url = window.location.href;
    return /\b([A-Za-z0-9]{15,18})\b/.test(url);
  }

  // =========================================
  // DOM HELPERS
  // =========================================

  function deepQuerySelector(selector, root = document) {
    let result = root.querySelector(selector);
    if (result) return result;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        result = deepQuerySelector(selector, el.shadowRoot);
        if (result) return result;
      }
    }
    return null;
  }

  function deepQuerySelectorAll(selector, root = document) {
    let results = Array.from(root.querySelectorAll(selector));
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        results = results.concat(deepQuerySelectorAll(selector, el.shadowRoot));
      }
    }
    return results;
  }

  function extractRecordId() {
    const urlMatch = window.location.href.match(/[A-Za-z0-9]{15,18}/);
    if (urlMatch) return urlMatch[0];
    const fromDom = document.querySelector('[data-record-id]');
    return fromDom ? fromDom.getAttribute('data-record-id') : null;
  }

  function normalizeValue(value) {
    if (!value) return null;
    let text = value.trim().replace(/\s+/g, ' ');
    const num = text.replace(/[$,]/g, '');
    if (!isNaN(num) && num !== '') return parseFloat(num);
    if (text.endsWith('%')) return parseFloat(text.replace('%', ''));
    return text;
  }

  // =========================================
  // EXTRACTION MODULES
  // =========================================

  function extractRecordData(objectType) {
    const map = FIELD_MAPS[objectType];
    const id = extractRecordId();
    if (!id) return null;
    const record = { id, _objectType: objectType, _sourceView: 'record' };

    Object.entries(map).forEach(([field, labels]) => {
      const val = getFieldValue(labels);
      if (val !== null) record[field] = val;
    });

    record._extractedAt = new Date().toISOString();
    record._sourceUrl = window.location.href;
    return record;
  }

  function extractListData(objectType) {
    const table = findListTable();
    if (!table) return [];

    const headers = extractHeaders(table);
    const rows = table.querySelectorAll('tbody tr');
    const map = FIELD_MAPS[objectType];
    const records = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const rec = { _objectType: objectType, _sourceView: 'list' };
      let rid = row.getAttribute('data-row-key-value');
      if (!rid) {
        const lk = row.querySelector('a[href*="/lightning/r/"]');
        if (lk) rid = (lk.href.match(/\/([A-Za-z0-9]{15,18})/) || [])[1];
      }
      if (!rid) return;
      rec.id = rid;

      cells.forEach((cell, i) => {
        const head = headers[i];
        if (!head) return;
        const val = extractCellValue(cell);
        Object.entries(map).forEach(([fkey, labs]) => {
          if (labs.some(l => head.toLowerCase().includes(l.toLowerCase()))) rec[fkey] = val;
        });
      });

      rec._extractedAt = new Date().toISOString();
      rec._sourceUrl = window.location.href;
      records.push(rec);
    });

    return records;
  }

  function extractKanbanData(objectType) {
    const map = FIELD_MAPS[objectType];
    const cards = deepQuerySelectorAll('[class*="kanbanCard"], [class*="forceKanbanCard"]');
    if (!cards || cards.length === 0) return [];

    const records = [];
    cards.forEach(card => {
      const r = { _objectType: objectType, _sourceView: 'kanban' };
      const lk = card.querySelector('a[href*="/lightning/r/"]');
      if (lk) {
        const mid = (lk.href.match(/\/([A-Za-z0-9]{15,18})/) || [])[1];
        if (mid) r.id = mid;
      }
      Object.entries(map).forEach(([fkey, labs]) => {
        const text = card.textContent || '';
        if (labs.some(l => text.toLowerCase().includes(l.toLowerCase()))) {
          r[fkey] = normalizeValue(text);
        }
      });
      r._extractedAt = new Date().toISOString();
      r._sourceUrl = window.location.href;
      records.push(r);
    });
    return records;
  }

  function findListTable() {
    const selectors = [
      'table[role="grid"]',
      'table.slds-table',
      '[class*="uiVirtualDataTable"] table',
      'lightning-datatable table'
    ];
    for (const sel of selectors) {
      const t = document.querySelector(sel);
      if (t) return t;
    }
    const shadow = deepQuerySelector('table[role="grid"]');
    if (shadow) return shadow;
    return null;
  }

  function extractHeaders(table) {
    const hdrs = [];
    table.querySelectorAll('th').forEach(th => {
      let text = th.textContent || '';
      hdrs.push(text.replace(/[\u2191\u2193]/g, '').trim());
    });
    return hdrs;
  }

  function extractCellValue(cell) {
    const formatted = cell.querySelector('lightning-formatted-text, lightning-formatted-number');
    if (formatted) return normalizeValue(formatted.textContent);
    const txt = cell.textContent || '';
    return normalizeValue(txt);
  }

  function getFieldValue(labelTexts) {
    const labels = Array.isArray(labelTexts) ? labelTexts : [labelTexts];
    for (let l of labels) {
      const el = document.querySelector(`[class*="${l.replace(' ', '')}"]`);
      if (el) return normalizeValue(el.textContent);
    }
    return null;
  }

  // =========================================
  // EXTRACTION ROUTER
  // =========================================

  async function performExtraction() {
    const page = detectPageType();
    if (!page.type) {
      console.warn('[SF Extractor] No object detected, skipping...');
      return;
    }

    await new Promise(r => setTimeout(r, 500)); // allow DOM to settle

    const { type, viewType } = page;
    console.info(`[SF Extractor] Extracting ${type} (${viewType})`);

    let records = [];
    if (viewType === 'kanban') {
      records = extractKanbanData(type);
    } else if (viewType === 'list') {
      records = extractListData(type);
    } else if (viewType === 'record') {
      const rec = extractRecordData(type);
      if (rec) records.push(rec);
    }

    if (records.length > 0) {
      chrome.runtime.sendMessage({
        type: 'EXTRACTED_DATA',
        objectType: type,
        records,
        viewType
      });
      console.info(`[SF Extractor] Sent ${records.length} records`);
    }
  }

  // =========================================
  // SPA NAVIGATION OBSERVER
  // =========================================

  function setupObserver() {
    const target = document.body;
    let timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => performExtraction(), 1200);
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  // =========================================
  // INIT
  // =========================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      performExtraction();
      setupObserver();
    });
  } else {
    performExtraction();
    setupObserver();
  }

})();
