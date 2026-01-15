/**
 * Salesforce CRM Extractor - Constants
 */

// Storage keys for different object types
export const STORAGE_KEYS = {
  OPPORTUNITIES: 'sf_opportunities',
  LEADS: 'sf_leads',
  CONTACTS: 'sf_contacts',
  ACCOUNTS: 'sf_accounts',
  TASKS: 'sf_tasks',
  METADATA: 'sf_metadata'
};

// Message types for communication
export const MESSAGE_TYPES = {
  // Content script → Service worker
  EXTRACTED_DATA: 'EXTRACTED_DATA',
  
  // Popup → Service worker
  GET_ALL_DATA: 'GET_ALL_DATA',
  GET_OBJECT_DATA: 'GET_OBJECT_DATA',
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA',
  CLEAR_OBJECT_DATA: 'CLEAR_OBJECT_DATA',
  DELETE_RECORD: 'DELETE_RECORD',
  TRIGGER_EXTRACTION: 'TRIGGER_EXTRACTION',
  CHECK_SALESFORCE_PAGE: 'CHECK_SALESFORCE_PAGE',
  
  // Service worker → Content script
  EXTRACT_NOW: 'EXTRACT_NOW',
  GET_PAGE_INFO: 'GET_PAGE_INFO'
};

// Salesforce object key prefixes (for ID detection)
export const SF_KEY_PREFIXES = {
  '001': 'Account',
  '003': 'Contact',
  '006': 'Opportunity',
  '00Q': 'Lead',
  '00T': 'Task',
  '00U': 'Event',
  '500': 'Case'
};

// URL patterns for object detection
export const URL_PATTERNS = {
  OPPORTUNITY: ['/Opportunity/', '/006/', 'objectApiName=Opportunity'],
  LEAD: ['/Lead/', '/00Q/', 'objectApiName=Lead'],
  CONTACT: ['/Contact/', '/003/', 'objectApiName=Contact'],
  ACCOUNT: ['/Account/', '/001/', 'objectApiName=Account'],
  TASK: ['/Task/', '/00T/', 'objectApiName=Task']
};

// Salesforce Lightning DOM selectors
export const SF_SELECTORS = {
  // Lightning containers
  LIGHTNING_CONTAINER: '[class*="oneAlohaPage"], [class*="forceRecordLayout"]',
  RECORD_LAYOUT: '[class*="forceRecordLayout"], [class*="recordLayout"]',
  LIST_VIEW: '[class*="listViewContent"], [class*="uiVirtualDataTable"]',
  
  // Form elements
  FORM_ELEMENT: '[class*="slds-form-element"]',
  FORM_LABEL: '[class*="slds-form-element__label"]',
  FORM_VALUE: '[class*="slds-form-element__static"], [class*="uiOutputText"]',
  
  // Page header
  PAGE_HEADER: 'h1, [class*="slds-page-header__title"]',
  
  // Highlights panel
  HIGHLIGHTS_PANEL: '[class*="highlightsPanel"]',
  
  // Tables
  DATA_TABLE: 'table[role="grid"], [class*="uiVirtualDataTable"] table'
};

// Extraction timing configuration
export const TIMING = {
  DEBOUNCE_MS: 1500,
  DOM_WAIT_TIMEOUT: 5000,
  OBSERVER_TIMEOUT: 10000,
  BADGE_DISPLAY_MS: 3000,
  INITIAL_EXTRACTION_DELAY: 1000
};

// Kanban stages for opportunities
export const OPPORTUNITY_STAGES = [
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost'
];

// Stage colors for UI
export const STAGE_COLORS = {
  'Prospecting': '#f0f0f0',
  'Qualification': '#e3f5ff',
  'Needs Analysis': '#e3f5ff',
  'Value Proposition': '#fff4e5',
  'Proposal/Price Quote': '#fff4e5',
  'Negotiation/Review': '#ffeef0',
  'Closed Won': '#e5f9e7',
  'Closed Lost': '#f3f3f3'
};
