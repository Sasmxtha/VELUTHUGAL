// =============================================
// VELUTHUGAL WEBSITE - app.js
// =============================================
const API = '';
let currentUser = null;
let currentLoginTab = 'admin';
let editingEventId = null;
let expenseCount = 0;
let calYear, calMonth;
let allEvents = [];
let confirmCallback = null;
let resetPassMemberId = null;

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('vToken');
  const role = localStorage.getItem('vRole');
  const name = localStorage.getItem('vName');
  if (stored && role) {
    currentUser = { token: stored, role, name };
    updateUI();
  }
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  loadSiteContent();
  showPage('home');
  addEnterKeyListeners();
});

async function loadSiteContent() {
  try {
    const content = await apiFetch('/api/content');
    if (document.getElementById('heroText')) document.getElementById('heroText').textContent = content.hero_desc;
    if (document.getElementById('ctaTitle')) document.getElementById('ctaTitle').textContent = content.cta_title;
    if (document.getElementById('ctaDesc')) document.getElementById('ctaDesc').textContent = content.cta_desc;
    
    // Fill admin inputs if they exist
    if (document.getElementById('editHeroDesc')) document.getElementById('editHeroDesc').value = content.hero_desc;
    if (document.getElementById('editCtaTitle')) document.getElementById('editCtaTitle').value = content.cta_title;
    if (document.getElementById('editCtaDesc')) document.getElementById('editCtaDesc').value = content.cta_desc;
  } catch(e) { console.error('Failed to load content', e); }
}

async function saveContentSettings() {
  const data = {
    hero_desc: document.getElementById('editHeroDesc').value,
    cta_title: document.getElementById('editCtaTitle').value,
    cta_desc: document.getElementById('editCtaDesc').value
  };
  try {
    await apiFetch('/api/content', { method: 'POST', body: JSON.stringify(data) });
    showToast('Content updated successfully!', 'success');
    loadSiteContent();
  } catch(e) { showToast(e.message, 'error'); }
}

function enterDashboard() {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => { splash.style.display = 'none'; }, 700);
  }
}

function addEnterKeyListeners() {
  document.getElementById('adminUser').addEventListener('keypress', e => { if(e.key==='Enter') loginAdmin(); });
  document.getElementById('adminPass').addEventListener('keypress', e => { if(e.key==='Enter') loginAdmin(); });
  document.getElementById('memberEmail').addEventListener('keypress', e => { if(e.key==='Enter') loginMember(); });
  document.getElementById('memberPass').addEventListener('keypress', e => { if(e.key==='Enter') loginMember(); });
}

// =============================================
// NAVIGATION
// =============================================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  if (document.getElementById('sidebar').classList.contains('open')) toggleSidebar();

  // active nav highlight
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navLink = document.querySelector(`.nav-links a[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  if (page === 'home') loadHomeEvents();
  if (page === 'events') loadAllEvents();
  if (page === 'calendar') renderCalendar();
  if (page === 'members') loadMembersPage();
  if (page === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') { showPage('login'); return; }
    loadAdminDashboard();
  }
}

function updateUI() {
  const isLoggedIn = !!currentUser;
  const isAdmin = currentUser?.role === 'admin';
  document.getElementById('authArea').style.display = isLoggedIn ? 'none' : 'flex';
  document.getElementById('userArea').style.display = isLoggedIn ? 'flex' : 'none';
  document.getElementById('nav-admin').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('nav-logout').style.display = isLoggedIn ? 'block' : 'none';
  if (isLoggedIn) {
    document.getElementById('userBadge').textContent = `${isAdmin ? '⚙️ Admin' : '👤 ' + (currentUser.name || 'Member')}`;
  }
}

function logout() {
  localStorage.removeItem('vToken');
  localStorage.removeItem('vRole');
  localStorage.removeItem('vName');
  currentUser = null;
  updateUI();
  showPage('home');
  showToast('Logged out successfully');
}

function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁️';
}

// =============================================
// TOAST
// =============================================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// =============================================
// API HELPER
// =============================================
async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (currentUser?.token) headers['Authorization'] = 'Bearer ' + currentUser.token;
  if (options.body instanceof FormData) delete headers['Content-Type'];
  
  // Since the frontend and backend are hosted on the same server,
  // we can use relative paths which will natively adapt to Render or Localhost!
  const res = await fetch(endpoint, { ...options, headers });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// =============================================
// AUTH
// =============================================
function switchLoginTab(tab) {
  currentLoginTab = tab;
  document.getElementById('tabAdmin').classList.toggle('active', tab === 'admin');
  document.getElementById('tabMember').classList.toggle('active', tab === 'member');
  document.getElementById('adminLoginForm').style.display = tab === 'admin' ? 'block' : 'none';
  document.getElementById('memberLoginForm').style.display = tab === 'member' ? 'block' : 'none';
  hideError('loginError');
}

function setLoginLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.querySelector('.btn-text').style.display = loading ? 'none' : '';
  btn.querySelector('.btn-spinner').style.display = loading ? '' : 'none';
  btn.disabled = loading;
}

async function loginAdmin() {
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value;
  if (!username || !password) return showError('loginError', '⚠️ Enter username and password');
  setLoginLoading('adminLoginBtn', true);
  try {
    const data = await apiFetch('/api/auth/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    localStorage.setItem('vToken', data.token);
    localStorage.setItem('vRole', 'admin');
    localStorage.setItem('vName', data.username);
    currentUser = { token: data.token, role: 'admin', name: data.username };
    updateUI();
    showToast('Welcome back, Admin! 🎉', 'success');
    showPage('admin');
  } catch (e) {
    showError('loginError', '❌ ' + e.message);
  } finally {
    setLoginLoading('adminLoginBtn', false);
  }
}

async function loginMember() {
  const email = document.getElementById('memberEmail').value.trim();
  const password = document.getElementById('memberPass').value;
  if (!email || !password) return showError('loginError', '⚠️ Enter email and password');
  setLoginLoading('memberLoginBtn', true);
  try {
    const data = await apiFetch('/api/auth/member/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('vToken', data.token);
    localStorage.setItem('vRole', 'member');
    localStorage.setItem('vName', data.name);
    currentUser = { token: data.token, role: 'member', name: data.name };
    updateUI();
    showToast('Welcome, ' + data.name + '! 🎉', 'success');
    showPage('home');
  } catch (e) {
    showError('loginError', '❌ ' + e.message);
  } finally {
    setLoginLoading('memberLoginBtn', false);
  }
}

async function registerMember() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPass').value;
  if (!name || !email || !password) return showError('registerMsg', '⚠️ Fill all required fields');
  try {
    await apiFetch('/api/auth/member/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) });
    showError('registerMsg', '✅ Registration successful! Please wait for admin approval.', true);
    ['regName','regEmail','regPhone','regPass'].forEach(id => document.getElementById(id).value = '');
  } catch (e) { showError('registerMsg', '❌ ' + e.message); }
}

// =============================================
// EVENTS - PUBLIC
// =============================================
async function loadHomeEvents() {
  const grid = document.getElementById('homeEventsGrid');
  grid.innerHTML = '<div class="loading-spin"></div>';
  try {
    allEvents = await apiFetch('/api/events');
    const recent = allEvents.slice(0, 6);
    grid.innerHTML = recent.length ? recent.map(e => renderEventCard(e)).join('') : emptyState('No events yet.');
    // update hero stats
    document.getElementById('heroStatEvents').textContent = allEvents.length;
    loadMembersTeaser();
  } catch { grid.innerHTML = emptyState('Failed to load events.'); }
}

async function loadAllEvents() {
  const grid = document.getElementById('allEventsGrid');
  grid.innerHTML = '<div class="loading-spin"></div>';
  try {
    allEvents = await apiFetch('/api/events');
    grid.innerHTML = allEvents.length ? allEvents.map(e => renderEventCard(e)).join('') : emptyState('No events yet.');
  } catch { grid.innerHTML = emptyState('Failed to load.'); }
}

function emptyState(msg) {
  return `<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--text-light)"><div style="font-size:3rem;margin-bottom:12px">🏛️</div><p>${msg}</p></div>`;
}

function renderEventCard(e) {
  const coverUrl = e.cover_media?.file_path || (e.media?.[0]?.file_path) || null;
  const imgHtml = coverUrl
    ? `<img class="event-card-img" src="${coverUrl}" alt="${e.title_en}" loading="lazy">`
    : `<div class="event-card-img-placeholder">🏛️</div>`;
  const dateStr = new Date(e.event_date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
  const tamilInfo = e.tamil_month ? `${e.tamil_month}${e.tamil_day ? ' ' + e.tamil_day : ''}` : '';
  const isMember = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member');
  const spendHtml = (isMember && e.total_spent > 0) ? `<span class="event-card-spend">💰 ₹${Number(e.total_spent).toLocaleString('en-IN')}</span>` : '';
  
  const fbIcon = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h137.25V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.27c-30.81 0-40.42 19.12-40.42 38.73V256h68.78l-11 71.69h-57.78V480H400a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48z"></path></svg>`;

  return `
    <div class="event-card" onclick="loadEventDetail(${e.id})">
      ${imgHtml}
      <div class="event-card-social">
        <button class="event-card-social-btn" onclick="event.stopPropagation(); window.open('https://facebook.com/','_blank')" title="Facebook">${fbIcon}</button>
      </div>
      <div class="event-card-body">
        <div class="event-card-meta">
          <span class="event-card-date">📅 ${dateStr}</span>
          ${tamilInfo ? `<span class="event-card-tamil">🕉️ ${tamilInfo}</span>` : ''}
        </div>
        <div class="event-card-title">${e.title_en}</div>
        ${e.title_ta ? `<div class="event-card-title-ta">${e.title_ta}</div>` : ''}
        <div class="event-card-desc">${e.description_en || '<em style="color:rgba(255,255,255,0.4)">No description</em>'}</div>
        <div class="event-card-footer">
          <span class="event-card-view">View Details →</span>
          ${spendHtml}
        </div>
      </div>
    </div>`;
}

async function loadEventDetail(id) {
  showPage('event-detail');
  const content = document.getElementById('eventDetailContent');
  content.innerHTML = '<div class="loading-spin"></div>';
  try {
    const e = await apiFetch('/api/events/' + id);
    const canSeeFinance = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member');
    const dateStr = new Date(e.event_date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const tamilInfo = e.tamil_month ? `${e.tamil_month}${e.tamil_day ? ' ' + e.tamil_day : ''}` : '';
    const photos = e.media?.filter(m => m.file_type === 'photo') || [];
    const videos = e.media?.filter(m => m.file_type === 'video') || [];
    const mediaHtml = (e.media?.length > 0) ? `
      <h3 style="font-family:'Cinzel',serif;margin-bottom:12px;color:var(--navy)">📸 Photos & Videos</h3>
      <div class="media-gallery">
        ${photos.map(m => `<img src="${m.file_path}" loading="lazy" onclick="openLightbox('${m.file_path}','photo')">`).join('')}
        ${videos.map(m => `<video src="${m.file_path}" controls></video>`).join('')}
      </div>` : '';
    const financeHtml = canSeeFinance && e.expenses?.length > 0 ? `
      <div class="finance-section">
        <h3>💰 Event Expenses</h3>
        <table class="expense-table">
          <thead><tr><th>Item</th><th>Category</th><th>Amount</th></tr></thead>
          <tbody>${e.expenses.map(x => `<tr><td>${x.item}</td><td>${x.category||'-'}</td><td>₹${Number(x.amount).toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
        </table>
        <div class="expense-total">Total: ₹${Number(e.total_spent||0).toLocaleString('en-IN')}</div>
      </div>` : '';
    content.innerHTML = `
      <div class="event-detail">
        <div class="event-detail-header">
          <h1>${e.title_en}</h1>
          ${e.title_ta ? `<div class="ta-title">${e.title_ta}</div>` : ''}
          <div class="ev-meta">
            <span>📅 ${dateStr}</span>
            ${tamilInfo ? `<span>🕉️ ${tamilInfo}</span>` : ''}
            ${canSeeFinance && e.total_spent ? `<span>💰 ₹${Number(e.total_spent).toLocaleString('en-IN')}</span>` : ''}
          </div>
        </div>
        ${e.description_en ? `<div class="event-desc"><p>${e.description_en}</p>${e.description_ta ? `<p class="ta-desc">${e.description_ta}</p>` : ''}</div>` : ''}
        ${mediaHtml}
        ${financeHtml}
      </div>`;
  } catch { content.innerHTML = emptyState('Failed to load event.'); }
}

// =============================================
// CALENDAR
// =============================================
const TAMIL_MONTHS = ['சித்திரை','வைகாசி','ஆனி','ஆடி','ஆவணி','புரட்டாசி','ஐப்பசி','கார்த்திகை','மார்கழி','தை','மாசி','பங்குனி'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_HEADER = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getTamilMonth(month, day) {
  const offsets = [9,10,11,0,1,2,3,4,5,6,7,8];
  let tIdx = offsets[month];
  if (day < 14) tIdx = (tIdx + 11) % 12;
  return TAMIL_MONTHS[tIdx];
}
function getTamilDay(year, month, day) {
  const baseDay = 14;
  if (day >= baseDay) return day - baseDay + 1;
  const prevMonthDays = new Date(year, month, 0).getDate();
  return prevMonthDays - baseDay + day + 1;
}
function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

function renderCalendar() {
  const today = new Date();
  document.getElementById('calTitle').textContent = `${EN_MONTHS[calMonth]} ${calYear}  |  ${getTamilMonth(calMonth,1)}`;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const eventsByDate = {};
  allEvents.forEach(e => {
    const d = new Date(e.event_date);
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const day = d.getDate();
      if (!eventsByDate[day]) eventsByDate[day] = [];
      eventsByDate[day].push(e);
    }
  });
  let html = DAYS_HEADER.map(d => `<div class="cal-day-header">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getDate()===d && today.getMonth()===calMonth && today.getFullYear()===calYear;
    const hasEvent = !!eventsByDate[d];
    const tDay = getTamilDay(calYear, calMonth, d);
    const eventsHere = eventsByDate[d] || [];
    html += `
      <div class="cal-day${isToday?' today':''}${hasEvent?' has-event':''}" onclick="${hasEvent?`loadEventDetail(${eventsHere[0].id})`:''}">
        <span class="cal-en">${d}</span>
        <span class="cal-ta">${tDay}</span>
        ${hasEvent?'<div class="cal-event-dot"></div>':''}
        ${eventsHere.slice(0,1).map(e=>`<div class="cal-event-name">${e.title_en.substring(0,18)}</div>`).join('')}
      </div>`;
  }
  document.getElementById('calendarGrid').innerHTML = html;
}

// =============================================
// MEMBERS TEASER (Home)
// =============================================
async function loadMembersTeaser() {
  const grid = document.getElementById('membersTeaser');
  if (!grid) return;
  try {
    const members = await apiFetch('/api/members');
    document.getElementById('heroStatMembers').textContent = members.length;
    if (!members.length) { grid.innerHTML = '<p style="color:#888;padding:12px">No members yet.</p>'; return; }
    grid.innerHTML = members.slice(0,12).map(m => `
      <div class="member-avatar-card" onclick="showPage('members')">
        <div class="member-avatar-wrap">
          ${m.member_photo ? `<img src="${m.member_photo}" alt="${m.name}">` : `<span style="font-size:1.6rem;color:var(--gold)">👤</span>`}
        </div>
        <div class="member-avatar-name">${m.name.split(' ')[0]}</div>
      </div>`).join('');
  } catch { grid.innerHTML = ''; }
}

// =============================================
// MEMBERS PAGE - DETAILED CARDS
// =============================================
async function loadMembersPage() {
  const grid = document.getElementById('membersGrid');
  grid.innerHTML = '<div class="loading-spin"></div>';
  try {
    const members = await apiFetch('/api/members');
    if (!members.length) { grid.innerHTML = emptyState('No members yet.'); return; }
    const isMemberOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'member');
    grid.innerHTML = members.map(m => renderMemberDetailCard(m, isMemberOrAdmin)).join('');
  } catch { grid.innerHTML = emptyState('Failed to load members.'); }
}

function renderMemberDetailCard(m, showDetails) {
  const fbIcon = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h137.25V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.27c-30.81 0-40.42 19.12-40.42 38.73V256h68.78l-11 71.69h-57.78V480H400a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48z"></path></svg>`;
  
  const photoHtml = m.member_photo
    ? `<img class="member-large-photo" src="${m.member_photo}" alt="${m.name}">`
    : `<div class="member-large-placeholder">👤</div>`;
  const bioHtml = m.bio
    ? `<p class="member-bio">${m.bio}</p>`
    : `<p class="member-bio member-bio-empty">No description added yet.</p>`;
  const contactHtml = showDetails ? `
    <div class="member-contact">
      ${m.email ? `<div class="member-contact-item"><span class="member-contact-icon">📧</span>${m.email}</div>` : ''}
      ${m.phone ? `<div class="member-contact-item"><span class="member-contact-icon">📞</span>${m.phone}</div>` : ''}
    </div>` : '';
  const familyPhotos = m.family?.filter(f=>f.family_photo)?.slice(0,4) || [];
  const familyHtml = familyPhotos.length > 0 ? `
    <div class="member-card-family">
      <div class="member-family-title">Family Photos</div>
      <div class="member-family-photos">
        ${familyPhotos.map(f=>`<img class="member-family-photo" src="${f.family_photo}" title="${f.description||''}">`).join('')}
      </div>
    </div>` : '';
  return `
    <div class="member-detail-card">
      <div class="member-card-top">
        ${photoHtml}
        <div class="member-social">
          <button class="member-social-btn" onclick="event.stopPropagation(); window.open('https://facebook.com/','_blank')" title="Facebook Profile">${fbIcon}</button>
        </div>
        <div class="member-card-info">
          <div class="member-card-name">${m.name}</div>
          ${m.is_public ? '<span class="member-card-status badge-public">🌐 Public</span>' : '<span class="member-card-status badge-approved">✓ Member</span>'}
        </div>
      </div>
      <div class="member-card-body">
        ${bioHtml}
        ${contactHtml}
        ${familyHtml}
      </div>
    </div>`;
}

// =============================================
// ADMIN - DASHBOARD
// =============================================
async function loadAdminDashboard() {
  try {
    const [events, members, pending, notifs] = await Promise.all([
      apiFetch('/api/events'),
      apiFetch('/api/members/all'),
      apiFetch('/api/members/pending'),
      apiFetch('/api/members/notifications')
    ]);
    allEvents = events;
    const unread = notifs.filter(n=>!n.is_read).length;
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-num">${events.length}</div><div class="stat-label">Events</div></div>
      <div class="stat-card"><div class="stat-num">${members.filter(m=>m.status==='approved').length}</div><div class="stat-label">Members</div></div>
      <div class="stat-card"><div class="stat-num">${pending.length}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-num">${unread}</div><div class="stat-label">Notifications</div></div>
    `;
    const pc = document.getElementById('pendingCount');
    if (pc) pc.textContent = pending.length;
    document.getElementById('pendingList').innerHTML = pending.length
      ? pending.map(m => `
          <div class="admin-member-row">
            <div class="member-photo-admin-placeholder">👤</div>
            <div class="admin-row-info">
              <strong>${m.name}</strong>
              <small>${m.email} • ${new Date(m.created_at).toLocaleDateString()}</small>
            </div>
            <div class="admin-row-actions">
              <button class="btn-sm btn-sm-approve" onclick="approveMember(${m.id},'approved')">✓ Approve</button>
              <button class="btn-sm btn-sm-reject" onclick="approveMember(${m.id},'rejected')">✗ Reject</button>
            </div>
          </div>`).join('')
      : '<p style="color:#888;font-size:0.88rem;padding:8px">No pending approvals. 🎉</p>';
    document.getElementById('notifList').innerHTML = notifs.slice(0,10).map(n => `
      <div class="notif-item${n.is_read?'':' unread'}">${n.message} <small style="color:#999;float:right">${new Date(n.created_at).toLocaleDateString()}</small></div>
    `).join('') || '<p style="color:#888;font-size:0.88rem;padding:8px">No notifications.</p>';
    loadAdminEvents(events);
    loadAdminMembers(members);
    loadMemberPasswordsList(members);
  } catch (e) { console.error(e); }
}

function switchAdminTab(tab, btnEl) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.getElementById('adminTab-' + tab).classList.add('active');
}

async function approveMember(id, status) {
  try {
    await apiFetch(`/api/members/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    showToast(`Member ${status}`, status === 'approved' ? 'success' : '');
    loadAdminDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

// =============================================
// ADMIN - EVENTS
// =============================================
function loadAdminEvents(events) {
  const list = document.getElementById('adminEventsList');
  if (!events?.length) { list.innerHTML = '<p style="color:#888">No events yet. Add one!</p>'; return; }
  list.innerHTML = events.map(e => {
    const img = e.cover_media?.file_path || '';
    const dateStr = new Date(e.event_date).toLocaleDateString('en-IN');
    return `
      <div class="admin-event-row">
        ${img ? `<img class="admin-event-thumb" src="${img}" alt="">` : `<div class="admin-event-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--navy-light);color:var(--gold)">🏛️</div>`}
        <div class="admin-row-info">
          <strong>${e.title_en}</strong>
          <small>${dateStr} • ₹${Number(e.total_spent||0).toLocaleString('en-IN')} spent</small>
          ${e.description_en ? `<small style="color:var(--text-mid);margin-top:2px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">${e.description_en}</small>` : ''}
        </div>
        <div class="admin-row-actions">
          <button class="btn-sm btn-sm-edit" onclick="openEventModal(${e.id})">✏️ Edit</button>
          <button class="btn-sm btn-sm-delete" onclick="confirmDeleteEvent(${e.id},'${e.title_en.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function confirmDeleteEvent(id, title) {
  showConfirm(`Delete event "${title}"? All photos & videos will also be deleted.`, async () => {
    try {
      await apiFetch('/api/events/' + id, { method: 'DELETE' });
      allEvents = allEvents.filter(e => e.id !== id);
      showToast('Event deleted', 'success');
      loadAdminDashboard();
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function openEventModal(id) {
  editingEventId = id || null;
  document.getElementById('editEventId').value = id || '';
  document.getElementById('eventModalTitle').textContent = id ? 'Edit Event' : 'Add New Event';
  document.getElementById('expensesList').innerHTML = '';
  document.getElementById('mediaPreview').innerHTML = '';
  expenseCount = 0;
  if (id) {
    try {
      const e = await apiFetch('/api/events/' + id);
      document.getElementById('evTitleEn').value = e.title_en;
      document.getElementById('evTitleTa').value = e.title_ta || '';
      document.getElementById('evDate').value = e.event_date?.split('T')[0] || '';
      document.getElementById('evTamilMonth').value = e.tamil_month || '';
      document.getElementById('evTamilDay').value = e.tamil_day || '';
      document.getElementById('evDescEn').value = e.description_en || '';
      document.getElementById('evDescTa').value = e.description_ta || '';
      if (e.expenses?.length) e.expenses.forEach(x => addExpenseRow(x.item, x.amount, x.category));
      if (e.media?.length) {
        document.getElementById('mediaPreview').innerHTML = e.media.map(m => {
          if (m.file_type === 'video') return `<video src="${m.file_path}" controls style="height:70px;border-radius:6px;border:2px solid var(--border)"></video>`;
          return `<img src="${m.file_path}" style="height:70px;object-fit:cover;border-radius:6px;border:2px solid var(--border)">`;
        }).join('');
      }
    } catch(e) { console.error(e); }
  } else {
    ['evTitleEn','evTitleTa','evDate','evDescEn','evDescTa','evTamilDay'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('evTamilMonth').value = '';
    document.getElementById('evMedia').value = '';
  }
  document.getElementById('eventModal').style.display = 'flex';
}

function closeEventModal() { document.getElementById('eventModal').style.display = 'none'; }

function addExpenseRow(item='', amount='', category='') {
  expenseCount++;
  const id = `exp_${expenseCount}`;
  const row = document.createElement('div');
  row.className = 'expense-row'; row.id = id;
  row.innerHTML = `
    <input type="text" placeholder="Item (e.g. Camera)" value="${item}" class="exp-item">
    <input type="number" placeholder="₹ Amount" value="${amount}" class="exp-amount" min="0" style="max-width:110px">
    <input type="text" placeholder="Category" value="${category}" class="exp-cat" style="max-width:120px">
    <button onclick="document.getElementById('${id}').remove()">✕</button>`;
  document.getElementById('expensesList').appendChild(row);
}

async function saveEvent() {
  const title_en = document.getElementById('evTitleEn').value.trim();
  const event_date = document.getElementById('evDate').value;
  if (!title_en || !event_date) return showToast('Title and date are required', 'error');
  const formData = new FormData();
  formData.append('title_en', title_en);
  formData.append('title_ta', document.getElementById('evTitleTa').value.trim());
  formData.append('event_date', event_date);
  formData.append('tamil_month', document.getElementById('evTamilMonth').value);
  formData.append('tamil_day', document.getElementById('evTamilDay').value);
  formData.append('description_en', document.getElementById('evDescEn').value.trim());
  formData.append('description_ta', document.getElementById('evDescTa').value.trim());
  const files = document.getElementById('evMedia').files;
  for (let f of files) formData.append('media', f);
  const expenses = [];
  document.querySelectorAll('.expense-row').forEach(row => {
    const item = row.querySelector('.exp-item').value.trim();
    const amount = parseFloat(row.querySelector('.exp-amount').value) || 0;
    const category = row.querySelector('.exp-cat').value.trim();
    if (item) expenses.push({ item, amount, category });
  });
  formData.append('expenses', JSON.stringify(expenses));
  const id = document.getElementById('editEventId').value;
  const endpoint = id ? `/api/events/${id}` : '/api/events';
  const method = id ? 'PUT' : 'POST';
  try {
    const headers = {};
    if (currentUser?.token) headers['Authorization'] = 'Bearer ' + currentUser.token;
    const res = await fetch(API + endpoint, { method, headers, body: formData });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    closeEventModal();
    showToast(id ? 'Event updated!' : 'Event created!', 'success');
    loadAdminDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

// =============================================
// ADMIN - MEMBERS
// =============================================
function loadAdminMembers(members) {
  const list = document.getElementById('adminMembersList');
  if (!members?.length) { list.innerHTML = '<p style="color:#888">No members yet.</p>'; return; }
  list.innerHTML = members.map(m => {
    const photoHtml = m.member_photo
      ? `<img class="member-photo-admin" src="${m.member_photo}" alt="${m.name}">`
      : `<div class="member-photo-admin-placeholder">👤</div>`;
    const statusColors = { approved:'#28a745', pending:'#ffc107', rejected:'#dc3545' };
    const bioPreview = m.bio ? `<small style="color:var(--text-mid);font-style:italic;display:block;margin-top:2px">${m.bio.substring(0,50)}${m.bio.length>50?'...':''}</small>` : '';
    return `
      <div class="admin-member-row" id="amrow-${m.id}">
        ${photoHtml}
        <div class="admin-row-info">
          <strong>${m.name}</strong>
          <small style="color:${statusColors[m.status]||'#888'}">${m.status.toUpperCase()} ${m.is_public?'• 🌐 Public':''}</small>
          <small>${m.email}</small>
          ${bioPreview}
        </div>
        <div class="admin-row-actions">
          ${m.status==='pending'?`
            <button class="btn-sm btn-sm-approve" onclick="approveMember(${m.id},'approved')">✓</button>
            <button class="btn-sm btn-sm-reject" onclick="approveMember(${m.id},'rejected')">✗</button>`:''}
          <button class="btn-sm btn-sm-bio" onclick="openBioEditor(${m.id},'${m.name.replace(/'/g,"\\'")}','${(m.bio||'').replace(/'/g,"\\'").replace(/\n/g,' ')}')" title="Edit description">✍️ Bio</button>
          <button class="btn-sm btn-sm-photo" onclick="openMemberPhotoModal(${m.id},'${m.name.replace(/'/g,"\\'")}')">📷</button>
          <button class="btn-sm btn-sm-edit" onclick="toggleMemberPublic(${m.id})">${m.is_public?'🔒':'🌐'}</button>
          <button class="btn-sm btn-sm-delete" onclick="confirmRemoveMember(${m.id},'${m.name.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ======= MEMBER BIO EDITOR =======
function openBioEditor(id, name, currentBio) {
  const decoded = decodeURIComponent(currentBio||'');
  const html = `
    <div style="padding:18px">
      <h4 style="color:var(--navy);font-family:'Cinzel',serif;margin-bottom:10px">✍️ Bio for ${name}</h4>
      <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:10px">Write a short description about this member. This will appear on their public profile card.</p>
      <textarea id="bioTextarea_${id}" rows="4" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9rem;resize:vertical;font-family:'Inter',sans-serif">${decoded}</textarea>
      <div style="display:flex;gap:10px;margin-top:12px;justify-content:flex-end">
        <button class="btn-secondary" onclick="closeBioEditor()">Cancel</button>
        <button class="btn-primary-inline" onclick="saveBio(${id})">Save Bio</button>
      </div>
    </div>`;
  showInlineModal('Edit Member Bio', html);
}

function showInlineModal(title, bodyHtml) {
  let m = document.getElementById('inlineModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'inlineModal';
    m.className = 'modal';
    m.innerHTML = `<div class="modal-box modal-small"><div class="modal-header"><h2 id="inlineModalTitle"></h2><button onclick="closeBioEditor()">✕</button></div><div id="inlineModalBody"></div></div>`;
    m.onclick = e => { if(e.target===m) closeBioEditor(); };
    document.body.appendChild(m);
  }
  document.getElementById('inlineModalTitle').textContent = title;
  document.getElementById('inlineModalBody').innerHTML = bodyHtml;
  m.style.display = 'flex';
}

function closeBioEditor() {
  const m = document.getElementById('inlineModal');
  if (m) m.style.display = 'none';
}

async function saveBio(id) {
  const ta = document.getElementById('bioTextarea_' + id);
  if (!ta) return;
  const bio = ta.value.trim();
  try {
    await apiFetch(`/api/members/${id}/bio`, { method: 'PATCH', body: JSON.stringify({ bio }) });
    closeBioEditor();
    showToast('Bio updated!', 'success');
    loadAdminDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleMemberPublic(id) {
  try {
    await apiFetch('/api/members/' + id + '/toggle-public', { method: 'POST' });
    showToast('Visibility updated', 'success');
    loadAdminDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

function confirmRemoveMember(id, name) {
  showConfirm(`Remove member "${name}"? This cannot be undone.`, async () => {
    try {
      await apiFetch(`/api/members/${id}?confirmed=true`, { method: 'DELETE' });
      showToast('Member removed', 'success');
      loadAdminDashboard();
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function openMemberPhotoModal(id, name) {
  document.getElementById('memberPhotoModalTitle').textContent = `📷 ${name}`;
  const body = document.getElementById('memberPhotoModalBody');
  body.innerHTML = '<div class="loading-spin"></div>';
  document.getElementById('memberPhotoModal').style.display = 'flex';
  try {
    const allMembers = await apiFetch('/api/members/all');
    const member = allMembers.find(m => m.id === id);
    const membersPublic = await apiFetch('/api/members');
    const families = membersPublic.find(m=>m.id===id)?.family || [];
    body.innerHTML = `
      <div style="margin-bottom:16px">
        <h4 style="margin-bottom:8px;color:var(--navy);font-family:'Cinzel',serif">Member Photo</h4>
        ${member?.member_photo ? `<img src="${member.member_photo}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);margin-bottom:8px">` : '<p style="color:#888;font-size:0.85rem">No photo yet</p>'}
        <div class="input-group" style="margin-top:10px">
          <span class="input-icon">📸</span>
          <input type="file" id="memberPhotoInput_${id}" accept="image/*" style="flex:1;border:none;padding:8px 0;font-size:0.85rem;outline:none">
        </div>
        <button class="btn-sm btn-sm-photo" style="margin-top:8px" onclick="uploadMemberPhoto(${id})">Upload Photo</button>
      </div>
      <hr style="border-color:var(--border);margin:14px 0">
      <div>
        <h4 style="margin-bottom:8px;color:var(--navy);font-family:'Cinzel',serif">Family Photos</h4>
        <div id="familyPhotosWrap_${id}">
          ${families.length ? families.map(f=>`
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px;background:#f9f9f9;border-radius:8px">
              ${f.family_photo?`<img src="${f.family_photo}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:2px solid var(--gold)">` : '<span style="font-size:1.5rem">🏠</span>'}
              <span style="font-size:0.85rem;flex:1">${f.description||'Family photo'}</span>
              <button class="btn-sm btn-sm-delete" onclick="deleteFamilyPhoto(${id},${f.id})">🗑️</button>
            </div>`).join('') : '<p style="color:#888;font-size:0.85rem">No family photos yet</p>'}
        </div>
        <div style="margin-top:12px">
          <div class="input-group">
            <span class="input-icon">📸</span>
            <input type="file" id="familyPhotoInput_${id}" accept="image/*" style="flex:1;border:none;padding:8px 0;font-size:0.85rem;outline:none">
          </div>
          <input type="text" id="familyPhotoDesc_${id}" placeholder="Description (optional)" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:7px;margin-top:8px;font-size:0.85rem">
          <button class="btn-sm btn-sm-photo" style="margin-top:8px" onclick="uploadFamilyPhoto(${id})">Add Family Photo</button>
        </div>
      </div>`;
  } catch(e) { body.innerHTML = `<p style="color:#888;padding:16px">${e.message}</p>`; }
}

function closeMemberPhotoModal() {
  document.getElementById('memberPhotoModal').style.display = 'none';
  loadAdminDashboard();
}

async function uploadMemberPhoto(id) {
  const file = document.getElementById('memberPhotoInput_' + id)?.files[0];
  if (!file) return showToast('Select a photo first', 'error');
  const fd = new FormData(); fd.append('photo', file);
  try {
    const headers = {};
    if (currentUser?.token) headers['Authorization'] = 'Bearer ' + currentUser.token;
    const res = await fetch(`/api/members/${id}/photo`, { method:'POST', headers, body:fd });
    if (!res.ok) throw new Error('Upload failed');
    showToast('Photo uploaded!', 'success');
    openMemberPhotoModal(id, document.getElementById('memberPhotoModalTitle').textContent.replace('📷 ',''));
  } catch(e) { showToast(e.message, 'error'); }
}

async function uploadFamilyPhoto(id) {
  const file = document.getElementById('familyPhotoInput_' + id)?.files[0];
  const desc = document.getElementById('familyPhotoDesc_' + id)?.value || '';
  const fd = new FormData();
  if (file) fd.append('photo', file);
  fd.append('description', desc);
  try {
    const headers = {};
    if (currentUser?.token) headers['Authorization'] = 'Bearer ' + currentUser.token;
    const res = await fetch(`/api/members/${id}/family-photo`, { method:'POST', headers, body:fd });
    if (!res.ok) throw new Error('Upload failed');
    showToast('Family photo added!', 'success');
    openMemberPhotoModal(id, document.getElementById('memberPhotoModalTitle').textContent.replace('📷 ',''));
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteFamilyPhoto(memberId, fid) {
  if (!confirm('Delete this family photo?')) return;
  try {
    await apiFetch(`/api/members/${memberId}/family-photo/${fid}`, { method:'DELETE' });
    showToast('Deleted', 'success');
    openMemberPhotoModal(memberId, document.getElementById('memberPhotoModalTitle').textContent.replace('📷 ',''));
  } catch(e) { showToast(e.message, 'error'); }
}

// =============================================
// ADMIN - SETTINGS
// =============================================
async function changeAdminPassword() {
  const currentPassword = document.getElementById('settingCurrPass').value;
  const newPassword = document.getElementById('settingNewPass').value;
  if (!currentPassword || !newPassword) return showError('settingMsg', 'Fill both fields');
  try {
    await apiFetch('/api/auth/admin/change-password', { method:'POST', body:JSON.stringify({ currentPassword, newPassword }) });
    showError('settingMsg', '✅ Password updated!', true);
    document.getElementById('settingCurrPass').value = '';
    document.getElementById('settingNewPass').value = '';
  } catch(e) { showError('settingMsg', e.message); }
}

async function loadMemberPasswordsList(members) {
  const list = document.getElementById('memberPasswordsList');
  if (!members?.length) { list.innerHTML = '<p style="color:#888">No members.</p>'; return; }
  list.innerHTML = `
    <table class="pass-table">
      <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
        ${members.map(m=>`
          <tr>
            <td>${m.name}</td>
            <td>${m.email}</td>
            <td>${m.status}</td>
            <td><button class="btn-sm btn-sm-edit" onclick="openResetPass(${m.id},'${m.name.replace(/'/g,"\\'")}')">Reset Password</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function openResetPass(id, name) {
  resetPassMemberId = id;
  document.getElementById('resetPassName').textContent = `Reset password for: ${name}`;
  document.getElementById('resetPassInput').value = '';
  document.getElementById('resetPassModal').style.display = 'flex';
}

async function doResetPass() {
  const newPassword = document.getElementById('resetPassInput').value;
  if (!newPassword) return showToast('Enter new password', 'error');
  try {
    await apiFetch(`/api/auth/admin/members/${resetPassMemberId}/reset-password`, { method:'POST', body:JSON.stringify({ newPassword }) });
    document.getElementById('resetPassModal').style.display = 'none';
    showToast('Password reset successfully!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// =============================================
// LIGHTBOX
// =============================================
function openLightbox(src, type) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.innerHTML = `<button class="lightbox-close" onclick="closeLightbox()">✕</button><div id="lbContent"></div>`;
    lb.onclick = e => { if(e.target===lb) closeLightbox(); };
    document.body.appendChild(lb);
  }
  const content = document.getElementById('lbContent');
  content.innerHTML = type==='video'
    ? `<video src="${src}" controls autoplay style="max-width:94vw;max-height:90vh;border-radius:8px"></video>`
    : `<img src="${src}" style="max-width:94vw;max-height:90vh;border-radius:8px;object-fit:contain">`;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) { lb.classList.remove('open'); document.body.style.overflow = ''; }
}

// =============================================
// CONFIRM MODAL
// =============================================
function showConfirm(msg, cb) {
  confirmCallback = cb;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmBtn').onclick = () => { closeConfirm(); if(confirmCallback) confirmCallback(); };
  document.getElementById('confirmModal').style.display = 'flex';
}
function closeConfirm() { document.getElementById('confirmModal').style.display = 'none'; confirmCallback = null; }

// =============================================
// HELPERS
// =============================================
function showError(id, msg, isSuccess=false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'error-msg' + (isSuccess ? ' success' : '');
  el.style.display = 'block';
}
function hideError(id) { const el = document.getElementById(id); if(el) el.style.display = 'none'; }

// Media preview for event form
document.addEventListener('change', e => {
  if (e.target.id === 'evMedia') {
    const preview = document.getElementById('mediaPreview');
    preview.innerHTML = '';
    Array.from(e.target.files).slice(0,12).forEach(file => {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('video')) {
        const v = document.createElement('video');
        v.src = url; v.controls = true;
        v.style.cssText = 'height:70px;border-radius:6px;border:2px solid var(--border)';
        preview.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'height:70px;object-fit:cover;border-radius:6px;border:2px solid var(--border)';
        preview.appendChild(img);
      }
    });
  }
});
