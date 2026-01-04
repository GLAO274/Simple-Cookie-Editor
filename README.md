# Simple Cookie Editor

A browser extension created by Claude to view, edit, and manage cookies with security features.

## Features
- View all cookies for any website (collapsible interface)
- Add, edit, and delete cookies
- Copy cookie values
- Export/import cookies as JSON
- Search and filter cookies
- Domain validation and security checks

## Installation

### Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `simple-cookie-editor` folder

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select the `manifest.json` file from the folder

## How to Use

Click the extension icon to open the cookie editor. You can:
- **View**: See all cookies for the current site
- **Copy**: Click "Copy" to copy a cookie value
- **Add**: Click "Add Cookie" to create a new cookie
- **Edit**: Click "Edit" to modify an existing cookie
- **Delete**: Remove individual cookies or delete all
- **Export/Import**: Backup and restore cookies as JSON files
- **Search**: Filter cookies by name or value
- **Collapse/Expand**: Click cookies to expand or use the toggle link

## Security Notes
- Only works on regular websites (not chrome:// or about:// pages)
- Secure cookies require HTTPS
- All data stays local in your browser
- Domain validation prevents setting cookies for unrelated domains
- Import files limited to 5MB and 1000 cookies
- Input validation on all cookie fields

## Version
1.2.0
