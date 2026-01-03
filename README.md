# Simple Cookie Editor

A browser extension to view, edit, and manage cookies.

## Features
- View all cookies for any website
- Add, edit, and delete cookies
- Copy cookie values
- Export/import cookies as JSON
- Search and filter cookies

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

## Security Notes
- Only works on regular websites (not chrome:// or about:// pages)
- Secure cookies require HTTPS
- All data stays local in your browser

## Version
1.0.0
