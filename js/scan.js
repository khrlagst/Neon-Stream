// Scan and metadata extraction utilities migrated from inline HTML.
// Uses global `window` state: window.db, window.allTracks, window.lrcFilesMap, window.currentQueue, etc.

export function initFolderSelection(){
    const inp = document.getElementById('folder-input');
    if (inp) inp.click();
}

export async function handleFolderSelect(event){
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const loading = document.getElementById('loading-overlay'); if (loading) loading.classList.add('active');
    const countEl = document.getElementById('loading-text');

    try {
        if (window.allTracks && window.allTracks.length > 0) {
            const uniqueUrls = new Set(window.allTracks.map(t => t.pictureUrl).filter(Boolean));
            uniqueUrls.forEach(url => { try{ URL.revokeObjectURL(url); }catch(e){} });
        }

        window.allTracks = [];
        window.lrcFilesMap = {};
        window.globalAlbumArtCache = {};

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (i % 25 === 0) {
                if (countEl) countEl.innerText = `Scanning ${i} of ${files.length} files... Found ${window.allTracks.length} tracks`;
                await new Promise(r => setTimeout(r, 1));
            }
            const nameParts = file.name.split('.');
            const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase().trim() : '';
            const path = file.webkitRelativePath || file.name;
            const pathStr = path.substring(0, path.lastIndexOf('/')) || "";

            if (['mp3', 'mp4', 'm4a', 'wav', 'ogg', 'flac'].includes(ext)) {
                let meta = extractMetadataFromPath(file.name, pathStr);
                if (ext === 'mp3') {
                    const id3 = await readID3Tags(file);
                    if (id3.title) meta.title = id3.title;
                    if (id3.artist) meta.artist = id3.artist;
                    if (id3.album) meta.album = id3.album;
                    if (id3.picture) meta.pictureUrl = id3.picture;
                    if (id3.trackNumber) meta.trackNumber = id3.trackNumber;
                    if (id3.discNumber) meta.discNumber = id3.discNumber;
                    if (id3.genre) meta.genre = id3.genre;
                } else if (ext === 'm4a' || ext === 'mp4') {
                    const m4aMeta = await readMP4Tags(file);
                    if (m4aMeta.title) meta.title = m4aMeta.title;
                    if (m4aMeta.artist) meta.artist = m4aMeta.artist;
                    if (m4aMeta.album) meta.album = m4aMeta.album;
                    if (m4aMeta.picture) meta.pictureUrl = m4aMeta.picture;
                    if (m4aMeta.trackNumber) meta.trackNumber = m4aMeta.trackNumber;
                    if (m4aMeta.discNumber) meta.discNumber = m4aMeta.discNumber;
                    if (m4aMeta.genre) meta.genre = m4aMeta.genre;
                }

                let realCacheKey = meta.album !== "Unknown Album" ? meta.album : null;
                if (meta.pictureUrl && realCacheKey) {
                    if (window.globalAlbumArtCache && window.globalAlbumArtCache[realCacheKey]) {
                        try { URL.revokeObjectURL(meta.pictureUrl); } catch(e){}
                        meta.pictureUrl = window.globalAlbumArtCache[realCacheKey];
                    } else {
                        window.globalAlbumArtCache[realCacheKey] = meta.pictureUrl;
                    }
                } else if (!meta.pictureUrl && realCacheKey && window.globalAlbumArtCache && window.globalAlbumArtCache[realCacheKey]) {
                    meta.pictureUrl = window.globalAlbumArtCache[realCacheKey];
                }

                window.allTracks.push({ id: 'track_' + i + '_' + Date.now(), handle: file, path: path, filename: file.name, ...meta });
            } else if (ext === 'lrc') {
                window.lrcFilesMap[path.replace(/\.lrc$/i, '')] = file;
            }
        }

        // load ratings from IndexedDB if available
        let ratingsMap = {};
        try {
            if (window.db) {
                const tx = window.db.transaction('ratings','readonly');
                const store = tx.objectStore('ratings');
                const req = store.openCursor();
                await new Promise(r => {
                    req.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) { ratingsMap[cursor.key] = cursor.value; cursor.continue(); }
                        else r();
                    };
                    req.onerror = () => r();
                });
            }
        } catch(e) { ratingsMap = {}; }

        window.allTracks.forEach(t => { t.rating = ratingsMap[t.path] || 0; });

        if (countEl) countEl.innerText = `Finalizing ${window.allTracks.length} tracks...`;
        window.allTracks.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
        window.currentQueue = [...window.allTracks];
        if (window.switchView) window.switchView('tracks');
    } catch (e) {
        console.error('Scan error', e);
    }

    const loadingOverlay = document.getElementById('loading-overlay'); if (loadingOverlay) loadingOverlay.classList.remove('active');
}

export function extractMetadataFromPath(filename, pathStr){
    let name = filename.replace(/\.[^/.]+$/, "");
    let artist = "Unknown Artist", album = "Unknown Album", title = name, trackNumber = null;
    let trackMatch = name.match(/^(\d+)[\s.-]+/);
    if (trackMatch) trackNumber = parseInt(trackMatch[1], 10);
    let cleanName = name.replace(/^\d+[\s.-]+/, '');
    let separator = cleanName.includes(" - ") ? " - " : (cleanName.includes("-") ? "-" : null);
    if (separator) {
        const parts = cleanName.split(separator);
        if (parts.length >= 2) { artist = parts[0].trim(); title = parts.slice(1).join(separator).trim(); }
    } else { title = cleanName.trim(); }
    if (pathStr) {
        const dirs = pathStr.split('/').filter(d=>d);
        if (dirs.length > 0) { album = dirs[dirs.length - 1]; if (dirs.length > 1 && artist === 'Unknown Artist') artist = dirs[dirs.length - 2]; }
    }
    return { artist, album, title, trackNumber, discNumber: null, pictureUrl: null, genre: 'Unknown Genre', internetFetched: false };
}

async function readID3Tags(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        const slice = file.slice(0, 512 * 1024);
        reader.onload = function(e) {
            const buffer = e.target.result;
            const view = new DataView(buffer);
            let meta = { title: null, artist: null, album: null, picture: null, trackNumber: null, discNumber: null, genre: null };
            try {
                if (buffer.byteLength < 10 || view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) return resolve(meta);
                const version = view.getUint8(3);
                const tagSize = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
                let offset = 10;
                const limit = Math.min(tagSize + 10, buffer.byteLength);
                while (offset < limit) {
                    const frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
                    if (!/[A-Z0-9]{4}/.test(frameId)) break;
                    let frameSize = version === 3 ? view.getUint32(offset + 4) : 
                        (view.getUint8(offset+4) << 21) | (view.getUint8(offset+5) << 14) | (view.getUint8(offset+6) << 7) | view.getUint8(offset+7);
                    if (frameSize <= 0) break;
                    let frameOffset = offset + 10;
                    if (frameOffset + frameSize <= buffer.byteLength) {
                        if (frameId === 'TIT2') meta.title = readTextFrame(buffer, frameOffset, frameSize);
                        else if (frameId === 'TPE1') meta.artist = readTextFrame(buffer, frameOffset, frameSize);
                        else if (frameId === 'TPE2' && !meta.artist) meta.artist = readTextFrame(buffer, frameOffset, frameSize);
                        else if (frameId === 'TALB') meta.album = readTextFrame(buffer, frameOffset, frameSize);
                        else if (frameId === 'TCON') meta.genre = readTextFrame(buffer, frameOffset, frameSize);
                        else if (frameId === 'TRCK') meta.trackNumber = parseInt(readTextFrame(buffer, frameOffset, frameSize).split('/')[0], 10);
                        else if (frameId === 'TPOS') meta.discNumber = parseInt(readTextFrame(buffer, frameOffset, frameSize).split('/')[0], 10);
                        else if (frameId === 'APIC') meta.picture = readPictureFrame(buffer, frameOffset, frameSize);
                    }
                    offset += 10 + frameSize;
                }
            } catch (err) { }
            resolve(meta);
        };
        reader.onerror = () => resolve({ title: null, artist: null, album: null, picture: null, trackNumber: null, discNumber: null, genre: null });
        reader.onabort = () => resolve({ title: null, artist: null, album: null, picture: null, trackNumber: null, discNumber: null, genre: null });
        reader.readAsArrayBuffer(slice);
    });
}

function readTextFrame(buffer, offset, size) {
    if (size < 2) return "";
    const view = new Uint8Array(buffer, offset, size);
    const encoding = view[0];
    const textBytes = view.subarray(1);
    if (textBytes.length === 0) return "";
    try {
        let text = "";
        if (encoding === 0) text = new TextDecoder('iso-8859-1').decode(textBytes);
        else if (encoding === 1) text = new TextDecoder('utf-16').decode(textBytes);
        else if (encoding === 2) text = new TextDecoder('utf-16be').decode(textBytes);
        else if (encoding === 3) text = new TextDecoder('utf-8').decode(textBytes);
        return text.replace(/\0/g, '').trim();
    } catch (e) { return ""; }
}

function readPictureFrame(buffer, offset, size) {
    const view = new Uint8Array(buffer, offset, size);
    const encoding = view[0];
    let curr = 1, mime = '';
    while (curr < size && view[curr] !== 0) { mime += String.fromCharCode(view[curr]); curr++; }
    curr += 2;
    if (encoding === 1 || encoding === 2) {
        curr += 2;
        while (curr < size && (view[curr] !== 0 || view[curr+1] !== 0)) curr += 2;
        curr += 2;
    } else {
        while (curr < size && view[curr] !== 0) curr++;
        curr++;
    }
    const imgBytes = view.subarray(curr);
    if (imgBytes.length > 0) return URL.createObjectURL(new Blob([imgBytes], { type: mime || 'image/jpeg' }));
    return null;
}

async function readMP4Tags(file) {
    let meta = { title: null, artist: null, album: null, picture: null, trackNumber: null, discNumber: null, genre: null };
    try {
        let offset = 0;
        let fileSize = file.size;
        async function readBoxHeader(pos) {
            if (pos + 8 > fileSize) return null;
            const slice = file.slice(pos, pos + 8);
            const buf = await slice.arrayBuffer();
            const dv = new DataView(buf);
            let size = dv.getUint32(0);
            let type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
            if (size === 1) {
                if (pos + 16 > fileSize) return null;
                const extSlice = file.slice(pos + 8, pos + 16);
                const extBuf = await extSlice.arrayBuffer();
                const extDv = new DataView(extBuf);
                size = Number(extDv.getBigUint64(0));
            } else if (size === 0) {
                size = fileSize - pos;
            }
            return { size: size, type: type, pos: pos };
        }

        let moovBox = null;
        while (offset < fileSize) {
            const header = await readBoxHeader(offset);
            if (!header || header.size < 8) break;
            if (header.type === 'moov') { moovBox = header; break; }
            offset += header.size;
        }

        if (moovBox) {
            if (moovBox.size > 100 * 1024 * 1024) return meta;
            const moovSlice = file.slice(moovBox.pos, moovBox.pos + moovBox.size);
            const moovBuffer = await moovSlice.arrayBuffer();
            const dv = new DataView(moovBuffer);
            const len = moovBuffer.byteLength;
            function parseBoxes(start, end, insideIlst) {
                let pos = start;
                while (pos < end - 8) {
                    let size = dv.getUint32(pos);
                    if (size === 1) {
                        if (pos + 16 > end) break;
                        size = Number(dv.getBigUint64(pos + 8));
                    } else if (size === 0) {
                        size = end - pos;
                    }
                    if (size < 8 || isNaN(size)) break;
                    let type = String.fromCharCode(dv.getUint8(pos+4), dv.getUint8(pos+5), dv.getUint8(pos+6), dv.getUint8(pos+7));
                    if (type === 'udta' || type === 'moov') {
                        parseBoxes(pos + 8, pos + size, false);
                    } else if (type === 'meta') {
                        parseBoxes(pos + 12, pos + size, false);
                    } else if (type === 'ilst') {
                        parseBoxes(pos + 8, pos + size, true);
                    } else if (insideIlst) {
                        let dataPos = pos + 8;
                        while (dataPos < pos + size - 8) {
                            let dSize = dv.getUint32(dataPos);
                            if (dSize < 8) break;
                            let dType = String.fromCharCode(dv.getUint8(dataPos+4), dv.getUint8(dataPos+5), dv.getUint8(dataPos+6), dv.getUint8(dataPos+7));
                            if (dType === 'data') {
                                let flags = dv.getUint32(dataPos + 8);
                                let payloadOffset = dataPos + 16;
                                let payloadSize = dSize - 16;
                                if (payloadSize > 0 && payloadOffset + payloadSize <= len) {
                                    if (type === '©nam' || type === '\xA9nam') {
                                        meta.title = new TextDecoder('utf-8').decode(new Uint8Array(moovBuffer, payloadOffset, payloadSize));
                                    } else if (type === '©ART' || type === '\xA9ART') {
                                        meta.artist = new TextDecoder('utf-8').decode(new Uint8Array(moovBuffer, payloadOffset, payloadSize));
                                    } else if (type === '©alb' || type === '\xA9alb') {
                                        meta.album = new TextDecoder('utf-8').decode(new Uint8Array(moovBuffer, payloadOffset, payloadSize));
                                    } else if (type === '©gen' || type === '\xA9gen' || type === 'gnre') {
                                        meta.genre = new TextDecoder('utf-8').decode(new Uint8Array(moovBuffer, payloadOffset, payloadSize));
                                    } else if (type === 'covr') {
                                        let mime = flags === 13 ? 'image/jpeg' : (flags === 14 ? 'image/png' : 'image/jpeg');
                                        let blob = new Blob([new Uint8Array(moovBuffer, payloadOffset, payloadSize)], { type: mime });
                                        meta.picture = URL.createObjectURL(blob);
                                    } else if (type === 'trkn') {
                                        if (payloadSize >= 4) meta.trackNumber = dv.getUint8(payloadOffset + 3);
                                    } else if (type === 'disk') {
                                        if (payloadSize >= 4) meta.discNumber = dv.getUint8(payloadOffset + 3);
                                    }
                                }
                            }
                            dataPos += dSize;
                        }
                    }
                    pos += size;
                }
            }
            parseBoxes(0, len, false);
        }
    } catch(err) {
        console.warn('M4A Parse Error', err);
    }
    return meta;
}

export async function fetchInternetMetadata(track) {
    if (track.pictureUrl || track.internetFetched || track.artist === 'Unknown Artist') return;
    track.internetFetched = true;
    try {
        const queryStr = `${track.artist} ${track.album !== 'Unknown Album' ? track.album : track.title}`;
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryStr)}&entity=song&limit=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const item = data.results[0];
            if (item.artworkUrl100) {
                track.pictureUrl = item.artworkUrl100.replace('100x100bb', '600x600bb');
            }
            if (track.album === 'Unknown Album' && item.collectionName) track.album = item.collectionName;
            if (window.currentQueue && window.currentQueue[window.currentTrackIndex] === track) {
                if (window.updateArtUI) window.updateArtUI(track.pictureUrl);
            }
        }
    } catch(e) { console.warn('Internet fetch failed', e); }
}
