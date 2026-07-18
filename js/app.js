import * as UI from './ui.js';
import * as Player from './player.js';
import * as Scan from './scan.js';

// Expose application state on window so UI/player modules can access it without a heavy refactor.
window.db = null;
window.allTracks = [];
window.lrcFilesMap = {};
window.playlists = [];

window.currentQueue = [];
window.currentViewedTracks = [];
window.currentTrackIndex = -1;
window.currentAudioUrl = null;
window.isPlaying = false;
window.isShuffle = false;
window.repeatMode = 0; // 0: Off, 1: All, 2: One
window.parsedLyrics = [];
window.rightSidebarOpen = true;
window.rightSidebarState = 'docked'; // 'docked', 'overlay', 'hidden'
window.isArtCollapsed = false;
window.prevVolume = 100;

// Audio/visualizer
window.audioCtx = null;
window.analyser = null;
window.audioMain = new Audio();
window.audioFade = new Audio();
window.currentEngine = window.audioMain;
window.masterVolume = 1.0;

// View & UI state defaults
window.viewHistory = [];
window.savedScrollPos = 0;
window.preSettingsState = null;
window.viewModes = { albums: 'grid', artist_detail: 'grid', album_detail: 'list', genres: 'list', genre_detail: 'list' };
window.currentActiveView = 'tracks';
window.currentActiveArg = null;
window.sortOrderAsc = true;

// Feature flags / audio settings defaults
window.visualizerEnabled = false;
window.normalizationEnabled = false;
window.spatialEnabled = false;
window.bassBoostLevel = 0;
window.crossfadeEnabled = false;
window.crossfadeDuration = 5;
window.isCrossfading = false;

// Expose player/ui entry points after modules load
function wireGlobals() {
    if (typeof Player !== 'undefined') {
        window.setQueue = Player.setQueue;
        window.playList = Player.playList;
        window.addListToQueue = Player.addListToQueue;
        window.addToQueue = Player.addToQueue;
        window.togglePlayPause = Player.togglePlayPause;
        window.pauseTrack = Player.pauseTrack;
        window.playTrack = Player.playTrack;
        window.seekTo = Player.seekTo;
        window.setVolume = Player.setVolume;
        window.prevTrack = Player.prevTrack || function(){ if (typeof Player.prev === 'function') Player.prev(); };
        window.nextTrack = Player.nextTrack || function(){ if (typeof Player.next === 'function') Player.next(); };
        window.playQueueIndex = Player.playQueueIndex || function(){};
        window.startCrossfade = Player.startCrossfade || function(){};
        window.logPlayStat = Player.logPlayStat || function(){};
    }
    if (typeof UI !== 'undefined') {
        window.switchView = UI.switchView;
        window.toggleSettings = UI.toggleSettings;
        window.goBack = UI.goBack;
        window.setViewMode = UI.setViewMode;
        window.toggleSortOrder = UI.toggleSortOrder;
        window.playCurrentViewShuffled = UI.playCurrentViewShuffled;
        window.setRating = UI.setRating;
        window.openAddToPlaylistModal = UI.openAddToPlaylistModal || function(){};
        window.loadPlaylists = UI.loadPlaylists;
        window.loadSettings = UI.loadSettings;
        window.initFolderSelection = Scan.initFolderSelection;
        window.handleFolderSelect = Scan.handleFolderSelect;
        window.renderQueue = UI.renderQueue || function(){};
        window.removeFromQueue = UI.removeFromQueue || function(){};
        window.renderPlaylistNav = UI.renderPlaylistNav || function(){};
        window.openCreatePlaylistModal = UI.openCreatePlaylistModal || function(){};
        window.saveNewPlaylist = UI.saveNewPlaylist || function(){};
        window.addToPlaylist = UI.addToPlaylist || function(){};
        window.removeFromPlaylist = UI.removeFromPlaylist || function(){};
        window.toggleShuffle = UI.toggleShuffle || function(){};
        window.toggleRepeat = UI.toggleRepeat || function(){};
        window.scrollToActiveQueueItem = UI.scrollToActiveQueueItem || function(){};
        window.openAutomixModal = UI.openAutomixModal || function(){};
        window.generateAutomix = UI.generateAutomix || function(){};
    }

    // Expose IndexedDB helpers for legacy inline code
    window.dbPut = dbPut;
    window.dbGet = dbGet;
    window.dbGetAll = dbGetAll;
    window.dbGetRatingsMap = dbGetRatingsMap;
    window.initDB = initDB;
}

// DOM shortcuts (cached after DOMContentLoaded)
window.ui = {};

// IndexedDB helpers (kept here)
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('NeonStreamDB', 4);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
            if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('manual_lyrics')) db.createObjectStore('manual_lyrics');
            if (!db.objectStoreNames.contains('ratings')) db.createObjectStore('ratings');
            if (!db.objectStoreNames.contains('play_stats')) db.createObjectStore('play_stats');
        };
        request.onsuccess = (e) => { window.db = e.target.result; resolve(window.db); };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function dbPut(storeName, key, value) {
    return new Promise((resolve) => {
        const tx = window.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        if (key) store.put(value, key); else store.put(value);
        tx.oncomplete = () => resolve();
    });
}

async function dbGet(storeName, key) {
    return new Promise((resolve) => {
        const tx = window.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function dbGetAll(storeName) {
    return new Promise((resolve) => {
        const tx = window.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}

function dbGetRatingsMap() {
    return new Promise((resolve) => {
        const map = {};
        try {
            const tx = window.db.transaction('ratings', 'readonly');
            const store = tx.objectStore('ratings');
            const req = store.openCursor();
            req.onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) { map[cursor.key] = cursor.value; cursor.continue(); }
                else resolve(map);
            };
            req.onerror = () => resolve({});
        } catch (e) { resolve({}); }
    });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
    // expose module objects for legacy inline stubs
    window.UI = UI;
    window.Player = Player;
    window.Scan = Scan;
    // wire exported functions to window for backward compatibility
    wireGlobals();
    // cache common DOM elements on window.ui used by modules
    window.ui = {
        contentArea: document.getElementById('main-content-area'),
        viewTitle: document.getElementById('view-title-text'),
        navItems: document.querySelectorAll('.nav-item'),
        btnPlayPause: document.getElementById('btn-play-pause'),
        iconPlay: document.getElementById('icon-play'),
        iconPause: document.getElementById('icon-pause'),
        btnShuffle: document.getElementById('btn-shuffle'),
        btnRepeat: document.getElementById('btn-repeat'),
        seekBar: document.getElementById('seek-bar'),
        volBar: document.getElementById('volume-bar'),
        timeCurrent: document.getElementById('time-current'),
        timeTotal: document.getElementById('time-total'),
        npTitle: document.getElementById('np-title'),
        npArtist: document.getElementById('np-artist'),
        btmTitle: document.getElementById('btm-title'),
        btmArtist: document.getElementById('btm-artist'),
        lyricsContainer: document.getElementById('lyrics-container'),
        playlistNavContainer: document.getElementById('playlist-nav-container'),
        sidebarRight: document.getElementById('sidebar-right'),
        resizer: document.getElementById('right-resizer'),
        mainArt: document.getElementById('main-art-container'),
        miniArt: document.getElementById('mini-art-container'),
        alphaIndex: document.getElementById('alpha-index'),
        btnMute: document.getElementById('btn-mute')
    };

    UI.initTooltips();
    UI.initSearch();
    UI.initContextMenu();
    if (typeof UI.initKeyboardShortcuts === 'function') UI.initKeyboardShortcuts();
    await initDB();
    // loadPlaylists and loadSettings are UI helpers that interact with IndexedDB
    if (typeof UI.loadPlaylists === 'function') UI.loadPlaylists();
    if (typeof UI.loadSettings === 'function') UI.loadSettings();

    const setupEngine = (engine) => {
        engine.addEventListener('timeupdate', (e) => { 
            if (e.target === window.currentEngine && typeof Player.updateProgress === 'function') Player.updateProgress(); 
        });
        engine.addEventListener('ended', (e) => {
            if (e.target === window.currentEngine && typeof Player.handleTrackEnd === 'function') Player.handleTrackEnd();
        });
    };
    setupEngine(window.audioMain);
    setupEngine(window.audioFade);

    window.ui.volBar.addEventListener('input', (e) => {
        window.masterVolume = e.target.value / 100;
        if (!window.isCrossfading) window.currentEngine.volume = window.masterVolume;
    });

    UI.setupResizer();
    UI.initCustomDropdowns();

    const hasVisited = await dbGet('settings', 'hasVisited');
    if (hasVisited) {
        const el = document.getElementById('welcome-title'); if (el) el.innerText = "Welcome Back!";
    } else {
        const el = document.getElementById('welcome-title'); if (el) el.innerText = "Welcome to Neon Stream";
    }
    const welcome = document.getElementById('welcome-overlay'); if (welcome) welcome.classList.add('active');
    window.addEventListener('beforeunload', () => { if (typeof UI.cleanupResources === 'function') UI.cleanupResources(); });
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(err => console.warn('SW registration failed', err));
    });
}

export { dbGet, dbPut, initDB, dbGetAll, dbGetRatingsMap };
