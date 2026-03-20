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
    }
};
