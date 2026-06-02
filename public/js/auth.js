export class Auth {
    constructor() {
        this.usersKey = 'ytpm_users';
        this.activeUserKey = 'ytpm_active_user';
        
        // Bootstrap admin user if not exists
        const users = this.getUsers();
        if (!users['admin']) {
            this.register('admin', 'admin123');
        }
    }

    getUsers() {
        const users = localStorage.getItem(this.usersKey);
        return users ? JSON.parse(users) : {};
    }

    getActiveUser() {
        const active = localStorage.getItem(this.activeUserKey);
        if (!active) return null;
        
        const activeData = JSON.parse(active);
        const users = this.getUsers();
        if (users[activeData.username]) {
            activeData.profilePic = users[activeData.username].profilePic;
        }
        return activeData;
    }

    setProfilePicture(username, dataUrl) {
        const users = this.getUsers();
        if (users[username]) {
            users[username].profilePic = dataUrl;
            localStorage.setItem(this.usersKey, JSON.stringify(users));
            return true;
        }
        return false;
    }

    register(username, password, profilePic = null) {
        if (!username || !password) return { success: false, error: 'Username and password required' };
        
        const users = this.getUsers();
        if (users[username]) {
            return { success: false, error: 'User already exists' };
        }

        users[username] = {
            username,
            password: btoa(password), // Basic obfuscation
            profilePic,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem(this.usersKey, JSON.stringify(users));
        return { success: true };
    }

    updatePassword(username, oldPassword, newPassword) {
        const users = this.getUsers();
        if (!users[username]) return { success: false, error: 'User not found' };

        if (users[username].password !== btoa(oldPassword)) {
            return { success: false, error: 'Incorrect current password' };
        }

        if (!newPassword || newPassword.length < 3) {
            return { success: false, error: 'New password is too short' };
        }

        users[username].password = btoa(newPassword);
        localStorage.setItem(this.usersKey, JSON.stringify(users));
        return { success: true };
    }

    login(username, password) {
        const users = this.getUsers();
        const user = users[username];

        if (!user || user.password !== btoa(password)) {
            return { success: false, error: 'Invalid username or password' };
        }

        // Set active user session
        localStorage.setItem(this.activeUserKey, JSON.stringify({
            username: user.username,
            id: username
        }));

        return { success: true, user: this.getActiveUser() };
    }

    logout() {
        localStorage.removeItem(this.activeUserKey);
    }

    isLoggedIn() {
        return this.getActiveUser() !== null;
    }

    deleteUser(username) {
        if (username === 'admin') return { success: false, error: 'Cannot delete the admin account' };
        const users = this.getUsers();
        if (users[username]) {
            delete users[username];
            localStorage.setItem(this.usersKey, JSON.stringify(users));
            
            const active = localStorage.getItem(this.activeUserKey);
            if (active) {
                const activeData = JSON.parse(active);
                if (activeData.username === username) {
                    this.logout();
                }
            }
            return { success: true };
        }
        return { success: false, error: 'User not found' };
    }

    resetUserPassword(username, newPassword) {
        const users = this.getUsers();
        if (users[username]) {
            if (!newPassword || newPassword.length < 3) {
                return { success: false, error: 'Password is too short' };
            }
            users[username].password = btoa(newPassword);
            localStorage.setItem(this.usersKey, JSON.stringify(users));
            return { success: true };
        }
        return { success: false, error: 'User not found' };
    }
}
