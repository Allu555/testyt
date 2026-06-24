export const StorageUtils = {
    _getKey(baseKey) {
        const activeUser = localStorage.getItem('ytpm_active_user');
        const prefix = activeUser ? JSON.parse(activeUser).username + '_' : 'global_';
        return prefix + baseKey;
    },

    getFavorites: () => {
        try {
            const items = localStorage.getItem(StorageUtils._getKey('ytpm_favorites'));
            return items ? JSON.parse(items) : [];
        } catch (e) {
            return [];
        }
    },

    saveFavorites: (favoritesList) => {
        localStorage.setItem(StorageUtils._getKey('ytpm_favorites'), JSON.stringify(favoritesList));
    },

    addFavorite: (song) => {
        const favs = StorageUtils.getFavorites();
        if (!favs.find(s => s.id === song.id)) {
            favs.push(song);
            StorageUtils.saveFavorites(favs);
        }
    },

    removeFavorite: (songId) => {
        const favs = StorageUtils.getFavorites();
        const updated = favs.filter(s => s.id !== songId);
        StorageUtils.saveFavorites(updated);
    },

    removeRecent: (songId) => {
        let items = StorageUtils.getRecent();
        items = items.filter(item => item.id !== songId);
        localStorage.setItem(StorageUtils._getKey('ytpm_recent'), JSON.stringify(items));
    },

    isFavorite: (songId) => {
        const favs = StorageUtils.getFavorites();
        return !!favs.find(s => s.id === songId);
    },

    getRecent: () => {
        const items = localStorage.getItem(StorageUtils._getKey('ytpm_recent'));
        return items ? JSON.parse(items) : [];
    },

    addRecent: (song) => {
        let items = StorageUtils.getRecent();
        // Remove if exists to move to top
        items = items.filter(s => s.id !== song.id);
        items.unshift(song);
        
        // Keep max 50 recents
        if (items.length > 50) {
            items.pop();
        }
        localStorage.setItem(StorageUtils._getKey('ytpm_recent'), JSON.stringify(items));
    },

    getSavedPlaylists: () => {
        try {
            const items = localStorage.getItem(StorageUtils._getKey('ytpm_playlists'));
            return items ? JSON.parse(items) : [];
        } catch (e) {
            return [];
        }
    },

    savePlaylists: (playlists) => {
        localStorage.setItem(StorageUtils._getKey('ytpm_playlists'), JSON.stringify(playlists));
    },

    addPlaylist: (playlistData) => {
        const playlists = StorageUtils.getSavedPlaylists();
        // Give it a unique ID if it doesn't have one
        if (!playlistData.id) {
            playlistData.id = 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        playlists.push(playlistData);
        StorageUtils.savePlaylists(playlists);
        return playlistData;
    },

    removePlaylist: (playlistId) => {
        const playlists = StorageUtils.getSavedPlaylists();
        const updated = playlists.filter(p => p.id !== playlistId);
        StorageUtils.savePlaylists(updated);
    },

    getAdminLogs: () => {
        try {
            const logs = localStorage.getItem('ytpm_admin_logs');
            return logs ? JSON.parse(logs) : [];
        } catch (e) {
            return [];
        }
    },

    addAdminLog: (username, action, details) => {
        try {
            const logs = StorageUtils.getAdminLogs();
            const newLog = {
                timestamp: new Date().toISOString(),
                username,
                action,
                details
            };
            logs.unshift(newLog);
            if (logs.length > 200) logs.pop();
            localStorage.setItem('ytpm_admin_logs', JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to save admin log', e);
        }
    },

    clearAdminLogs: () => {
        try {
            localStorage.setItem('ytpm_admin_logs', JSON.stringify([]));
        } catch (e) {
            console.error('Failed to clear admin logs', e);
        }
    },

    deleteUserData: (username) => {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(username + '_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {
            console.error('Failed to delete user data', e);
        }
    },

    // --- IndexedDB for Custom Wallpaper ---
    _getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AlluPlayerDB', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('wallpapers')) {
                    db.createObjectStore('wallpapers');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    saveWallpaper: async (blob, type) => {
        const db = await StorageUtils._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('wallpapers', 'readwrite');
            const store = tx.objectStore('wallpapers');
            const key = StorageUtils._getKey('wallpaper');
            const data = { blob, type };
            const request = store.put(data, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    getWallpaper: async () => {
        const db = await StorageUtils._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('wallpapers', 'readonly');
            const store = tx.objectStore('wallpapers');
            const key = StorageUtils._getKey('wallpaper');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    removeWallpaper: async () => {
        const db = await StorageUtils._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('wallpapers', 'readwrite');
            const store = tx.objectStore('wallpapers');
            const key = StorageUtils._getKey('wallpaper');
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};
