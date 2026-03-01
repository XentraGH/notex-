import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NoteX - Simple Note Taker",
  description: "Your simple note taker. Create, edit, lock, export, and share notes with ease.",
  keywords: ["NoteX", "notes", "note-taking", "productivity", "simple"],
  authors: [{ name: "NoteX Team" }],
  icons: {
    icon: "/notex-icon.png",
  },
  themeColor: "#7c3aed",
  openGraph: {
    title: "NoteX - Simple Note Taker",
    description: "Your simple note taker",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                
                // ============================================
                // STORAGE KEYS
                // ============================================
                var STORAGE_KEYS = {
                  NOTES: 'notex_offline_notes',
                  ONLINE_NOTES: 'notex_online_notes',
                  USER: 'notex_offline_user',
                  SYNC_QUEUE: 'notex_sync_queue'
                };
                
                var FONT_STACK = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                
                // ============================================
                // STATE
                // ============================================
                var offlineOverlay = null;
                var offlineIndicator = null;
                var isShowingRelaunch = false;
                
                // ============================================
                // STORAGE HELPERS
                // ============================================
                function saveToStorage(key, data) {
                  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
                  catch (e) { return false; }
                }
                
                function loadFromStorage(key) {
                  try { var data = localStorage.getItem(key); return data ? JSON.parse(data) : null; }
                  catch (e) { return null; }
                }
                
                function removeFromStorage(key) {
                  try { localStorage.removeItem(key); return true; }
                  catch (e) { return false; }
                }
                
                // ============================================
                // CHECK CACHED DATA
                // ============================================
                function hasCachedUserData() {
                  var user = loadFromStorage(STORAGE_KEYS.USER);
                  return user && user.username;
                }
                
                // ============================================
                // OFFLINE OVERLAY (only when NO cached data)
                // ============================================
                function showOfflineOverlay() {
                  if (offlineOverlay) return;
                  isShowingRelaunch = false;
                  
                  var style = document.createElement('style');
                  style.id = 'notex-offline-styles';
                  style.textContent = '@keyframes notex-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes notex-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } } @keyframes notex-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }';
                  document.head.appendChild(style);
                  
                  offlineOverlay = document.createElement('div');
                  offlineOverlay.id = 'notex-offline-overlay';
                  offlineOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 50%,#fcd34d 100%);font-family:' + FONT_STACK + ';text-align:center;color:#92400e;flex-direction:column;z-index:2147483647;overflow:hidden;';
                  
                  offlineOverlay.innerHTML = 
                    '<div id="notex-icon-container" style="width:160px;height:160px;border-radius:50%;background:linear-gradient(145deg,#ffffff,#fef3c7);display:flex;align-items:center;justify-content:center;margin-bottom:40px;box-shadow:0 20px 60px rgba(251,191,36,0.4),0 0 0 12px rgba(255,255,255,0.8);animation:notex-bounce 2s ease-in-out infinite;">' +
                      '<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                        '<line x1="1" y1="1" x2="23" y2="23"></line>' +
                        '<path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>' +
                        '<path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>' +
                        '<path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>' +
                        '<path d="M1.42 9a16 16 0 0 1 4.37-4.23"></path>' +
                      '</svg>' +
                    '</div>' +
                    '<h1 id="notex-offline-title" style="margin:0;font-size:42px;font-weight:800;color:#78350f;letter-spacing:-0.02em;">No Internet Connection!</h1>' +
                    '<p id="notex-offline-desc" style="margin:16px 0 0 0;font-size:18px;color:#92400e;max-width:400px;line-height:1.6;padding:0 20px;">Your device is not connected to the internet. Please, check your internet connection.</p>' +
                    '<div id="notex-spinner-container" style="margin-top:36px;display:flex;align-items:center;justify-content:center;gap:12px;color:#b45309;padding:12px 24px;background:rgba(255,255,255,0.6);border-radius:50px;">' +
                      '<div style="width:20px;height:20px;border:3px solid #f59e0b;border-top-color:transparent;border-radius:50%;animation:notex-spin 1s linear infinite;"></div>' +
                      '<span style="font-size:15px;font-weight:600;">Waiting for connection...</span>' +
                    '</div>';
                  
                  document.body.appendChild(offlineOverlay);
                }
                
                function showRelaunchMessage() {
                  if (isShowingRelaunch) return;
                  isShowingRelaunch = true;
                  
                  var iconContainer = document.getElementById('notex-icon-container');
                  if (iconContainer) {
                    iconContainer.style.background = 'linear-gradient(145deg, #d1fae5, #a7f3d0)';
                    iconContainer.style.boxShadow = '0 20px 60px rgba(16, 185, 129, 0.4), 0 0 0 12px rgba(255, 255, 255, 0.8)';
                    iconContainer.style.animation = 'notex-pulse 1.5s ease-in-out infinite';
                    iconContainer.innerHTML = '<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>';
                  }
                  
                  var title = document.getElementById('notex-offline-title');
                  if (title) { title.textContent = 'Connection Restored!'; title.style.color = '#065f46'; }
                  
                  var desc = document.getElementById('notex-offline-desc');
                  if (desc) { desc.textContent = 'Your internet connection is back. Please relaunch NoteX to continue.'; desc.style.color = '#047857'; }
                  
                  var spinner = document.getElementById('notex-spinner-container');
                  if (spinner) {
                    spinner.style.background = 'rgba(16, 185, 129, 0.15)';
                    spinner.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg><span style="font-size:15px;font-weight:600;color:#047857;">Please relaunch the app</span>';
                  }
                  
                  if (offlineOverlay) { offlineOverlay.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)'; }
                }
                
                // ============================================
                // OFFLINE INDICATOR (when cached data exists)
                // ============================================
                function showOfflineIndicator() {
                  if (document.getElementById('notex-offline-indicator')) return;
                  
                  offlineIndicator = document.createElement('div');
                  offlineIndicator.id = 'notex-offline-indicator';
                  offlineIndicator.style.cssText = 'position:fixed;bottom:20px;left:20px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:10px 20px;border-radius:12px;font-family:' + FONT_STACK + ';font-size:14px;font-weight:600;display:flex;align-items:center;gap:10px;z-index:9999;box-shadow:0 4px 12px rgba(245,158,11,0.4);';
                  offlineIndicator.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a16 16 0 0 1 4.37-4.23"></path></svg> Offline Mode';
                  document.body.appendChild(offlineIndicator);
                }
                
                function hideOfflineIndicator() {
                  var indicator = document.getElementById('notex-offline-indicator');
                  if (indicator) indicator.remove();
                }
                
                // ============================================
                // OFFLINE POPUP
                // ============================================
                function showOfflinePopup(message) {
                  var existingPopup = document.getElementById('notex-offline-popup');
                  if (existingPopup) existingPopup.remove();
                  var existingBackdrop = document.getElementById('notex-popup-backdrop');
                  if (existingBackdrop) existingBackdrop.remove();
                  
                  var popup = document.createElement('div');
                  popup.id = 'notex-offline-popup';
                  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:white;border-radius:16px;padding:32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);z-index:99999;max-width:400px;text-align:center;font-family:' + FONT_STACK + ';';
                  
                  popup.innerHTML = 
                    '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(145deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 4px 12px rgba(251,191,36,0.3);">' +
                      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a16 16 0 0 1 4.37-4.23"></path></svg>' +
                    '</div>' +
                    '<h3 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#78350f;">Offline Feature</h3>' +
                    '<p style="margin:0 0 24px 0;font-size:15px;color:#92400e;line-height:1.5;">' + (message || 'This feature requires an internet connection.') + '</p>' +
                    '<button id="notex-popup-close" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Got it</button>';
                  
                  var backdrop = document.createElement('div');
                  backdrop.id = 'notex-popup-backdrop';
                  backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:99998;';
                  
                  document.body.appendChild(backdrop);
                  document.body.appendChild(popup);
                  
                  document.getElementById('notex-popup-close').onclick = function() { popup.remove(); backdrop.remove(); };
                  backdrop.onclick = function() { popup.remove(); backdrop.remove(); };
                }
                
                // ============================================
                // NOTES MANAGEMENT
                // ============================================
                function mergeNotes() {
                  var onlineNotes = loadFromStorage(STORAGE_KEYS.ONLINE_NOTES) || [];
                  var offlineNotes = loadFromStorage(STORAGE_KEYS.NOTES) || [];
                  var notesMap = {};
                  onlineNotes.forEach(function(note) { notesMap[note.id] = note; });
                  offlineNotes.forEach(function(note) { notesMap[note.id] = note; });
                  var mergedNotes = Object.values(notesMap);
                  mergedNotes.sort(function(a, b) { return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt); });
                  return mergedNotes;
                }
                
                function saveNoteOffline(note) {
                  var notes = loadFromStorage(STORAGE_KEYS.NOTES) || [];
                  var existingIndex = notes.findIndex(function(n) { return n.id === note.id; });
                  if (existingIndex >= 0) { notes[existingIndex] = note; }
                  else { notes.unshift(note); }
                  saveToStorage(STORAGE_KEYS.NOTES, notes);
                }
                
                function deleteNoteOffline(noteId) {
                  var notes = loadFromStorage(STORAGE_KEYS.NOTES) || [];
                  notes = notes.filter(function(n) { return n.id !== noteId; });
                  saveToStorage(STORAGE_KEYS.NOTES, notes);
                }
                
                // ============================================
                // SYNC QUEUE
                // ============================================
                function addToSyncQueue(action, data) {
                  var queue = loadFromStorage(STORAGE_KEYS.SYNC_QUEUE) || [];
                  queue.push({ action: action, data: data, timestamp: Date.now() });
                  saveToStorage(STORAGE_KEYS.SYNC_QUEUE, queue);
                }
                
                function syncOfflineChanges() {
                  var queue = loadFromStorage(STORAGE_KEYS.SYNC_QUEUE) || [];
                  if (queue.length === 0) return;
                  console.log('NoteX: Syncing', queue.length, 'offline changes');
                  
                  queue.forEach(function(item) {
                    if (item.action === 'create') {
                      var noteData = Object.assign({}, item.data);
                      if (noteData.id && noteData.id.toString().startsWith('offline-')) delete noteData.id;
                      delete noteData.offline;
                      fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noteData) }).catch(function() {});
                    } else if (item.action === 'update') {
                      fetch('/api/notes/' + item.data.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.data.data) }).catch(function() {});
                    } else if (item.action === 'delete') {
                      fetch('/api/notes/' + item.data.id, { method: 'DELETE' }).catch(function() {});
                    }
                  });
                  
                  removeFromStorage(STORAGE_KEYS.SYNC_QUEUE);
                  removeFromStorage(STORAGE_KEYS.NOTES);
                }
                
                // ============================================
                // INTERCEPT FETCH
                // ============================================
                var originalFetch = window.fetch;
                
                window.fetch = function(url, options) {
                  var urlStr = typeof url === 'string' ? url : url.url;
                  var method = options ? options.method : 'GET';
                  
                  // OFFLINE MODE
                  if (!navigator.onLine) {
                    // GET notes - return cached
                    if (method === 'GET' && urlStr.includes('/api/notes?authorId=')) {
                      return Promise.resolve(new Response(JSON.stringify({ notes: mergeNotes(), offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    
                    // POST - create note locally
                    if (method === 'POST' && urlStr.includes('/api/notes')) {
                      try {
                        var body = JSON.parse(options.body);
                        var newNote = {
                          id: 'offline-' + Date.now(),
                          title: body.title || 'Untitled Note',
                          content: body.content || '',
                          isLocked: false,
                          password: null,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          authorId: body.authorId || (loadFromStorage(STORAGE_KEYS.USER)?.id) || 'offline-user',
                          offline: true
                        };
                        saveNoteOffline(newNote);
                        addToSyncQueue('create', newNote);
                        return Promise.resolve(new Response(JSON.stringify({ note: newNote, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                      } catch (e) {
                        return Promise.resolve(new Response(JSON.stringify({ error: 'Failed to create note offline' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
                      }
                    }
                    
                    // PUT - update note locally
                    if (method === 'PUT' && urlStr.includes('/api/notes')) {
                      try {
                        var noteId = urlStr.split('/api/notes/')[1]?.split('/')[0];
                        var updateData = JSON.parse(options.body);
                        var notes = mergeNotes();
                        var updatedNote = null;
                        for (var i = 0; i < notes.length; i++) {
                          if (notes[i].id === noteId || notes[i].id === noteId.toString()) {
                            notes[i] = Object.assign({}, notes[i], updateData, { updatedAt: new Date().toISOString(), offline: true });
                            updatedNote = notes[i];
                            break;
                          }
                        }
                        if (updatedNote) { saveNoteOffline(updatedNote); addToSyncQueue('update', { id: noteId, data: updateData }); }
                        return Promise.resolve(new Response(JSON.stringify({ note: updatedNote, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                      } catch (e) {
                        return Promise.resolve(new Response(JSON.stringify({ error: 'Failed to update note offline' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
                      }
                    }
                    
                    // DELETE - remove note locally
                    if (method === 'DELETE' && urlStr.includes('/api/notes')) {
                      var delNoteId = urlStr.split('/api/notes/')[1]?.split('/')[0];
                      deleteNoteOffline(delNoteId);
                      addToSyncQueue('delete', { id: delNoteId });
                      return Promise.resolve(new Response(JSON.stringify({ success: true, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    
                    // Share - show popup
                    if (urlStr.includes('/share')) {
                      showOfflinePopup('Sharing notes requires an internet connection.');
                      return Promise.resolve(new Response(JSON.stringify({ error: 'Offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
                    }
                    
                    // Auth me - return cached user
                    if (urlStr.includes('/api/auth/me')) {
                      var user = loadFromStorage(STORAGE_KEYS.USER);
                      if (user) return Promise.resolve(new Response(JSON.stringify({ user: user, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                      return Promise.resolve(new Response(JSON.stringify({ error: 'Not authenticated', offline: true }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
                    }
                    
                    // User settings
                    if (urlStr.includes('/api/user/settings') && method === 'PUT') {
                      try {
                        var settings = JSON.parse(options.body);
                        var currentUser = loadFromStorage(STORAGE_KEYS.USER) || {};
                        var updatedUser = Object.assign({}, currentUser, settings);
                        saveToStorage(STORAGE_KEYS.USER, updatedUser);
                        return Promise.resolve(new Response(JSON.stringify({ user: updatedUser, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                      } catch (e) {}
                    }
                    
                    return Promise.resolve(new Response(JSON.stringify({ error: 'Offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
                  }
                  
                  // ONLINE MODE - cache results
                  return originalFetch.apply(this, arguments).then(function(response) {
                    var clonedResponse = response.clone();
                    
                    // Cache notes
                    if (urlStr.includes('/api/notes?authorId=') && response.ok) {
                      clonedResponse.json().then(function(data) {
                        if (data.notes) { saveToStorage(STORAGE_KEYS.ONLINE_NOTES, data.notes); console.log('NoteX: Cached', data.notes.length, 'notes'); }
                      }).catch(function() {});
                    }
                    
                    // Cache user on login
                    if (urlStr.includes('/api/auth/login') && response.ok) {
                      clonedResponse.json().then(function(data) {
                        if (data.user) { saveToStorage(STORAGE_KEYS.USER, data.user); console.log('NoteX: Cached user data'); }
                      }).catch(function() {});
                    }
                    
                    // Cache user on signup
                    if (urlStr.includes('/api/auth/signup') && response.ok) {
                      clonedResponse.json().then(function(data) {
                        if (data.user) { saveToStorage(STORAGE_KEYS.USER, data.user); console.log('NoteX: Cached user data'); }
                      }).catch(function() {});
                    }
                    
                    // Cache user on me check
                    if (urlStr.includes('/api/auth/me') && response.ok) {
                      clonedResponse.json().then(function(data) {
                        if (data.user) { saveToStorage(STORAGE_KEYS.USER, data.user); }
                      }).catch(function() {});
                    }
                    
                    // Save note on create/update
                    if (urlStr.includes('/api/notes') && options && options.method && (options.method === 'POST' || options.method === 'PUT') && response.ok) {
                      clonedResponse.json().then(function(data) {
                        if (data.note) { saveNoteOffline(data.note); }
                      }).catch(function() {});
                    }
                    
                    return response;
                  });
                };
                
                // ============================================
                // INTERCEPT CLICKS FOR SHARE BUTTONS
                // ============================================
                document.addEventListener('click', function(e) {
                  if (!navigator.onLine) {
                    var target = e.target;
                    while (target && target !== document) {
                      if (target.classList && (target.classList.contains('share-btn') || target.closest('.share-btn') || target.closest('[data-share]'))) {
                        e.preventDefault();
                        e.stopPropagation();
                        showOfflinePopup('Sharing notes requires an internet connection. Your note is saved locally and can be shared when you\\'re back online.');
                        return false;
                      }
                      target = target.parentElement;
                    }
                  }
                }, true);
                
                // ============================================
                // INITIALIZATION
                // ============================================
                if (!navigator.onLine) {
                  if (!hasCachedUserData()) {
                    // No cached data - show full overlay
                    showOfflineOverlay();
                  } else {
                    // Has cached data - show indicator and let app work
                    showOfflineIndicator();
                    console.log('NoteX: Working offline with cached data');
                  }
                }
                
                window.addEventListener('online', function() {
                  console.log('NoteX: Connection restored');
                  hideOfflineIndicator();
                  syncOfflineChanges();
                  if (offlineOverlay) showRelaunchMessage();
                });
                
                window.addEventListener('offline', function() {
                  console.log('NoteX: Connection lost');
                  isShowingRelaunch = false;
                  if (hasCachedUserData()) {
                    showOfflineIndicator();
                  } else {
                    showOfflineOverlay();
                  }
                });
                
                console.log('NoteX Offline: Initialized');
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${dmSans.variable} font-sans antialiased bg-[#f8fafc] text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
