let currentDomain = '';
let allCookies = [];
let editingCookie = null;

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

  if (!name) {
    alert('Cookie name is required');
    return;
  }

  if (!domain) {
    alert('Domain is required');
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

  const tab = await getCurrentTab();
  const protocol = new URL(tab.url).protocol;
  cookieDetails.url = protocol + '//' + domain + path;

  try {
    await chrome.cookies.set(cookieDetails);
    hideModal();
    await loadCookies();
  } catch (error) {
    alert('Error saving cookie: ' + error.message);
  }
}

function editCookie(name) {
  const cookie = allCookies.find(c => c.name === name);
  if (cookie) {
    showModal('Edit Cookie', cookie);
  }
}

async function deleteCookie(name) {
  if (!confirm(`Delete cookie "${name}"?`)) {
    return;
  }

  const cookie = allCookies.find(c => c.name === name);
  if (cookie) {
    const tab = await getCurrentTab();
    const protocol = new URL(tab.url).protocol;
    await chrome.cookies.remove({
      name: cookie.name,
      url: protocol + '//' + cookie.domain + cookie.path
    });
    await loadCookies();
  }
}

async function deleteAllCookies() {
  if (!confirm(`Delete all ${allCookies.length} cookies for ${currentDomain}?`)) {
    return;
  }

  const tab = await getCurrentTab();
  const protocol = new URL(tab.url).protocol;

  for (const cookie of allCookies) {
    await chrome.cookies.remove({
      name: cookie.name,
      url: protocol + '//' + cookie.domain + cookie.path
    });
  }

  await loadCookies();
}

function exportCookies() {
  const dataStr = JSON.stringify(allCookies, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cookies_${currentDomain}_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importCookies(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const cookies = JSON.parse(text);

    if (!Array.isArray(cookies)) {
      alert('Invalid cookie file format');
      return;
    }

    const tab = await getCurrentTab();
    const protocol = new URL(tab.url).protocol;
    let imported = 0;

    for (const cookie of cookies) {
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
      }
    }

    alert(`Successfully imported ${imported} out of ${cookies.length} cookies`);
    await loadCookies();
  } catch (error) {
    alert('Error importing cookies: ' + error.message);
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
