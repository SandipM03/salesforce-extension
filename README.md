# Salesforce CRM Extractor

A Chrome Extension that extracts data from Salesforce CRM objects (Leads, Contacts, Accounts, Opportunities, Tasks), stores them locally, and displays them in a popup dashboard.

## Features

- **Automatic Extraction**: Detects Salesforce pages and extracts data automatically
- **SPA Support**: Uses MutationObserver to handle Salesforce Lightning navigation
- **Local Storage**: All data stored locally in Chrome storage
- **Deduplication**: Smart merge logic that updates existing records, never overwrites blindly
- **Multi-Object Support**: Opportunities, Leads, Contacts, Accounts, Tasks
- **Dashboard Views**: Table, Cards, Kanban, and Raw JSON views
- **Search**: Fast client-side search across all fields
- **Shadow DOM Feedback**: Non-intrusive floating badge for extraction status

## Architecture

```
Popup → Content Script → Service Worker → Storage → Popup
```

### Components

- **Content Script** (`content/extractor.js`): Page detection and data extraction
- **Service Worker** (`service-worker.js`): Storage management, deduplication, message routing
- **Popup** (`popup/`): Read-only dashboard with multiple view modes

### Flow

1. Content script injects into Salesforce pages
2. Detects page type (Opportunity record, Lead list, etc.)
3. Extracts field values using multiple DOM strategies
4. Sends extracted data to service worker
5. Service worker deduplicates and merges with existing data
6. Saves atomically to Chrome local storage
7. Popup reads from storage and displays dashboard

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension icon will appear in your toolbar

### Usage

1. Navigate to Salesforce (any *.salesforce.com or *.force.com page)
2. Open Opportunity, Lead, Contact, Account, or Task records
3. Data is extracted automatically
4. Click the extension icon to view the dashboard
5. Use tabs to switch between object types
6. Use search to filter records
7. Toggle view modes (Table → Cards → Kanban → Raw)

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── service-worker.js      # Background storage & messaging
├── content/
│   └── extractor.js       # Salesforce DOM extraction
├── popup/
│   ├── index.html         # Popup UI shell
│   └── main.js            # Dashboard logic (vanilla JS)
├── shared/
│   ├── constants.js       # Shared constants
│   └── utils.js           # Utility functions
├── icons/
│   └── *.svg              # Extension icons
└── README.md
```

## Field Mappings

### Opportunity
- Name, Amount, Stage, Probability, Close Date
- Account Name, Owner, Type, Lead Source

### Lead
- Name, Company, Email, Phone, Status
- Lead Source, Industry, Rating, Owner, Title

### Contact
- Name, Account Name, Email, Phone, Mobile
- Title, Department, Owner

### Account
- Name, Industry, Type, Phone, Website
- Owner, Annual Revenue, Employees

### Task
- Subject, Due Date, Status, Priority
- Related To, Assigned To

## Detection Strategy

1. **URL Patterns**: `/Opportunity/`, `/006/`, `/Lead/`, `/00Q/`, etc.
2. **Page Header Text**: "Opportunity", "Lead", etc.
3. **Lightning Metadata**: `data-app-id`, `objectApiName` query param
4. **DOM Structure**: Record layout vs list view elements

## Storage Schema

Each object type stored with:

```javascript
{
  records: [
    {
      id: "006xxxxx",           // Salesforce record ID
      name: "Big Deal",         // Extracted fields...
      amount: 50000,
      stage: "Proposal",
      _objectType: "OPPORTUNITY",
      _extractedAt: "2026-01-16T...",
      _sourceUrl: "https://..."
    }
  ],
  lastSync: "2026-01-16T...",
  objectType: "OPPORTUNITY"
}
```

## Deduplication Logic

```javascript
if (existing.id === incoming.id) {
  // Update existing record (merge fields)
} else {
  // Insert new record
}
```

- Never overwrites blindly
- Tracks `createdAt` and `updatedAt` timestamps
- Preserves original creation time on updates

## Customization

### Adding New Fields

Edit `content/extractor.js`:

```javascript
const FIELD_MAPS = {
  OPPORTUNITY: {
    customField: ['Custom Field Label', 'Alt Label'],
    // ...
  }
}
```

### Adding New Object Types

1. Add field map to `FIELD_MAPS`
2. Add URL patterns to `PAGE_PATTERNS`
3. Add storage key to `STORAGE_KEYS` (in service-worker.js)
4. Add tab to popup UI

## Troubleshooting

### Data not extracting?

1. Check Console for `[SF Extractor]` logs
2. Verify you're on a Lightning record/list page
3. Check if page type is detected (`detectPageType()`)
4. DOM selectors may need adjustment for custom Salesforce configs

### Storage issues?

1. Open Chrome DevTools → Application → Storage → Local Storage
2. Look for keys starting with `sf_`
3. Use popup's Clear button to reset

### Extension not loading?

1. Check `chrome://extensions/` for errors
2. Reload the extension
3. Check manifest.json for syntax errors

## Development

No build step required - vanilla JavaScript.

To make changes:
1. Edit files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload any Salesforce pages

## Privacy

- All data stored locally in Chrome
- No external API calls
- No tracking or analytics
- Data never leaves your browser

## License

MIT
