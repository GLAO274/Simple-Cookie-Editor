let currentDomain = '';
let allCookies = [];
let editingCookie = null;

// Security Constants
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_COOKIES_IMPORT = 1000;
const MAX_COOKIE_NAME_LENGTH = 256;
const MAX_COOKIE_VALUE_LENGTH = 4096;
const MAX_DOMAIN_LENGTH = 253;
const MAX_PATH_LENGTH = 1024;

// Security Validation Functions
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > MAX_DOMAIN_LENGTH) return false;
  
  // Remove leading dot if present
  const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  
  // Basic domain validation regex
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  if (!domainRegex.test(cleanDomain)) return false;
  
  // Prevent obvious malicious patterns
  if (cleanDomain.includes('..') || cleanDomain.includes('//')) return false;
  
  return true;
}

function isValidPath(path) {
  if (!path || typeof path !== 'string') return false;
  if (path.length > MAX_PATH_LENGTH) return false;
  if (!path.startsWith('/')) return false;
  
  // Prevent path traversal and malicious patterns
  if (path.includes('..') || path.includes('\\')) return false;
  
  return true;
}

function isValidCookieName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length > MAX_COOKIE_NAME_LENGTH) return false;
  
  // Cookie names cannot contain certain characters
  const invalidChars = /[\s,;=]/;
  if (invalidChars.test(name)) return false;
  
  return true;
}

function isValidCookieValue(value) {
  if (typeof value !== 'string') return false;
  if (value.length > MAX_COOKIE_VALUE_LENGTH) return false;
  
  return true;
}

function sanitizeErrorMessage(error) {
  // Generic error messages to prevent information leakage
  const errorMap = {
    'network': 'Network error occurred',
    'permission': 'Permission denied',
    'invalid': 'Invalid input provided',
    'timeout': 'Operation timed out',
    'default': 'An error occurred'
  };
  
  const errorStr = error.toString().toLowerCase();
  
  if (errorStr.includes('network') || errorStr.includes('fetch')) {
    return errorMap.network;
  }
  if (errorStr.includes('permission') || errorStr.includes('denied')) {
    return errorMap.permission;
  }
  if (errorStr.includes('invalid') || errorStr.includes('validation')) {
    return errorMap.invalid;
  }
  if (errorStr.includes('timeout')) {
    return errorMap.timeout;
  }
  
  return errorMap.default;
}

function validateCookieSchema(cookie) {
  if (!cookie || typeof cookie !== 'object') {
    return { valid: false, error: 'Invalid cookie object' };
  }
  
  if (!isValidCookieName(cookie.name)) {
    return { valid: false, error: 'Invalid cookie name' };
  }
  
  if (!isValidCookieValue(cookie.value || '')) {
    return { valid: false, error: 'Invalid cookie value' };
  }
  
  if (!isValidDomain(cookie.domain)) {
    return { valid: false, error: 'Invalid domain' };
  }
  
  if (!isValidPath(cookie.path || '/')) {
    return { valid: false, error: 'Invalid path' };
  }
  
  // Validate boolean fields
  if (cookie.secure !== undefined && typeof cookie.secure !== 'boolean') {
    return { valid: false, error: 'Invalid secure flag' };
  }
  
  if (cookie.httpOnly !== undefined && typeof cookie.httpOnly !== 'boolean') {
    return { valid: false, error: 'Invalid httpOnly flag' };
  }
  
  // Validate expiration date
  if (cookie.expirationDate !== undefined) {
    if (typeof cookie.expirationDate !== 'number' || cookie.expirationDate < 0) {
      return { valid: false, error: 'Invalid expiration date' };
    }
  }
  
  return { valid: true };
}

function isDomainRelated(cookieDomain, currentDomain) {
  if (!cookieDomain || !currentDomain) return false;
  
  const cleanCookieDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
  const cleanCurrentDomain = currentDomain.startsWith('.') ? currentDomain.substring(1) : currentDomain;
  
  // Cookie domain must match or be a parent of current domain
  return cleanCurrentDomain === cleanCookieDomain || 
         cleanCurrentDomain.endsWith('.' + cleanCookieDomain);
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
}

async function loadCookies() {
  const tab = await getCurrentTab();
  currentDomain = getDomainFromUrl(tab.url);
  document.getElementById('currentDomain').textContent = currentDomain;

  // Get all cookies for current domain and parent domains
  const cookies = await chrome.cookies.getAll({ url: tab.url });
  
  // Filter to only show cookies relevant to this domain
  const domainParts = currentDomain.split('.');
  const relevantCookies = cookies.filter(cookie => {
    // Remove leading dot from cookie domain for comparison
    const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
    
    // Check if cookie domain matches or is a parent of current domain
    return currentDomain.endsWith(cookieDomain) || cookieDomain === currentDomain;
  });

  allCookies = relevantCookies;
  displayCookies(relevantCookies);
}

function displayCookies(cookies) {
  const cookieList = document.getElementById('cookieList');
  
  if (cookies.length === 0) {
    cookieList.innerHTML = '<div class="empty-state"><p>No cookies found for this domain</p></div>';
    return;
  }

  cookieList.innerHTML = '';
  
  cookies.forEach(cookie => {
    const expiresText = cookie.expirationDate 
      ? new Date(cookie.expirationDate * 1000).toLocaleString()
      : 'Session';
    
    const secureBadge = cookie.secure ? '<span class="badge badge-secure">SECURE</span>' : '';
    const httpOnlyBadge = cookie.httpOnly ? '<span class="badge badge-httponly">HTTP-ONLY</span>' : '';

    const cookieItem = document.createElement('div');
    cookieItem.className = 'cookie-item';
    cookieItem.innerHTML = `
      <div class="cookie-name">${escapeHtml(cookie.name)}${secureBadge}${httpOnlyBadge}</div>
      <div class="cookie-value">${escapeHtml(cookie.value)}</div>
      <div class="cookie-details">Domain: ${escapeHtml(cookie.domain)}</div>
      <div class="cookie-details">Path: ${escapeHtml(cookie.path)}</div>
      <div class="cookie-details">Expires: ${expiresText}</div>
      <div class="cookie-actions">
        <button class="btn-success copy-btn">Copy</button>
        <button class="btn-primary edit-btn">Edit</button>
        <button class="btn-danger delete-btn">Delete</button>
      </div>
    `;

    const copyBtn = cookieItem.querySelector('.copy-btn');
    const editBtn = cookieItem.querySelector('.edit-btn');
    const deleteBtn = cookieItem.querySelector('.delete-btn');
    
    copyBtn.addEventListener('click', () => copyCookieValue(cookie.value, copyBtn));
    editBtn.addEventListener('click', () => editCookie(cookie.name));
    deleteBtn.addEventListener('click', () => deleteCookie(cookie.name));

    cookieList.appendChild(cookieItem);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function copyCookieValue(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  } catch (error) {
    console.error('Failed to copy:', error);
    alert('Failed to copy cookie value');
  }
}

function searchCookies(query) {
  const filtered = allCookies.filter(cookie => 
    cookie.name.toLowerCase().includes(query.toLowerCase()) ||
    cookie.value.toLowerCase().includes(query.toLowerCase())
  );
  displayCookies(filtered);
}

function showModal(title, cookie = null) {
  editingCookie = cookie;
  document.getElementById('modalTitle').textContent = title;
  
  if (cookie) {
    document.getElementById('cookieName').value = cookie.name;
    document.getElementById('cookieValue').value = cookie.value;
    document.getElementById('cookieDomain').value = cookie.domain;
    document.getElementById('cookiePath').value = cookie.path;
    
    const daysUntilExpiry = cookie.expirationDate 
      ? Math.round((cookie.expirationDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;
    document.getElementById('cookieExpires').value = Math.max(0, daysUntilExpiry);
    
    document.getElementById('cookieSecure').checked = cookie.secure;
    document.getElementById('cookieHttpOnly').checked = cookie.httpOnly;
    document.getElementById('cookieName').disabled = true;
  } else {
    document.getElementById('cookieName').value = '';
    document.getElementById('cookieValue').value = '';
    document.getElementById('cookieDomain').value = currentDomain;
    document.getElementById('cookiePath').value = '/';
    document.getElementById('cookieExpires').value = '0';
    document.getElementById('cookieSecure').checked = false;
    document.getElementById('cookieHttpOnly').checked = false;
    document.getElementById('cookieName').disabled = false;
  }
  
  document.getElementById('cookieModal').classList.add('active');
}

function hideModal() {
  document.getElementById('cookieModal').classList.remove('active');
  editingCookie = null;
}

async function saveCookie() {
  const name = document.getElementById('cookieName').value.trim();
  const value = document.getElementById('cookieValue').value;
  const domain = document.getElementById('cookieDomain').value.trim();
  const path = document.getElementById('cookiePath').value.trim();
  const expiryDays = parseInt(document.getElementById('cookieExpires').value);
  const secure = document.getElementById('cookieSecure').checked;
  const httpOnly = document.getElementById('cookieHttpOnly').checked;

  // Validate all inputs
  if (!isValidCookieName(name)) {
    alert('Invalid cookie name. Name cannot contain spaces, commas, semicolons, or equals signs.');
    return;
  }

  if (!isValidCookieValue(value)) {
    alert('Cookie value is too long or invalid.');
    return;
  }

  if (!isValidDomain(domain)) {
    alert('Invalid domain format.');
    return;
  }

  if (!isValidPath(path)) {
    alert('Invalid path. Path must start with / and cannot contain .. or \\');
    return;
  }

  // Security check: Verify domain is related to current page
  if (!isDomainRelated(domain, currentDomain)) {
    alert('Security error: Cannot set cookies for unrelated domains. Cookie domain must match or be a parent of the current domain.');
    return;
  }

  const cookieDetails = {
    name: name,
    value: value,
    domain: domain,
    path: path || '/',
    secure: secure,
    httpOnly: httpOnly
  };

  if (expiryDays > 0) {
    cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
  }

  try {
    const tab = await getCurrentTab();
    const protocol = new URL(tab.url).protocol;
    
    // Additional security: validate constructed URL
    if (protocol !== 'http:' && protocol !== 'https:') {
      alert('Invalid protocol. Cookies can only be set on HTTP or HTTPS pages.');
      return;
    }
    
    cookieDetails.url = protocol + '//' + domain + path;

    await chrome.cookies.set(cookieDetails);
    hideModal();
    await loadCookies();
  } catch (error) {
    console.error('Error saving cookie:', error);
    alert(sanitizeErrorMessage(error));
  }
}

function editCookie(name) {
  const cookie = allCookies.find(c => c.name === name);
  if (cookie) {
    showModal('Edit Cookie', cookie);
  }
}

async function deleteCookie(name) {
  if (!confirm(`Delete cookie "${escapeHtml(name)}"?`)) {
    return;
  }

  const cookie = allCookies.find(c => c.name === name);
  if (cookie) {
    try {
      const tab = await getCurrentTab();
      const protocol = new URL(tab.url).protocol;
      await chrome.cookies.remove({
        name: cookie.name,
        url: protocol + '//' + cookie.domain + cookie.path
      });
      await loadCookies();
    } catch (error) {
      console.error('Error deleting cookie:', error);
      alert(sanitizeErrorMessage(error));
    }
  }
}

async function deleteAllCookies() {
  if (!confirm(`Delete all ${allCookies.length} cookies for ${currentDomain}?`)) {
    return;
  }

  try {
    const tab = await getCurrentTab();
    const protocol = new URL(tab.url).protocol;

    for (const cookie of allCookies) {
      await chrome.cookies.remove({
        name: cookie.name,
        url: protocol + '//' + cookie.domain + cookie.path
      });
    }

    await loadCookies();
  } catch (error) {
    console.error('Error deleting cookies:', error);
    alert(sanitizeErrorMessage(error));
  }
}

function exportCookies() {
  try {
    const dataStr = JSON.stringify(allCookies, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cookies_${currentDomain}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting cookies:', error);
    alert('Failed to export cookies');
  }
}

async function importCookies(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file size
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    alert(`File too large. Maximum size is ${MAX_IMPORT_FILE_SIZE / 1024 / 1024}MB`);
    event.target.value = '';
    return;
  }

  // Validate file type
  if (!file.name.endsWith('.json')) {
    alert('Invalid file type. Please select a JSON file.');
    event.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    let cookies;
    
    try {
      cookies = JSON.parse(text);
    } catch (parseError) {
      alert('Invalid JSON format');
      event.target.value = '';
      return;
    }

    if (!Array.isArray(cookies)) {
      alert('Invalid cookie file format. Expected an array of cookies.');
      event.target.value = '';
      return;
    }

    if (cookies.length > MAX_COOKIES_IMPORT) {
      alert(`Too many cookies. Maximum is ${MAX_COOKIES_IMPORT} cookies per import.`);
      event.target.value = '';
      return;
    }

    const tab = await getCurrentTab();
    const protocol = new URL(tab.url).protocol;
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const cookie of cookies) {
      // Validate cookie schema
      const validation = validateCookieSchema(cookie);
      if (!validation.valid) {
        skipped++;
        errors.push(`${cookie.name || 'unknown'}: ${validation.error}`);
        continue;
      }

      // Security check: Only import cookies for related domains
      if (!isDomainRelated(cookie.domain, currentDomain)) {
        skipped++;
        errors.push(`${cookie.name}: Domain not related to current page`);
        continue;
      }

      try {
        const cookieDetails = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          url: protocol + '//' + cookie.domain + (cookie.path || '/')
        };

        if (cookie.expirationDate) {
          cookieDetails.expirationDate = cookie.expirationDate;
        }

        await chrome.cookies.set(cookieDetails);
        imported++;
      } catch (error) {
        console.error('Error importing cookie:', cookie.name, error);
        skipped++;
        errors.push(`${cookie.name}: Failed to import`);
      }
    }

    let message = `Successfully imported ${imported} out of ${cookies.length} cookies`;
    if (skipped > 0) {
      message += `\n${skipped} cookies were skipped due to validation errors.`;
      if (errors.length <= 5) {
        message += `\n\nErrors:\n${errors.join('\n')}`;
      }
    }
    
    alert(message);
    await loadCookies();
  } catch (error) {
    console.error('Error importing cookies:', error);
    alert(sanitizeErrorMessage(error));
  }

  event.target.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchBox').addEventListener('input', (e) => {
    searchCookies(e.target.value);
  });

  document.getElementById('addBtn').addEventListener('click', () => {
    showModal('Add Cookie');
  });

  document.getElementById('exportBtn').addEventListener('click', exportCookies);

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', importCookies);

  document.getElementById('deleteAllBtn').addEventListener('click', deleteAllCookies);

  document.getElementById('saveBtn').addEventListener('click', saveCookie);

  document.getElementById('cancelBtn').addEventListener('click', hideModal);

  document.getElementById('cookieModal').addEventListener('click', (e) => {
    if (e.target.id === 'cookieModal') {
      hideModal();
    }
  });

  loadCookies();
});
