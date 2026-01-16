# Salesforce CRM Extractor - Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Components](#components)
5. [Data Flow](#data-flow)
6. [API Reference](#api-reference)
7. [Storage Schema](#storage-schema)
8. [Extraction Logic](#extraction-logic)
9. [Message Protocol](#message-protocol)
10. [Troubleshooting](#troubleshooting)

---

## Overview

**Salesforce CRM Extractor** is a Chrome Extension (Manifest V3) that automatically extracts and stores data from Salesforce Lightning pages. It supports extracting data from:

- **Opportunities** (including Kanban view)
- **Leads**
- **Contacts**
- **Accounts**
- **Tasks**

### Key Features
- Automatic data extraction from list views and record pages
- Kanban board extraction for Opportunities
- Shadow DOM traversal for modern Lightning components
- Deduplication and merge logic (never overwrites, always merges)
- Real-time sync status indicator
- Search and filter capabilities
- Multiple view modes (Table, Kanban, Raw JSON)
- CSV export support

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    Messages    ┌──────────────────────────┐   │
│  │    Popup     │ ◄────────────► │    Service Worker        │   │
│  │  (React UI)  │                │  (Background Script)     │   │
│  └──────────────┘                └──────────────────────────┘   │
│         │                                    │                   │
│         │                                    │                   │
│         │        ┌─────────────────┐         │                   │
│         │        │  Chrome Storage │         │                   │
│         └───────►│     (Local)     │◄────────┘                   │
│                  └─────────────────┘                             │
│                           ▲                                      │
│                           │                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Content Script (extractor.js)                │   │
│  │  - Injected into Salesforce pages                         │   │
│  │  - Extracts data from DOM                                 │   │
│  │  - Observes page changes                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
└───────────────────────────│──────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │     Salesforce Lightning    │
              │    (Web Page DOM)           │
              └─────────────────────────────┘
```

---

## File Structure

```
extension/
├── manifest.json              # Extension configuration
├── service-worker.js          # Background service worker
├── README.md                  # Basic readme
├── DOCUMENTATION.md           # This file
│
├── content/
│   └── extractor.js           # Content script (1100+ lines)
│                              # - Page detection
│                              # - Data extraction
│                              # - DOM observation
│
├── shared/
│   ├── constants.js           # Shared constants
│   └── utils.js               # Shared utilities
│
├── popup/                     # React popup application
│   ├── package.json           # NPM dependencies
│   ├── vite.config.js         # Vite build configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── postcss.config.js      # PostCSS configuration
│   │
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Main application component
│       ├── index.css          # Global styles + Tailwind
│       │
│       ├── components/
│       │   ├── Header.jsx     # Top header with connection status
│       │   ├── Tabs.jsx       # Object type tabs with counts
│       │   ├── SearchBar.jsx  # Search input
│       │   ├── ActionsBar.jsx # Refresh, View toggle, Clear buttons
│       │   ├── StatsGrid.jsx  # Opportunity statistics
│       │   ├── DataTable.jsx  # Main data table
│       │   ├── KanbanView.jsx # Kanban board view
│       │   ├── EmptyState.jsx # Empty state placeholder
│       │   └── Footer.jsx     # Sync timestamp footer
│       │
│       └── utils/
│           ├── chrome.js      # Chrome API wrapper functions
│           └── format.js      # Formatting utilities
│
└── icons/                     # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Components

### 1. Manifest (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "Salesforce CRM Extractor",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://*.salesforce.com/*",
    "https://*.force.com/*",
    "https://*.lightning.force.com/*"
  ]
}
```

**Key Settings:**
- `manifest_version: 3` - Latest Chrome extension standard
- `permissions`:
  - `storage` - For Chrome local storage
  - `activeTab` - Access to current tab
  - `scripting` - Inject scripts dynamically
- `host_permissions` - Salesforce domain patterns

---

### 2. Service Worker (`service-worker.js`)

The background script that handles:

#### Storage Management
```javascript
const STORAGE_KEYS = {
  OPPORTUNITY: 'sf_opportunities',
  LEAD: 'sf_leads',
  CONTACT: 'sf_contacts',
  ACCOUNT: 'sf_accounts',
  TASK: 'sf_tasks',
  METADATA: 'sf_metadata'
};
```

#### Core Functions

| Function | Description |
|----------|-------------|
| `getStoredData(key)` | Retrieve data from Chrome storage |
| `saveData(key, data)` | Save data atomically |
| `clearAllData()` | Clear all stored data |
| `clearObjectData(objectType)` | Clear specific object type |
| `deduplicateAndMerge(existing, incoming)` | Smart merge without data loss |
| `processExtractedData(objectType, records)` | Process incoming extracted data |
| `getAllStoredData()` | Get all data for popup |
| `deleteRecord(objectType, recordId)` | Delete single record |

#### Deduplication Logic
```javascript
function deduplicateAndMerge(existingRecords, incomingRecords) {
  const recordMap = new Map();
  
  // Index existing records by ID
  for (const record of existingRecords) {
    if (record.id) recordMap.set(record.id, record);
  }
  
  // Merge incoming - update existing, insert new
  for (const incoming of incomingRecords) {
    const existing = recordMap.get(incoming.id);
    if (existing) {
      // Merge: keep old createdAt, update rest
      recordMap.set(incoming.id, {
        ...existing,
        ...incoming,
        updatedAt: new Date().toISOString(),
        createdAt: existing.createdAt
      });
    } else {
      // Insert new
      recordMap.set(incoming.id, {
        ...incoming,
        createdAt: new Date().toISOString()
      });
    }
  }
  
  return Array.from(recordMap.values());
}
```

---

### 3. Content Script (`content/extractor.js`)

The main extraction engine (1100+ lines). Runs on all Salesforce pages.

#### Field Maps
Defines which labels to look for when extracting each field:

```javascript
const FIELD_MAPS = {
  OPPORTUNITY: {
    name: ['Opportunity Name', 'Name'],
    amount: ['Amount'],
    stage: ['Stage'],
    probability: ['Probability (%)', 'Probability'],
    closeDate: ['Close Date'],
    accountName: ['Account Name'],
    ownerName: ['Opportunity Owner', 'Owner'],
    // ... more fields
  },
  LEAD: { /* ... */ },
  CONTACT: { /* ... */ },
  ACCOUNT: { /* ... */ },
  TASK: { /* ... */ }
};
```

#### Page Detection
```javascript
const PAGE_PATTERNS = {
  OPPORTUNITY: {
    urlPatterns: ['/Opportunity/', '/006/', 'objectApiName=Opportunity'],
    headerTexts: ['Opportunity', 'Opportunities'],
  },
  // ... other objects
};
```

#### Core Extraction Functions

| Function | Description |
|----------|-------------|
| `detectPageType()` | Identify current Salesforce object type |
| `detectViewType()` | Determine if list, record, or kanban view |
| `waitForLightningDom()` | Wait for Lightning components to render |
| `deepQuerySelector()` | Query that traverses shadow DOM |
| `deepQuerySelectorAll()` | Query all with shadow DOM traversal |
| `extractRecordData(objectType)` | Extract single record from detail page |
| `extractListData(objectType)` | Extract all records from list view |
| `extractKanbanData(objectType)` | Extract from Kanban board |
| `extractCellValue(cell)` | Clean extraction from table cell |
| `normalizeValue(value)` | Normalize extracted values |
| `performExtraction()` | Main orchestration function |
| `setupMutationObserver()` | Watch for SPA navigation changes |

#### Shadow DOM Traversal
```javascript
function deepQuerySelector(selector, root = document) {
  let result = root.querySelector(selector);
  if (result) return result;
  
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      result = deepQuerySelector(selector, el.shadowRoot);
      if (result) return result;
    }
  }
  return null;
}
```

#### View Type Detection
```javascript
function detectViewType(objectType) {
  const url = window.location.href;
  
  // Record view
  if (url.includes('/view')) return 'record';
  
  // List view with Kanban check
  if (url.includes('/list') || url.includes('filterName=')) {
    if (document.querySelector('[class*="kanban"]')) return 'kanban';
    return 'list';
  }
  
  // ... more checks
}
```

---

### 4. Popup Application (`popup/`)

Built with:
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling

#### Main App State
```jsx
const [activeTab, setActiveTab] = useState('opportunities');
const [data, setData] = useState(INITIAL_DATA);
const [searchQuery, setSearchQuery] = useState('');
const [viewMode, setViewMode] = useState('table'); // table | kanban | raw
const [isSalesforcePage, setIsSalesforcePage] = useState(false);
```

#### Components

| Component | Purpose |
|-----------|---------|
| `Header` | Shows title and connection status |
| `Tabs` | Object type tabs with record counts |
| `SearchBar` | Filter records by text |
| `ActionsBar` | Refresh, View toggle, Clear buttons |
| `StatsGrid` | Opportunity summary (count, pipeline, open) |
| `DataTable` | Tabular data display |
| `KanbanView` | Kanban board for opportunities |
| `EmptyState` | Shown when no records |
| `Footer` | Last sync timestamp |

#### Column Definitions
```javascript
const COLUMNS = {
  opportunities: [
    { key: 'name', label: 'Name', format: truncate },
    { key: 'amount', label: 'Amount', format: formatCurrency },
    { key: 'stage', label: 'Stage', isStage: true },
    { key: 'closeDate', label: 'Close Date', format: formatDate },
  ],
  // ... other objects
};
```

---

## Data Flow

### Extraction Flow
```
1. Page Load
   └─► Content script injected
       └─► waitForLightningDom()
           └─► detectPageType()
               └─► performExtraction()
                   ├─► extractListData()    [if list view]
                   ├─► extractKanbanData()  [if kanban view]
                   └─► extractRecordData()  [if record view]
                       └─► sendMessageSafe({type: 'EXTRACTED_DATA'})
                           └─► Service Worker
                               └─► processExtractedData()
                                   └─► deduplicateAndMerge()
                                       └─► saveData()
```

### Popup Data Flow
```
1. Popup Opens
   └─► App.jsx useEffect
       └─► loadAllData()
           └─► sendMessage({type: 'GET_ALL_DATA'})
               └─► Service Worker
                   └─► getAllStoredData()
                       └─► Response to popup
                           └─► setData(response)
```

### Refresh Flow
```
1. User clicks Refresh
   └─► handleRefresh()
       └─► sendMessage({type: 'TRIGGER_EXTRACTION'})
           └─► Service Worker
               └─► chrome.tabs.sendMessage({type: 'EXTRACT_NOW'})
                   └─► Content Script
                       └─► performExtraction()
                           └─► ... extraction flow
```

---

## API Reference

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `EXTRACTED_DATA` | Content → Service Worker | Send extracted records |
| `GET_ALL_DATA` | Popup → Service Worker | Request all stored data |
| `GET_OBJECT_DATA` | Popup → Service Worker | Request specific object data |
| `CLEAR_ALL_DATA` | Popup → Service Worker | Clear all storage |
| `CLEAR_OBJECT_DATA` | Popup → Service Worker | Clear specific object |
| `DELETE_RECORD` | Popup → Service Worker | Delete single record |
| `TRIGGER_EXTRACTION` | Popup → Service Worker → Content | Trigger extraction |
| `EXTRACT_NOW` | Service Worker → Content | Command to extract |
| `GET_PAGE_INFO` | Service Worker → Content | Get current page info |
| `CHECK_SALESFORCE_PAGE` | Popup → Service Worker | Check if on SF page |

### Message Format

```javascript
// EXTRACTED_DATA
{
  type: 'EXTRACTED_DATA',
  objectType: 'OPPORTUNITY',
  records: [{ id, name, amount, ... }]
}

// GET_ALL_DATA Response
{
  opportunities: { records: [], lastSync: '2026-01-17T...' },
  leads: { records: [], lastSync: null },
  // ...
}

// DELETE_RECORD
{
  type: 'DELETE_RECORD',
  objectType: 'opportunities',
  recordId: '006xxx'
}
```

---

## Storage Schema

### Chrome Local Storage Structure

```javascript
{
  "sf_opportunities": {
    "records": [
      {
        "id": "006xxx",
        "name": "Acme Deal",
        "amount": 50000,
        "stage": "Prospecting",
        "closeDate": "2026-03-15",
        "accountName": "Acme Corp",
        "ownerName": "John Doe",
        "_objectType": "OPPORTUNITY",
        "_extractedAt": "2026-01-17T01:48:00.000Z",
        "_sourceUrl": "https://...",
        "createdAt": "2026-01-17T01:48:00.000Z",
        "updatedAt": "2026-01-17T01:48:00.000Z"
      }
    ],
    "lastSync": "2026-01-17T01:48:00.000Z",
    "objectType": "OPPORTUNITY"
  },
  "sf_leads": { /* same structure */ },
  "sf_contacts": { /* same structure */ },
  "sf_accounts": { /* same structure */ },
  "sf_tasks": { /* same structure */ },
  "sf_metadata": {
    "installedAt": "2026-01-15T...",
    "version": "1.0.0"
  }
}
```

### Record Fields by Object

#### Opportunity
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Salesforce ID (006xxx) |
| `name` | string | Opportunity name |
| `amount` | number | Deal amount |
| `stage` | string | Sales stage |
| `probability` | number | Win probability % |
| `closeDate` | string | Expected close date |
| `accountName` | string | Related account |
| `ownerName` | string | Record owner |
| `type` | string | Opportunity type |
| `leadSource` | string | Lead source |

#### Lead
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Salesforce ID (00Qxxx) |
| `name` | string | Lead name |
| `company` | string | Company name |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `status` | string | Lead status |
| `leadSource` | string | Lead source |
| `industry` | string | Industry |
| `rating` | string | Lead rating |
| `ownerName` | string | Record owner |
| `title` | string | Job title |

#### Contact
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Salesforce ID (003xxx) |
| `name` | string | Contact name |
| `accountName` | string | Related account |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `mobilePhone` | string | Mobile number |
| `title` | string | Job title |
| `department` | string | Department |
| `ownerName` | string | Record owner |

#### Account
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Salesforce ID (001xxx) |
| `name` | string | Account name |
| `industry` | string | Industry |
| `type` | string | Account type |
| `phone` | string | Phone number |
| `website` | string | Website URL |
| `ownerName` | string | Record owner |
| `annualRevenue` | number | Annual revenue |
| `employees` | number | Employee count |

#### Task
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Salesforce ID (00Txxx) |
| `subject` | string | Task subject |
| `dueDate` | string | Due date |
| `status` | string | Task status |
| `priority` | string | Priority level |
| `relatedTo` | string | Related record |
| `assignedTo` | string | Assigned user |

---

## Extraction Logic

### List View Extraction

1. **Find Table** - Try multiple selectors including shadow DOM:
   ```javascript
   const tableSelectors = [
     'table[role="grid"]',
     'table.slds-table',
     '[class*="uiVirtualDataTable"] table',
     'lightning-datatable table',
     // ... more selectors
   ];
   ```

2. **Extract Headers** - Get column names from `<th>` elements

3. **Extract Rows** - For each `<tr>`:
   - Get record ID from `data-row-key-value` or link href
   - Extract cell values using `extractCellValue()`
   - Map columns to fields using `FIELD_MAPS`

4. **Clean Values** - Use `normalizeValue()` to:
   - Trim whitespace
   - Parse currency ($1,234.56 → 1234.56)
   - Parse percentages (50% → 50)
   - Filter out "Edit", "Delete" button text

### Cell Value Extraction Priority

```javascript
function extractCellValue(cell) {
  // 1. Lightning formatted elements
  const formattedEl = cell.querySelector(
    'lightning-formatted-text, lightning-formatted-number, ...'
  );
  if (formattedEl) return normalizeValue(formattedEl.textContent);
  
  // 2. SLDS output elements
  const outputEl = cell.querySelector('[class*="uiOutputText"], ...');
  if (outputEl) return normalizeValue(outputEl.textContent);
  
  // 3. Links (excluding Edit/Delete)
  const link = cell.querySelector('a[href*="/lightning/r/"]');
  if (link) return normalizeValue(link.textContent);
  
  // 4. Span content (not icons)
  // 5. Direct text content
}
```

### Kanban Extraction

For Opportunity Kanban view:

1. **Find Cards** - Query for kanban card elements
2. **Extract from each card**:
   - ID from link or data attribute
   - Name from main link text
   - Stage from parent column header
   - Account from secondary links

---

## Message Protocol

### Safe Message Sending

```javascript
function sendMessageSafe(message) {
  return new Promise((resolve, reject) => {
    // Check extension context is valid
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
  });
}
```

### Handling Extension Reload

When the extension is reloaded, content scripts become orphaned. The code checks `chrome.runtime.id` before sending messages to prevent errors.

---

## Troubleshooting

### Common Issues

#### "No list table found"
**Cause:** Table is in shadow DOM or uses unexpected selectors
**Solution:** The extractor uses `deepQuerySelector()` to traverse shadow DOM. If still failing, check browser console for selector debugging output.

#### "Extension context invalidated"
**Cause:** Extension was reloaded while page was open
**Solution:** Refresh the Salesforce page. The code handles this gracefully with `sendMessageSafe()`.

#### Empty data extracted
**Cause:** 
- Table hasn't finished loading
- Selectors don't match current SF version
**Solution:** 
- Wait longer (timeout is 10 seconds)
- Check console for "Headers found:" debug message

#### Incorrect field values
**Cause:** Cell contains extra text (Edit buttons, icons)
**Solution:** `extractCellValue()` filters out common UI text. May need additional filters.

### Debug Logging

All logs are prefixed with `[SF Extractor]`:

```
[SF Extractor] Content script loaded
[SF Extractor] Lightning DOM ready
[SF Extractor] Detected: OPPORTUNITY (list)
[SF Extractor] Found table with selector: table[role="grid"]
[SF Extractor] Headers found: ["Name", "Amount", "Stage", ...]
[SF Extractor] Extracted 5 list records
```

### Testing Checklist

1. ✅ Open Salesforce Opportunity list → Check extraction
2. ✅ Open Opportunity Kanban → Check kanban extraction
3. ✅ Open single Opportunity record → Check record extraction
4. ✅ Navigate via SPA (no page reload) → Check MutationObserver
5. ✅ Open popup → Check data display
6. ✅ Click Refresh → Check trigger extraction
7. ✅ Search records → Check filtering
8. ✅ Delete record → Check deletion
9. ✅ Clear all → Check storage clear

---

## Building & Development

### Popup Build

```bash
cd popup
npm install
npm run build    # Production build to dist/
npm run dev      # Development server
```

### Loading Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### File Changes

| File Changed | Action Needed |
|--------------|---------------|
| `manifest.json` | Reload extension |
| `service-worker.js` | Reload extension |
| `content/extractor.js` | Reload extension + refresh SF page |
| `popup/src/*` | Run `npm run build` + reopen popup |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-17 | Initial release |

---

*Documentation generated for Salesforce CRM Extractor v1.0.0*
