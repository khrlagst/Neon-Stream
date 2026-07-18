// Player helper module (placeholder)
import * as UI from './ui.js';

// Player module: controls audio elements and playback state
export function setQueue(list, startIndex=0){
    window.currentQueue = list.map(t => typeof t === 'string' ? window.allTracks.find(a=>a.path===t) || {path: t, title: t} : t);
    window.currentTrackIndex = Math.max(0, Math.min(startIndex, window.currentQueue.length-1));
    playCurrent();
}

export function playCurrent(){
    const track = window.currentQueue[window.currentTrackIndex];
    if (!track) return;
    playTrack(track);
}

export function playTrack(track){
    try {
        if (!track) return;
        window.currentAudioUrl = track.path;
        const engine = window.audioMain;
        if (engine.src !== window.currentAudioUrl) engine.src = window.currentAudioUrl;
        engine.volume = window.masterVolume;
        engine.play().then(() => {
            window.isPlaying = true;
            if (window.ui && window.ui.btnPlayPause) window.ui.btnPlayPause.classList.add('playing');
            if (window.updateNowPlaying) window.updateNowPlaying(track);
            if (window.loadLyrics) window.loadLyrics(track);
        }).catch(err => console.warn('Playback failed', err));
    } catch (e) { console.warn('playTrack error', e); }
}

export function pauseTrack(){
    try { window.audioMain.pause(); window.isPlaying = false; if (window.ui && window.ui.btnPlayPause) window.ui.btnPlayPause.classList.remove('playing'); } catch(e){}
}

export function togglePlayPause(){
    if (window.isPlaying) pauseTrack(); else playCurrent();
}

export function addToQueue(pathOrTrack){
    let tr = typeof pathOrTrack === 'string' ? window.allTracks.find(t=>t.path===pathOrTrack) || {path: pathOrTrack, title: pathOrTrack} : pathOrTrack;
    window.currentQueue.push(tr);
}

export function addListToQueue(list){
    const mapped = list.map(t=> typeof t === 'string' ? window.allTracks.find(a=>a.path===t) || {path:t, title:t} : t);
    window.currentQueue = window.currentQueue.concat(mapped);
}

export function playList(list, startIndex=0){ setQueue(list, startIndex); }

export function updateProgress(){
    const engine = window.currentEngine || window.audioMain;
    if (!engine || !window.ui || !window.ui.seekBar) return;
    const cur = engine.currentTime || 0; const dur = engine.duration || 0;
    window.ui.timeCurrent.innerText = formatTime(cur);
    window.ui.timeTotal.innerText = isFinite(dur)?formatTime(dur):'--:--';
    if (isFinite(dur) && dur>0) {
        window.ui.seekBar.max = dur; window.ui.seekBar.value = cur; UI.updateRangeProgress(window.ui.seekBar);
    }
    if (window.syncLyrics) window.syncLyrics(cur);
}

export function handleTrackEnd(){
    if (window.repeatMode === 2) { // repeat one
        playCurrent(); return;
    }
    if (window.isShuffle){
        window.currentTrackIndex = Math.floor(Math.random() * window.currentQueue.length);
        playCurrent(); return;
    }
    if (window.currentTrackIndex < window.currentQueue.length - 1){ window.currentTrackIndex++; playCurrent(); }
    else if (window.repeatMode === 1){ window.currentTrackIndex = 0; playCurrent(); }
    else { window.isPlaying = false; if (window.ui && window.ui.btnPlayPause) window.ui.btnPlayPause.classList.remove('playing'); }
}

export function playQueueIndex(index){
    if (!Array.isArray(window.currentQueue) || window.currentQueue.length===0) return;
    index = Math.max(0, Math.min(index, window.currentQueue.length-1));
    window.currentTrackIndex = index;
    const track = window.currentQueue[window.currentTrackIndex];
    if (!track) return;
    playTrack(track);
    if (window.renderQueue) window.renderQueue();
}

export function startCrossfade(){
    if (window.isCrossfading) return;
    const q = window.currentQueue || [];
    if (!q.length) return;
    let nextIdx = window.currentTrackIndex + 1;
    if (nextIdx >= q.length) {
        if (window.repeatMode === 1) nextIdx = 0; else { if (typeof handleTrackEnd === 'function') return handleTrackEnd(); return; }
    }
    const nextTrackObj = q[nextIdx];
    if (!nextTrackObj) return;
    window.isCrossfading = true;
    try { if (window.crossfadeInterval) clearInterval(window.crossfadeInterval); } catch(e){}

    const outgoing = window.currentEngine || window.audioMain;
    const incoming = (outgoing === window.audioMain) ? window.audioFade : window.audioMain;

    // Prepare incoming
    try {
        incoming.pause();
        incoming.removeAttribute && incoming.removeAttribute('src');
    } catch(e){}
    incoming.src = nextTrackObj.path || nextTrackObj.handle || nextTrackObj.url || nextTrackObj;
    incoming.volume = 0;
    incoming.currentTime = 0;
    if (window.visualizerEnabled || window.normalizationEnabled || window.spatialEnabled || window.bassBoostLevel > 0) initAudioContext();
    const playPromise = incoming.play();
    if (playPromise && typeof playPromise.then === 'function') playPromise.catch(()=>{});

    // update UI now-playing fields optimistically
    try {
        if (window.ui) {
            window.ui.npTitle && (window.ui.npTitle.innerText = nextTrackObj.title || '');
            window.ui.npArtist && (window.ui.npArtist.innerText = nextTrackObj.artist || '');
            window.ui.btmTitle && (window.ui.btmTitle.innerText = nextTrackObj.title || '');
            window.ui.btmArtist && (window.ui.btmArtist.innerText = nextTrackObj.artist || '');
        }
    } catch(e){}

    const duration = (typeof window.crossfadeDuration === 'number' && window.crossfadeDuration > 0) ? window.crossfadeDuration : 5;
    const steps = Math.max(8, Math.round(duration * 30));
    let step = 0;
    const origVolume = window.masterVolume || 1.0;
    window.crossfadeInterval = setInterval(() => {
        step++;
        const t = step / steps;
        outgoing.volume = Math.max(0, origVolume * (1 - t));
        incoming.volume = Math.min(origVolume, origVolume * t);
        if (step >= steps) {
            clearInterval(window.crossfadeInterval);
            window.crossfadeInterval = null;
            try { outgoing.pause(); outgoing.removeAttribute && outgoing.removeAttribute('src'); } catch(e){}
            incoming.volume = origVolume;
            window.currentEngine = incoming;
            window.currentTrackIndex = nextIdx;
            window.isCrossfading = false;
            if (window.renderQueue) window.renderQueue();
        }
    }, (duration * 1000) / steps);
}

export async function logPlayStat(track){
    try {
        if (!track || !window.db) return;
        const tx = window.db.transaction('play_stats','readwrite');
        const store = tx.objectStore('play_stats');
        const key = track.path || track.id || Date.now().toString();
        const existingReq = store.get(key);
        existingReq.onsuccess = () => {
            const cur = existingReq.result || { path: track.path, title: track.title, artist: track.artist, count: 0 };
            cur.count = (cur.count || 0) + 1;
            store.put(cur, key);
        };
    } catch(e){ console.warn('logPlayStat failed', e); }
}

export function seekTo(seconds){ if (window.audioMain) { window.audioMain.currentTime = Math.max(0, Math.min(seconds, window.audioMain.duration || seconds)); updateProgress(); } }

export function setVolume(percent){ window.masterVolume = percent/100; if (window.currentEngine) window.currentEngine.volume = window.masterVolume; }

export async function loadLyrics(track){
    if (!track) return;
    // prefer manual lyrics
    if (!window.db) { if (window.ui) window.ui.lyricsContainer.innerHTML=''; return; }
    const tx = window.db.transaction('manual_lyrics','readonly'); const store = tx.objectStore('manual_lyrics'); const req = store.get(track.path);
    req.onsuccess = async () => {
        if (req.result){ const ok = UI.parseLRC(req.result); if (ok) UI.renderLyrics(); return; }
        // try to fetch embed or sidecar LRC - left as stub
        if (track.lyrics) { const ok = UI.parseLRC(track.lyrics); if (ok) UI.renderLyrics(); }
    };
}

function formatTime(t){ if (!isFinite(t)) return '--:--'; const m = Math.floor(t/60); const s = Math.floor(t%60); return `${m}:${s.toString().padStart(2,'0')}`; }

// (UI is imported at top)

// Audio context, visualizer and related helpers
export function createReverbImpulse(context, duration, decay) {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const n = i;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
}

export function initAudioContext() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!window.audioCtx) window.audioCtx = new AudioContextClass();

        if (!window.analyser) window.analyser = window.audioCtx.createAnalyser();
        window.analyser.fftSize = 256;

        if (!window.compressorNode) {
            window.compressorNode = window.audioCtx.createDynamicsCompressor();
            window.compressorNode.threshold.value = -24;
            window.compressorNode.knee.value = 30;
            window.compressorNode.ratio.value = 12;
            window.compressorNode.attack.value = 0.003;
            window.compressorNode.release.value = 0.25;
        }

        if (!window.bassNode) {
            window.bassNode = window.audioCtx.createBiquadFilter();
            window.bassNode.type = 'lowshelf';
            window.bassNode.frequency.value = 85;
            window.bassNode.gain.value = window.bassBoostLevel || 0;
        }

        if (!window.convolverNode) {
            window.convolverNode = window.audioCtx.createConvolver();
            window.convolverNode.buffer = createReverbImpulse(window.audioCtx, 1.5, 2.5);
        }

        if (!window.dryGainNode) window.dryGainNode = window.audioCtx.createGain();
        if (!window.spatialGainNode) window.spatialGainNode = window.audioCtx.createGain();
        window.spatialGainNode.gain.value = window.spatialEnabled ? 0.35 : 0;
        window.dryGainNode.gain.value = window.spatialEnabled ? 0.75 : 1.0;

        if (!window.audioMergerNode) window.audioMergerNode = window.audioCtx.createGain();

        try { if (!window.sourceNodeMain) { window.sourceNodeMain = window.audioCtx.createMediaElementSource(window.audioMain); window.sourceNodeMain.connect(window.audioMergerNode); } } catch(e){}
        try { if (!window.sourceNodeFade) { window.sourceNodeFade = window.audioCtx.createMediaElementSource(window.audioFade); window.sourceNodeFade.connect(window.audioMergerNode); } } catch(e){}

        window.vizData = new Uint8Array(window.analyser.frequencyBinCount);
        window.vizTimeData = new Uint8Array(window.analyser.frequencyBinCount);

        updateAudioRouting();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
    } catch (err) { console.error('Audio Context Init Failed:', err); }
}

export function updateAudioRouting(){
    if (!window.audioCtx || !window.audioMergerNode || !window.analyser) return;
    try { window.audioMergerNode.disconnect(); window.analyser.disconnect(); } catch(e){}
    let currentNode = window.audioMergerNode;
    if (window.normalizationEnabled && window.compressorNode) { currentNode.connect(window.compressorNode); currentNode = window.compressorNode; }
    if (window.bassNode) { currentNode.connect(window.bassNode); currentNode = window.bassNode; }
    if (window.spatialEnabled && window.dryGainNode && window.convolverNode && window.spatialGainNode) {
        currentNode.connect(window.dryGainNode);
        currentNode.connect(window.convolverNode);
        window.convolverNode.connect(window.spatialGainNode);
        window.dryGainNode.connect(window.analyser);
        window.spatialGainNode.connect(window.analyser);
    } else {
        currentNode.connect(window.analyser);
    }
    window.analyser.connect(window.audioCtx.destination);
}

export function updateVizVisibility(){
    const canvas = document.getElementById('viz-canvas');
    const topViz = document.getElementById('top-bar-viz');
    const bottomDim = document.getElementById('bottom-bar-dim');
    if (!canvas || !topViz) return;
    const topEnabled = window.vizTopStyle && window.vizTopStyle !== 'none';
    const topForcesBottom = window.vizTopStyle === 'neon-stream' || window.vizTopStyle === 'the-sync';
    const bottomEnabled = window.vizBtmStyle && (window.vizBtmStyle !== 'none' || topForcesBottom);
    if (window.visualizerEnabled) {
        canvas.style.opacity = bottomEnabled ? '1' : '0';
        bottomDim.style.opacity = bottomEnabled ? '1' : '0';
        topViz.style.opacity = topEnabled ? '1' : '0';
        if (window.isPlaying) { if (!window.audioCtx) initAudioContext(); startVisualizer(); }
    } else { canvas.style.opacity='0'; bottomDim.style.opacity='0'; topViz.style.opacity='0'; stopVisualizer(); }
}

export function startVisualizer(){ if (!window.visualizerEnabled || !window.audioCtx) return; if (!window.vizReqId) drawVisualizer(); }
export function stopVisualizer(){ if (window.vizReqId) { cancelAnimationFrame(window.vizReqId); window.vizReqId = null; } }

export function roundRect(ctx, x, y, width, height, radius){ if (typeof ctx.roundRect === 'function') { ctx.roundRect(x,y,width,height,radius); return; } let r = typeof radius === 'number' ? {tl:radius,tr:radius,br:radius,bl:radius} : {tl:0,tr:0,br:0,bl:0}; ctx.beginPath(); ctx.moveTo(x + r.tl, y); ctx.lineTo(x + width - r.tr, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr); ctx.lineTo(x + width, y + height - r.br); ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height); ctx.lineTo(x + r.bl, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl); ctx.lineTo(x, y + r.tl); ctx.quadraticCurveTo(x, y, x + r.tl, y); ctx.closePath(); }

export function cleanupResources(){ try { if (window.vizReqId) cancelAnimationFrame(window.vizReqId); } catch(e){} window.vizReqId=null; try { clearInterval(window.crossfadeInterval); } catch(e){} window.crossfadeInterval=null; try { if (window.sourceNodeMain) { try{ window.sourceNodeMain.disconnect(); }catch(e){} window.sourceNodeMain=null; } if (window.sourceNodeFade) { try{ window.sourceNodeFade.disconnect(); }catch(e){} window.sourceNodeFade=null; } if (window.analyser) { try{ window.analyser.disconnect(); }catch(e){} window.analyser=null; } if (window.audioMergerNode) { try{ window.audioMergerNode.disconnect(); }catch(e){} window.audioMergerNode=null; } if (window.compressorNode) { try{ window.compressorNode.disconnect(); }catch(e){} window.compressorNode=null; } } catch(e){}

export function prevTrack(){
    if (window.currentQueue.length === 0) return;
    if ((window.currentEngine && window.currentEngine.currentTime > 3)) { window.currentEngine.currentTime = 0; return; }
    const prevIdx = window.currentTrackIndex - 1 < 0 ? (window.repeatMode === 1 ? window.currentQueue.length - 1 : 0) : window.currentTrackIndex - 1;
    playQueueIndex(prevIdx);
}

export function nextTrack(){ if (window.currentQueue.length === 0) return; const nextIdx = window.currentTrackIndex + 1 >= window.currentQueue.length ? (window.repeatMode === 1 ? 0 : window.currentTrackIndex) : window.currentTrackIndex + 1; playQueueIndex(nextIdx); }

// drawVisualizer is intentionally left in core file for now; simple fallback
export function drawVisualizer() {
    window.vizReqId = requestAnimationFrame(drawVisualizer);
    if (!window.isPlaying || !window.visualizerEnabled || !window.analyser) return;
    window.analyser.getByteFrequencyData(window.vizData);
    window.analyser.getByteTimeDomainData(window.vizTimeData);
    const topViz = document.getElementById('top-bar-viz');
    const btmCanvas = document.getElementById('viz-canvas');
    if (!btmCanvas) return;
    const btmCtx = btmCanvas.getContext('2d');
    if (btmCanvas.width !== btmCanvas.clientWidth) btmCanvas.width = btmCanvas.clientWidth;
    if (btmCanvas.height !== btmCanvas.clientHeight) btmCanvas.height = btmCanvas.clientHeight;
    btmCtx.clearRect(0, 0, btmCanvas.width, btmCanvas.height);
    // simple bars fallback
    const columns = 48; const maxBlocks = 12; const gap = 2; const colWidth = Math.max(3, Math.floor((btmCanvas.width - (columns - 1) * gap) / columns)); const xStart = Math.floor((btmCanvas.width - (columns * colWidth + (columns - 1) * gap)) / 2);
    for (let c=0;c<columns;c++){ const dataIdx=Math.floor((c/columns)*window.analyser.frequencyBinCount); const value=window.vizData[dataIdx]||0; const lit=Math.max(1, Math.round((value/255)*maxBlocks)); const hue=(c*6)%360; const x=xStart + c*(colWidth+gap); for (let b=0;b<maxBlocks;b++){ const y = btmCanvas.height - (b+1)*(Math.max(3,Math.floor((btmCanvas.height-(maxBlocks-1)*gap)/maxBlocks))) - b*gap; if (b<lit) { btmCtx.fillStyle = `hsla(${hue},100%,${36+(b/maxBlocks)*32}%,0.95)`; } else { btmCtx.fillStyle='rgba(255,255,255,0.06)'; } btmCtx.fillRect(x,y,colWidth,Math.max(3,Math.floor((btmCanvas.height-(maxBlocks-1)*gap)/maxBlocks))); } }
}
