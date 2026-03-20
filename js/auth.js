export class Auth {
    constructor() {
        this.usersKey = 'ytpm_users';
        this.activeUserKey = 'ytpm_active_user';
    }

    getUsers() {
        const users = localStorage.getItem(this.usersKey);
        return users ? JSON.parse(users) : {};
    }

    getActiveUser() {
        const active = localStorage.getItem(this.activeUserKey);
        return active ? JSON.parse(active) : null;
    }

    register(username, password) {
        if (!username || !password) return { success: false, error: 'Username and password required' };
        
        const users = this.getUsers();
        if (users[username]) {
            return { success: false, error: 'User already exists' };
        }

        users[username] = {
            username,
            password: btoa(password), // Basic obfuscation
            createdAt: new Date().toISOString()
        };

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
}
