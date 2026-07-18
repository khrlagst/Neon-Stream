// UI helpers moved from inline app script. Uses window state objects.
export function escapeHTML(s){
    return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function showToast(msg){
    console.log('[toast]', msg);
}

export function initTooltips(){
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'custom-tooltip';
    document.body.appendChild(tooltipEl);

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            tooltipEl.innerText = target.getAttribute('data-tooltip');
            tooltipEl.classList.add('visible');
            const rect = target.getBoundingClientRect();
            let top = rect.top - tooltipEl.offsetHeight - 8;
            let left = rect.left + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
            if (top < 10) top = rect.bottom + 8;
            if (left < 10) left = 10;
            if (left + tooltipEl.offsetWidth > window.innerWidth - 10) left = window.innerWidth - tooltipEl.offsetWidth - 10;
            tooltipEl.style.top = top + 'px';
            tooltipEl.style.left = left + 'px';
        }
    });

    document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tooltip]')) tooltipEl.classList.remove('visible'); });
    document.addEventListener('click', (e) => { if (e.target.closest('[data-tooltip]')) tooltipEl.classList.remove('visible'); });
}

export function initContextMenu(){
    const cm = document.getElementById('context-menu');
    if (!cm) return;
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        let targetEl = e.target.closest('[data-type]');
        if (targetEl && targetEl.dataset.type) {
            let type = targetEl.dataset.type;
            let path = targetEl.dataset.path;
            const name = targetEl.dataset.name;
            if (type === 'nowplaying') {
                if (window.currentTrackIndex >= 0 && window.currentQueue[window.currentTrackIndex]) {
                    type = 'track';
                    path = window.currentQueue[window.currentTrackIndex].path;
                } else { cm.classList.add('select-hide'); return; }
            }
            renderContextMenu(type, path, name);
            let x = e.clientX, y = e.clientY;
            cm.classList.remove('select-hide');
            if (x + cm.offsetWidth > window.innerWidth) x = window.innerWidth - cm.offsetWidth - 10;
            if (y + cm.offsetHeight > window.innerHeight) y = window.innerHeight - cm.offsetHeight - 10;
            cm.style.left = x + 'px'; cm.style.top = y + 'px';
        } else cm.classList.add('select-hide');
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#context-menu')) cm.classList.add('select-hide'); });
}

export function renderContextMenu(type, path, name){
    const cm = document.getElementById('context-menu');
    cm.innerHTML = '';
    const frag = document.createDocumentFragment();
    function addItem(text, iconStr, onClick){
        const div = document.createElement('div');
        div.className = 'context-menu-item';
        div.innerHTML = `${iconStr} ${text}`;
        div.onclick = (e) => { onClick(e); cm.classList.add('select-hide'); };
        frag.appendChild(div);
    }
    const iconDetails = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    const iconAlbum = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>';
    const iconArtist = '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    const iconPlaylist = '<svg viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>';
    const iconQueue = '<svg viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>';
    const iconPlay = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

    if (type === 'track'){
        const track = window.allTracks.find(t => t.path === path);
        addItem('View Details', iconDetails, () => showTrackDetails(path));
        if (track && track.album) addItem('Go to Album', iconAlbum, () => window.switchView && window.switchView('album_detail', track.album));
        if (track && track.artist) addItem('Go to Artist', iconArtist, () => window.switchView && window.switchView('artist_detail', track.artist));
        addItem('Add to Playlist', iconPlaylist, () => window.openAddToPlaylistModal && window.openAddToPlaylistModal(path));
        addItem('Add to Queue', iconQueue, () => window.addToQueue && window.addToQueue(path));
    } else if (type === 'album'){
        const trks = window.allTracks.filter(t => t.album === name);
        addItem('Play Album', iconPlay, () => window.playList && window.playList(trks));
        addItem('Add Album to Queue', iconQueue, () => window.addListToQueue && window.addListToQueue(trks));
        addItem('Add Album to Playlist', iconPlaylist, () => window.openAddToPlaylistModal && window.openAddToPlaylistModal(trks));
    } else if (type === 'artist'){
        const trks = window.allTracks.filter(t => t.artist === name);
        addItem('Play Artist', iconPlay, () => window.playList && window.playList(trks));
        addItem('Add Artist to Queue', iconQueue, () => window.addListToQueue && window.addListToQueue(trks));
        addItem('Add Artist to Playlist', iconPlaylist, () => window.openAddToPlaylistModal && window.openAddToPlaylistModal(trks));
    } else if (type === 'genre'){
        const trks = window.allTracks.filter(t => t.genre === name);
        addItem('Play Genre', iconPlay, () => window.playList && window.playList(trks));
        addItem('Add Genre to Queue', iconQueue, () => window.addListToQueue && window.addListToQueue(trks));
        addItem('Add Genre to Playlist', iconPlaylist, () => window.openAddToPlaylistModal && window.openAddToPlaylistModal(trks));
    }
    cm.appendChild(frag);
}

export function showTrackDetails(path){
    const track = window.allTracks.find(t => t.path === path);
    if (!track) return;
    document.getElementById('td-title').innerText = track.title || '';
    document.getElementById('td-artist').innerText = track.artist || '';
    document.getElementById('td-album').innerText = track.album || '';
    document.getElementById('td-genre').innerText = track.genre || '';
    document.getElementById('td-file').innerText = track.filename || '';
    document.getElementById('td-path').innerText = track.path || '';
    const artEl = document.getElementById('td-art');
    if (track.pictureUrl) { artEl.style.backgroundImage = `url(${track.pictureUrl})`; artEl.innerHTML = ''; }
    else { artEl.style.backgroundImage = 'none'; artEl.innerHTML = '<svg viewBox="0 0 24 24" style="width:60%; height:60%; fill:rgba(255,255,255,0.2)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'; }
    document.getElementById('track-details-modal').classList.add('active');
}

export function initSearch(){
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    if(!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) { searchResults.classList.add('select-hide'); return; }
        const terms = query.split(/\s+/);
        const matchedTracks = window.allTracks.filter(track => {
            const searchable = `${track.title} ${track.artist} ${track.album}`.toLowerCase();
            return terms.every(term => searchable.includes(term));
        }).slice(0,15);
        const uniqueAlbums = [...new Set(window.allTracks.map(t => t.album))];
        const matchedAlbums = uniqueAlbums.filter(a => terms.every(term => a && a.toLowerCase().includes(term))).slice(0,5);
        const uniqueArtists = [...new Set(window.allTracks.map(t => t.artist))];
        const matchedArtists = uniqueArtists.filter(a => terms.every(term => a && a.toLowerCase().includes(term))).slice(0,5);
        renderSearchResults(matchedTracks, matchedAlbums, matchedArtists, query);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-container')) searchResults.classList.add('select-hide'); });
    searchInput.addEventListener('focus', () => { if (searchInput.value.trim() && searchResults.children.length > 0) searchResults.classList.remove('select-hide'); });
}

export function renderSearchResults(tracks, albums, artists, query){
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';
    if (tracks.length === 0 && albums.length === 0 && artists.length === 0) {
        searchResults.innerHTML = `<div class="sr-empty">No results found for "${escapeHTML(query)}"</div>`;
    } else {
        const frag = document.createDocumentFragment();
        if (artists.length > 0) {
            const sec = document.createElement('div'); sec.className = 'sr-section-title'; sec.innerText = 'Artists'; frag.appendChild(sec);
            artists.forEach(artist => {
                const item = document.createElement('div'); item.className = 'search-result-item'; item.dataset.type='artist'; item.dataset.name=artist;
                item.onclick = () => { window.switchView && window.switchView('artist_detail', artist); searchResults.classList.add('select-hide'); document.getElementById('search-input').value=''; };
                item.innerHTML = `<div class="sr-title">${escapeHTML(artist)}</div><div class="sr-meta">Artist</div>`;
                frag.appendChild(item);
            });
        }
        if (albums.length > 0) {
            const sec = document.createElement('div'); sec.className = 'sr-section-title'; sec.innerText = 'Albums'; frag.appendChild(sec);
            albums.forEach(album => {
                const item = document.createElement('div'); item.className='search-result-item'; item.dataset.type='album'; item.dataset.name=album;
                item.onclick = () => { window.switchView && window.switchView('album_detail', album); searchResults.classList.add('select-hide'); document.getElementById('search-input').value=''; };
                item.innerHTML = `<div class="sr-title">${escapeHTML(album)}</div><div class="sr-meta">Album</div>`;
                frag.appendChild(item);
            });
        }
        if (tracks.length > 0) {
            const sec = document.createElement('div'); sec.className = 'sr-section-title'; sec.innerText = 'Tracks'; frag.appendChild(sec);
            tracks.forEach((track, index) => {
                const item = document.createElement('div'); item.className = 'search-result-item'; item.dataset.type='track'; item.dataset.path=track.path;
                item.onclick = () => { window.setQueue && window.setQueue(tracks, index); searchResults.classList.add('select-hide'); };
                item.innerHTML = `<div class="sr-title">${escapeHTML(track.title)}</div><div class="sr-meta">${escapeHTML(track.artist)} • ${escapeHTML(track.album)}</div>`;
                frag.appendChild(item);
            });
        }
        searchResults.appendChild(frag);
    }
    searchResults.classList.remove('select-hide');
}

export function updateRangeProgress(el){
    const min = parseFloat(el.min || 0); const max = parseFloat(el.max || 100); const val = parseFloat(el.value);
    const progress = ((val - min) / (max - min)) * 100;
    el.style.setProperty('--progress', `${progress}%`);
}

export function initCustomDropdowns(){
    document.querySelectorAll('.custom-select').forEach(dd => {
        const newDd = dd.cloneNode(true);
        dd.parentNode.replaceChild(newDd, dd);
        const selected = newDd.querySelector('.select-selected');
        const items = newDd.querySelector('.select-items');
        selected.addEventListener('click', function(e){ e.stopPropagation(); closeAllSelect(this); items.classList.toggle('select-hide'); this.classList.toggle('select-arrow-active'); });
        items.querySelectorAll('div').forEach(opt => {
            opt.addEventListener('click', async function(){
                const val = this.dataset.val; selected.innerHTML = this.innerHTML; selected.dataset.val = val;
                if (newDd.id === 'font-dropdown') { document.documentElement.style.setProperty('--app-font', val); await window.db && window.dbPut && window.dbPut('settings','appFont',val); }
                else if (newDd.id === 'viz-top-dropdown') { await window.db && window.dbPut && window.dbPut('settings','vizTopStyle',val); }
                else if (newDd.id === 'viz-btm-dropdown') { await window.db && window.dbPut && window.dbPut('settings','vizBtmStyle',val); }
                items.classList.add('select-hide'); selected.classList.remove('select-arrow-active');
            });
        });
    });
}

export function initKeyboardShortcuts(){
    // Space: play/pause, Left: prev/seek back, Right: next/seek forward, M: mute
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
        if (e.code === 'Space') { e.preventDefault(); window.togglePlayPause && window.togglePlayPause(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); if (window.currentEngine) window.currentEngine.currentTime = Math.min((window.currentEngine.duration||0), (window.currentEngine.currentTime||0) + 5); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); if (window.currentEngine) window.currentEngine.currentTime = Math.max(0, (window.currentEngine.currentTime||0) - 5); }
        else if (e.key.toLowerCase() === 'm') { e.preventDefault(); window.masterVolume = window.masterVolume === 0 ? (window.prevVolume||1) : 0; if (window.currentEngine) window.currentEngine.volume = window.masterVolume; if (window.UI && typeof window.UI.updateMuteIcon === 'function') window.UI.updateMuteIcon(); }
        else if (e.key.toLowerCase() === 'n') { e.preventDefault(); window.nextTrack && window.nextTrack(); }
        else if (e.key.toLowerCase() === 'p') { e.preventDefault(); window.prevTrack && window.prevTrack(); }
    });
}

export function closeAllSelect(elmnt){
    const selected = document.getElementsByClassName('select-selected');
    const items = document.getElementsByClassName('select-items');
    for (let i=0;i<selected.length;i++){ if (elmnt == selected[i]) {} else selected[i].classList.remove('select-arrow-active'); }
    for (let i=0;i<items.length;i++){ items[i].classList.add('select-hide'); }
}

export function setupResizer(){
    let isResizing = false; const resizer = document.getElementById('right-resizer'); if (!resizer) return;
    resizer.addEventListener('mousedown', (e) => { isResizing = true; resizer.classList.add('active'); document.body.style.cursor='ew-resize'; });
    document.addEventListener('mousemove', (e) => { if(!isResizing) return; const containerRect = document.querySelector('.app-container').getBoundingClientRect(); let newWidth = containerRect.right - e.clientX - 20; if (newWidth<250) newWidth=250; if (newWidth>600) newWidth=600; const sb = document.getElementById('sidebar-right'); if (sb) sb.style.width = newWidth+'px'; });
    document.addEventListener('mouseup', () => { if (isResizing) { isResizing=false; resizer.classList.remove('active'); document.body.style.cursor='default'; } });
}

export function cleanupResources(){
    try { if (window.vizReqId) cancelAnimationFrame(window.vizReqId); } catch(e){}
}

export function updateMuteIcon(){
    try {
        const iconOn = document.getElementById('icon-vol-on');
        const iconOff = document.getElementById('icon-vol-off');
        const mv = typeof window.masterVolume === 'number' ? window.masterVolume : (window.masterVolume || 1);
        if (iconOn && iconOff) {
            if (mv === 0) { iconOn.style.display = 'none'; iconOff.style.display = 'block'; }
            else { iconOn.style.display = 'block'; iconOff.style.display = 'none'; }
        }
    } catch(e){}
}

export async function handleWelcomeLoad(){
    try {
        if (window.dbPut) await window.dbPut('settings', 'hasVisited', true);
        if (typeof closeOverlay === 'function') closeOverlay('welcome-overlay');
        if (window.initFolderSelection) window.initFolderSelection();
    } catch(e){}
}

export function loadPlaylists(){
    const container = document.getElementById('playlist-nav-container'); if (!container) return;
    container.innerHTML = '';
    // Try backend first
    try {
        fetch('/api/playlists').then(r=>r.json()).then(resp=>{
            if (resp && resp.ok && Array.isArray(resp.playlists)) {
                window.playlists = resp.playlists;
                window.playlists.forEach(pl => { const el = document.createElement('div'); el.className='nav-item'; el.innerText = pl.name; el.onclick = () => window.switchView && window.switchView('playlist_detail', pl.id); container.appendChild(el); });
                return;
            }
            // fallback to indexedDB
            if (!window.db) return;
            const tx = window.db.transaction('playlists','readonly');
            const store = tx.objectStore('playlists');
            const req = store.getAll();
            req.onsuccess = () => {
                window.playlists = req.result || [];
                window.playlists.forEach(pl => { const el = document.createElement('div'); el.className='nav-item'; el.innerText = pl.name; el.onclick = () => window.switchView && window.switchView('playlist_detail', pl.id); container.appendChild(el); });
            };
        }).catch(() => {
            if (!window.db) return;
            const tx = window.db.transaction('playlists','readonly');
            const store = tx.objectStore('playlists');
            const req = store.getAll();
            req.onsuccess = () => {
                window.playlists = req.result || [];
                window.playlists.forEach(pl => { const el = document.createElement('div'); el.className='nav-item'; el.innerText = pl.name; el.onclick = () => window.switchView && window.switchView('playlist_detail', pl.id); container.appendChild(el); });
            };
        });
    } catch (e) {
        // ignore and fallback
    }
}

export function openAddToPlaylistModal(items, event){
    // items: string path | track object | array of such
    const existing = document.getElementById('add-playlist-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'add-playlist-modal';
    modal.style = 'position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
        <div style="background:var(--bg);border:1px solid rgba(255,255,255,0.06);padding:18px;border-radius:10px;min-width:320px;max-width:520px;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
            <div style="font-weight:700;margin-bottom:8px;color:var(--text);">Create Playlist</div>
            <div style="margin-bottom:10px;color:var(--muted);">Enter a playlist name and confirm to create.</div>
            <input id="apl-name" placeholder="Playlist name" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;background:transparent;color:var(--text);">
            <div style="display:flex;gap:8px;justify-content:flex-end;"><button id="apl-cancel" class="btn-outline">Cancel</button><button id="apl-create" class="btn-primary">Create</button></div>
        </div>`;

    document.body.appendChild(modal);
    const nameInput = modal.querySelector('#apl-name');
    const btnCancel = modal.querySelector('#apl-cancel');
    const btnCreate = modal.querySelector('#apl-create');
    nameInput.focus();

    function cleanup(){ try{ modal.remove(); }catch(e){} }
    btnCancel.addEventListener('click', cleanup);
    modal.addEventListener('click', (e)=>{ if (e.target === modal) cleanup(); });

    btnCreate.addEventListener('click', async () => {
        const name = (nameInput.value || '').trim();
        if (!name) { nameInput.focus(); return; }

        // collect track paths
        let trackPaths = [];
        if (!items) items = [];
        if (!Array.isArray(items)) items = [items];
        items.forEach(it => {
            if (!it) return;
            if (typeof it === 'string') trackPaths.push(it);
            else if (it && typeof it.path === 'string') trackPaths.push(it.path);
        });

        // Try backend create
        try {
            const res = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, trackPaths }) });
            if (res.ok) {
                const data = await res.json();
                // save in IndexedDB as well for offline
                if (window.db && typeof window.dbPut === 'function') {
                    const pl = data.playlist || { id: (Date.now().toString(36)), name, trackPaths };
                    try { await window.dbPut('playlists', pl.id, pl); } catch(e){}
                }
                if (typeof loadPlaylists === 'function') loadPlaylists();
                cleanup();
                return;
            }
        } catch (e) { /* backend failed, fallback to IndexedDB below */ }

        // Fallback: save to IndexedDB
        try {
            if (window.db) {
                const id = 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
                const pl = { id, name, trackPaths };
                const tx = window.db.transaction('playlists','readwrite');
                tx.objectStore('playlists').put(pl);
                tx.oncomplete = () => { if (typeof loadPlaylists === 'function') loadPlaylists(); cleanup(); };
                tx.onerror = () => { cleanup(); };
                return;
            }
        } catch (err) { console.warn('Playlist save failed', err); }

        cleanup();
    });
}

export async function loadSettings(){
    if (!window.db) return;
    const appFont = await new Promise(r=>{ const tx=window.db.transaction('settings','readonly'); const s=tx.objectStore('settings'); const q=s.get('appFont'); q.onsuccess=()=>r(q.result); q.onerror=()=>r(null); });
    if (appFont) document.documentElement.style.setProperty('--app-font', appFont);
}

export function updateArtUI(pictureUrl){
    const main = document.getElementById('main-art-container'); const mini = document.getElementById('mini-art-container');
    if (pictureUrl) { if (main) { main.style.backgroundImage = `url(${pictureUrl})`; main.innerHTML=''; } if (mini) mini.innerHTML = `<img src="${pictureUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`; }
    else { if (main) { main.style.backgroundImage='none'; main.innerHTML='<svg class="art-icon" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'; } if (mini) mini.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'; }
}

export function highlightCurrentTrack(){
    document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
    if (window.currentTrackIndex>=0 && window.currentQueue[window.currentTrackIndex]){
        const currentPath = window.currentQueue[window.currentTrackIndex].path;
        document.querySelectorAll('[data-path]').forEach(el => { if (el.dataset.path === currentPath) el.classList.add('playing'); });
    }
}

export function renderTrackList(tracks, viewMode='list', opts={}){
    window.currentViewedTracks = [...tracks];
    const container = document.createElement('div'); container.className = viewMode === 'grid' ? 'grid-view-4' : 'list-view';
    if (!tracks || tracks.length===0) { window.ui.contentArea.innerHTML = '<div class="empty-state"><p>No tracks here.</p></div>'; return; }
    tracks.forEach((track, idx) => {
        const isPlayingTrack = (window.currentTrackIndex>=0 && window.currentQueue[window.currentTrackIndex] && window.currentQueue[window.currentTrackIndex].path === track.path);
        if (viewMode === 'grid'){
            const card = document.createElement('div'); card.className='card'; card.dataset.type='track'; card.dataset.path = track.path; if (isPlayingTrack) card.classList.add('playing');
            card.onclick = (e) => { if(!e.target.closest('.icon-btn')) window.setQueue && window.setQueue(tracks, idx); };
            card.innerHTML = `<div class="card-icon">${track.pictureUrl?`<img src="${track.pictureUrl}" loading="lazy">`:`<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`}<div class="card-actions"><button class="icon-btn" onclick="window.openAddToPlaylistModal && window.openAddToPlaylistModal('${escapeHTML(track.path)}', event)">+</button></div></div><div class="card-title">${escapeHTML(track.title)}</div><div class="card-subtitle">${escapeHTML(track.artist)}</div>`;
            container.appendChild(card);
        } else {
            const item = document.createElement('div'); item.className='list-view-item track-list-item'; item.dataset.type='track'; item.dataset.path = track.path; if (isPlayingTrack) item.classList.add('playing');
            item.onclick = (e) => { if(!e.target.closest('.icon-btn')) window.setQueue && window.setQueue(tracks, idx); };
            item.innerHTML = `${opts.showArt?`<div class="list-view-art" ${track.pictureUrl?`style="background-image:url(${track.pictureUrl})"`:''}>${!track.pictureUrl?`<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`:''}</div>`:''}<div class="list-view-info"><div class="list-view-title">${escapeHTML(track.title)}</div><div class="list-view-meta">${escapeHTML(track.artist)} ${opts.showAlbum?`• ${escapeHTML(track.album)}`:''}</div></div><div class="track-actions"><button class="icon-btn" onclick="window.openAddToPlaylistModal && window.openAddToPlaylistModal('${escapeHTML(track.path)}', event)">+</button></div>`;
            container.appendChild(item);
        }
    });
    window.ui.contentArea.innerHTML = ''; window.ui.contentArea.appendChild(container);
}

export function renderQueue(){
    const container = document.getElementById('queue-list');
    if (!container) return;
    container.innerHTML = '';
    if (!window.currentQueue || window.currentQueue.length===0) { container.innerHTML = '<div class="empty-state"><p>Queue is empty.</p></div>'; return; }
    const frag = document.createDocumentFragment();
    window.currentQueue.forEach((t, idx) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        if (window.currentTrackIndex === idx) item.classList.add('playing');
        item.dataset.index = idx;
        item.innerHTML = `<div class="q-left"><div class="q-title">${escapeHTML(t.title||t.path)}</div><div class="q-meta">${escapeHTML(t.artist||'')}</div></div><div class="q-actions"><button class="icon-btn" data-idx="${idx}" data-action="play">▶</button><button class="icon-btn" data-idx="${idx}" data-action="remove">✖</button></div>`;
        frag.appendChild(item);
    });
    container.appendChild(frag);
    container.querySelectorAll('.icon-btn').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
            const idx = parseInt(btn.dataset.idx,10);
            const act = btn.dataset.action;
            if (act === 'play' && window.playQueueIndex) window.playQueueIndex(idx);
            if (act === 'remove') removeFromQueue(idx, e);
        });
    });
}

export function removeFromQueue(index, event){
    if (event) event.stopPropagation();
    if (!Array.isArray(window.currentQueue)) return;
    window.currentQueue.splice(index,1);
    if (window.currentTrackIndex >= window.currentQueue.length) window.currentTrackIndex = window.currentQueue.length-1;
    if (window.renderQueue) window.renderQueue();
}

export function renderPlaylistNav(){
    // loadPlaylists already renders nav; call it to refresh
    if (typeof loadPlaylists === 'function') return loadPlaylists();
}

export function openCreatePlaylistModal(){
    // simple wrapper that reuses openAddToPlaylistModal for creating an empty playlist
    openAddToPlaylistModal([], null);
}

export async function saveNewPlaylist(name, trackPaths=[]){
    // legacy handler used by inline HTML may call saveNewPlaylist() without args; ignore that case
    if (!name || typeof name !== 'string') return;
    try {
        const res = await fetch('/api/playlists', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, trackPaths }) });
        if (res.ok) { if (typeof loadPlaylists === 'function') loadPlaylists(); return; }
    } catch(e){}
    // fallback to IndexedDB
    try {
        if (window.db) {
            const id = 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
            const pl = { id, name, trackPaths };
            const tx = window.db.transaction('playlists','readwrite'); tx.objectStore('playlists').put(pl);
            tx.oncomplete = () => { if (typeof loadPlaylists === 'function') loadPlaylists(); };
        }
    } catch(e){}
}

export async function addToPlaylist(playlistId){
    if (!playlistId) return;
    const track = window.currentQueue && window.currentQueue[window.currentTrackIndex];
    if (!track) return;
    try {
        const plRes = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`);
        if (plRes.ok){ const data = await plRes.json(); const pl = data.playlist || data; pl.trackPaths = pl.trackPaths || []; pl.trackPaths.push(track.path); await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(pl) }); if (typeof loadPlaylists === 'function') loadPlaylists(); return; }
    } catch(e){}
    // fallback to IndexedDB
    try {
        if (window.db) {
            const tx = window.db.transaction('playlists','readwrite'); const store = tx.objectStore('playlists'); const req = store.get(playlistId);
            req.onsuccess = () => { const pl = req.result || { id: playlistId, name: 'Playlist', trackPaths: [] }; pl.trackPaths = pl.trackPaths || []; if (!pl.trackPaths.includes(track.path)) pl.trackPaths.push(track.path); store.put(pl); if (typeof loadPlaylists === 'function') loadPlaylists(); };
        }
    } catch(e){}
}

export async function removeFromPlaylist(playlistId, trackPath, event){
    if (event) event.stopPropagation();
    if (!playlistId || !trackPath) return;
    try {
        const plRes = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`);
        if (plRes.ok){ const data = await plRes.json(); const pl = data.playlist || data; pl.trackPaths = (pl.trackPaths||[]).filter(p=>p!==trackPath); await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(pl) }); if (typeof loadPlaylists === 'function') loadPlaylists(); return; }
    } catch(e){}
    try {
        if (window.db) {
            const tx = window.db.transaction('playlists','readwrite'); const store = tx.objectStore('playlists'); const req = store.get(playlistId);
            req.onsuccess = () => { const pl = req.result || { id: playlistId, trackPaths: [] }; pl.trackPaths = (pl.trackPaths||[]).filter(p=>p!==trackPath); store.put(pl); if (typeof loadPlaylists === 'function') loadPlaylists(); };
        }
    } catch(e){}
}

export function toggleShuffle(){
    window.isShuffle = !window.isShuffle;
    if (window.ui && window.ui.btnShuffle) window.ui.btnShuffle.classList.toggle('active', window.isShuffle);
}

export function toggleRepeat(){
    window.repeatMode = (window.repeatMode + 1) % 3;
    if (window.ui && window.ui.btnRepeat) {
        const modes = ['off','all','one'];
        window.ui.btnRepeat.dataset.mode = modes[window.repeatMode] || 'off';
    }
}

export function toggleArtCollapse(){
    window.isArtCollapsed = !window.isArtCollapsed;
    const main = document.getElementById('main-art-container');
    if (main) main.classList.toggle('collapsed', window.isArtCollapsed);
}

export function checkMarquee(){
    const el = document.getElementById('np-title');
    if (!el) return;
    try { el.classList.toggle('marquee', el.scrollWidth > el.clientWidth); } catch(e){}
}

export function setSidebarState(state){
    window.rightSidebarState = state;
    const sb = document.getElementById('sidebar-right'); if (!sb) return;
    sb.classList.toggle('hidden', state === 'hidden');
    sb.classList.toggle('overlay', state === 'overlay');
}

export function toggleRightSidebar(){
    const sb = document.getElementById('sidebar-right'); if (!sb) return;
    const isOpen = sb.classList.toggle('open'); window.rightSidebarOpen = isOpen;
}

export function toggleRightSidebarOverlay(){
    const sb = document.getElementById('sidebar-right'); if (!sb) return;
    sb.classList.toggle('overlay'); window.rightSidebarState = sb.classList.contains('overlay') ? 'overlay' : 'docked';
}

export function scrollToActiveQueueItem(){
    const el = document.querySelector('.queue-item.playing'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function openAutomixModal(){
    // minimal stub: show a modal if exists
    const m = document.getElementById('automix-modal'); if (m) m.classList.add('active');
}

export function generateAutomix(){
    // simple stub: play current viewed tracks shuffled
    if (typeof playCurrentViewShuffled === 'function') return playCurrentViewShuffled();
}

export function renderAlbums(tracks, viewMode='grid', opts={}){
    const groups = {};
    tracks.forEach(t => { const val = t.album || 'Unknown Album'; if(!groups[val]) groups[val]=[]; groups[val].push(t); });
    const uniqueAlbums = Object.keys(groups).map(name=>({name, tracks: groups[name]}));
    const container = document.createElement('div'); container.className = viewMode==='grid'?'grid-view-4':'list-view';
    uniqueAlbums.forEach(ad=>{ const cover = ad.tracks.find(t=>t.pictureUrl)?.pictureUrl; if (viewMode==='grid'){ const card=document.createElement('div'); card.className='card'; card.dataset.type='album'; card.dataset.name=ad.name; card.onclick=()=> window.switchView && window.switchView('album_detail', ad.name); card.innerHTML=`<div class="card-icon">${cover?`<img src="${cover}">`:`<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`}</div><div class="card-title">${escapeHTML(ad.name)}</div><div class="card-subtitle">${escapeHTML([...new Set(ad.tracks.map(t=>t.artist))].join(', '))}</div>`; container.appendChild(card);} else { const item=document.createElement('div'); item.className='list-view-item'; item.dataset.type='album'; item.dataset.name=ad.name; item.onclick=()=> window.switchView && window.switchView('album_detail', ad.name); item.innerHTML=`<div class="list-view-art" ${cover?`style="background-image:url(${cover})"`:''}></div><div class="list-view-info"><div class="list-view-title">${escapeHTML(ad.name)}</div><div class="list-view-meta">${escapeHTML([...new Set(ad.tracks.map(t=>t.artist))].join(', '))} • ${ad.tracks.length} track${ad.tracks.length>1?'s':''}</div></div>`; container.appendChild(item);} });
    window.ui.contentArea.innerHTML=''; window.ui.contentArea.appendChild(container);
}

export function renderArtists(tracks){
    const artistGroups = {}; tracks.forEach(t=>{ const val = t.artist || 'Unknown Artist'; if(!artistGroups[val]) artistGroups[val]=[]; artistGroups[val].push(t); });
    const uniqueArtists = Object.keys(artistGroups).map(a=>({name:a, tracks:artistGroups[a]}));
    const container = document.createElement('div'); container.className='list-view';
    uniqueArtists.forEach(ad=>{ const item=document.createElement('div'); item.className='list-view-item'; item.dataset.type='artist'; item.dataset.name=ad.name; item.onclick=()=> window.switchView && window.switchView('artist_detail', ad.name); item.innerHTML=`<div class="list-view-art artist-avatar"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/></svg></div><div class="list-view-info"><div class="list-view-title">${escapeHTML(ad.name)}</div><div class="list-view-meta">${new Set(ad.tracks.map(t=>t.album)).size} album${ad.tracks.length>1?'s':''} • ${ad.tracks.length} track${ad.tracks.length>1?'s':''}</div></div>`; container.appendChild(item); });
    window.ui.contentArea.innerHTML=''; window.ui.contentArea.appendChild(container);
}

export function renderGenres(tracks){
    const genreGroups = {}; tracks.forEach(t=>{ const val = t.genre || 'Unknown Genre'; if(!genreGroups[val]) genreGroups[val]=[]; genreGroups[val].push(t); });
    const uniqueGenres = Object.keys(genreGroups).map(g=>({name:g, tracks:genreGroups[g]}));
    const container = document.createElement('div'); container.className='list-view';
    uniqueGenres.forEach(gd=>{ const item=document.createElement('div'); item.className='list-view-item'; item.dataset.type='genre'; item.dataset.name=gd.name; item.onclick=()=> window.switchView && window.switchView('genre_detail', gd.name); item.innerHTML=`<div class="list-view-art artist-avatar"><svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/></svg></div><div class="list-view-info"><div class="list-view-title">${escapeHTML(gd.name)}</div><div class="list-view-meta">${gd.tracks.length} track${gd.tracks.length>1?'s':''}</div></div>`; container.appendChild(item); });
    window.ui.contentArea.innerHTML=''; window.ui.contentArea.appendChild(container);
}

// Minimal lyrics UI helper
export function renderManualLyricsUI(path){
    window.ui.lyricsContainer.innerHTML = `\n+        <div class="lyrics-not-found" style="height:auto;">\n+            <p style="margin-bottom:10px;">Lyrics not found.<br>Paste custom LRC or plain text here:</p>\n+            <textarea id="manual-lrc-input" class="lyrics-textarea"></textarea>\n+            <button class="btn-outline" style="margin-top:10px;" onclick="(async function(){ const val=document.getElementById('manual-lrc-input').value; if(!val.trim()) return; const tx=window.db.transaction('manual_lyrics','readwrite'); tx.objectStore('manual_lyrics').put(val, path); if(window.currentQueue[window.currentTrackIndex] && window.currentQueue[window.currentTrackIndex].path===path) window.loadLyrics && window.loadLyrics(window.currentQueue[window.currentTrackIndex]); })()">Save Lyrics</button>\n+        </div>\n+    `;
}

export function parseLRC(text){
    const lines = text.split('\n'); const regex = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\](.*)/; window.parsedLyrics = [];
    for (const line of lines){ const match = line.match(regex); if (match){ const m=parseInt(match[1],10), s=parseInt(match[2],10); const msMult = match[3] && match[3].length===2?10:1; const ms = match[3]?parseInt(match[3],10)*msMult:0; const txt = match[4].trim(); if (txt) window.parsedLyrics.push({time: m*60 + s + ms/1000, text: txt}); } }
    window.parsedLyrics.sort((a,b)=>a.time-b.time); return window.parsedLyrics.length>0;
}

export function renderLyrics(){ if(!window.parsedLyrics || window.parsedLyrics.length===0) return; window.ui.lyricsContainer.innerHTML = window.parsedLyrics.map((l,i)=>`<div class="lyric-line" id="lyr-${i}">${escapeHTML(l.text)}</div>`).join(''); }

export function syncLyrics(time){ if (!window.parsedLyrics || window.parsedLyrics.length===0) return; let idx=-1; for (let i=0;i<window.parsedLyrics.length;i++){ if (time >= window.parsedLyrics[i].time - 0.3) idx = i; else break; } if (idx!==-1 && idx !== window.activeLyricIndex){ if (window.activeLyricIndex !== -1){ const oldEl = document.getElementById(`lyr-${window.activeLyricIndex}`); if (oldEl) oldEl.classList.remove('active'); } window.activeLyricIndex = idx; const newEl = document.getElementById(`lyr-${idx}`); if (newEl){ newEl.classList.add('active'); newEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } }

// --- View & Navigation Engine ---
export function goBack() {
    if (!window.viewHistory) window.viewHistory = [];
    if (window.viewHistory.length > 0) {
        const prev = window.viewHistory.pop();
        window.savedScrollPos = prev.scrollPos;
        switchView(prev.viewName, prev.arg, true);
    }
}

export function setViewMode(mode) {
    if (!window.viewModes) window.viewModes = {};
    if (window.viewModes[window.currentActiveView] !== undefined) {
        window.viewModes[window.currentActiveView] = mode;
        window.savedScrollPos = window.ui.contentArea.scrollTop;
        switchView(window.currentActiveView, window.currentActiveArg, true);
    }
}

export function toggleSortOrder() {
    window.sortOrderAsc = !window.sortOrderAsc;
    window.savedScrollPos = window.ui.contentArea.scrollTop;
    switchView(window.currentActiveView, window.currentActiveArg, true);
}

export function toggleSettings() {
    if (window.currentActiveView === 'settings') {
        if (window.preSettingsState) {
            window.savedScrollPos = window.preSettingsState.scrollPos;
            switchView(window.preSettingsState.view, window.preSettingsState.arg, true, true);
            window.preSettingsState = null;
        } else {
            switchView('tracks');
        }
    } else {
        switchView('settings', null, false, true);
    }
}

export function generateAlphaIndex(keys) {
    const el = document.getElementById('alpha-index'); if(!el) return;
    el.innerHTML = '';
    if (keys.length === 0) return;
    el.classList.remove('select-hide');
    const indexChars = ['#', 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
    indexChars.forEach(char => {
        if (keys.includes(char)) {
            const a = document.createElement('a'); a.href = `#alpha-${char}`; a.innerText = char; el.appendChild(a);
        } else {
            const span = document.createElement('span'); span.innerText = char; span.style.opacity = '0.3'; el.appendChild(span);
        }
    });
}

export function groupItemsByAlpha(items, keySelector) {
    const groups = {};
    items.forEach(item => {
        let keyStr = (keySelector(item) || '').toString().trim();
        let firstChar = (keyStr.charAt(0) || '').toUpperCase();
        if (!/[A-Z]/.test(firstChar)) firstChar = '#';
        if (!groups[firstChar]) groups[firstChar] = [];
        groups[firstChar].push(item);
    });
    return groups;
}

export async function setRating(path, rating, event) {
    if(event) event.stopPropagation();
    const track = window.allTracks.find(t => t.path === path);
    if(track) {
        track.rating = track.rating === rating ? 0 : rating;
        // Try backend first
        try {
            const res = await fetch(`/api/ratings/${encodeURIComponent(path)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ rating: track.rating }) });
            if (!res.ok) throw new Error('backend failed');
        } catch (e) {
            if (window.db && typeof window.dbPut === 'function') await window.dbPut('ratings', path, track.rating);
        }
        if(event && event.currentTarget) {
            const container = event.currentTarget.parentElement;
            const stars = container.querySelectorAll('svg');
            stars.forEach((star, i) => { if (i < track.rating) star.classList.add('filled'); else star.classList.remove('filled'); });
        }
    }
}

export function playCurrentViewShuffled() {
    if (!window.currentViewedTracks || window.currentViewedTracks.length === 0) return;
    let newQ = [...window.currentViewedTracks];
    for (let i = newQ.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newQ[i], newQ[j]] = [newQ[j], newQ[i]]; }
    window.isShuffle = true; if (window.ui && window.ui.btnShuffle) window.ui.btnShuffle.classList.add('active');
    window.currentQueue = newQ; window.currentTrackIndex = 0; if (window.renderQueue) window.renderQueue(); if (window.setQueue) window.setQueue(newQ, 0);
    if (typeof window.switchRightTab === 'function') window.switchRightTab('queue');
}

export async function renderStats(){
    window.ui.viewTitle.innerText = 'Analytics & Listening Stats';
    if (!window.db) { window.ui.contentArea.innerHTML = '<div class="empty-state"><p>No analytics available.</p></div>'; return; }
    const all = await new Promise(r=>{ const tx=window.db.transaction('play_stats','readonly'); const s=tx.objectStore('play_stats'); const q=s.getAll(); q.onsuccess=()=>r(q.result); q.onerror=()=>r([]); });
    all.sort((a,b)=> (b.count||0)-(a.count||0));
    const container = document.createElement('div'); container.className='list-view';
    all.forEach(s=>{ const item=document.createElement('div'); item.className='list-view-item'; item.innerHTML = `<div class="list-view-info"><div class="list-view-title">${escapeHTML(s.title||s.path)}</div><div class="list-view-meta">${escapeHTML(s.artist||'')} • Plays: ${s.count||0}</div></div>`; container.appendChild(item); });
    if (all.length===0) container.innerHTML = '<div class="empty-state"><p>No play stats yet (listen to tracks).</p></div>';
    window.ui.contentArea.innerHTML=''; window.ui.contentArea.appendChild(container);
}

// Expose common helpers to global scope for existing inline HTML handlers
window.switchView = window.switchView || function(){ console.warn('switchView not wired yet'); };
window.toggleSettings = window.toggleSettings || function(){};
window.goBack = window.goBack || function(){};
window.setViewMode = window.setViewMode || function(){};
window.toggleSortOrder = window.toggleSortOrder || function(){};
window.playCurrentViewShuffled = window.playCurrentViewShuffled || function(){};
window.setRating = window.setRating || function(){};
