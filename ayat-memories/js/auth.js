// ── Google Auth ──
// Replace CLIENT_ID with your actual Google OAuth client ID
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'profile',
  'email'
].join(' ');

window.Auth = {
  user: null,
  token: null,

  init() {
    return new Promise((resolve) => {
      // Load Google Identity Services
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        // Try silent sign-in from stored token
        const stored = localStorage.getItem('ayat_token');
        const storedUser = localStorage.getItem('ayat_user');
        if (stored && storedUser) {
          this.token = stored;
          this.user = JSON.parse(storedUser);
          // Verify token is still valid
          this._verifyToken().then(valid => {
            if (valid) resolve(true);
            else { this._clearSession(); resolve(false); }
          });
        } else {
          resolve(false);
        }
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  async _verifyToken() {
    try {
      const r = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${this.token}`);
      return r.ok;
    } catch { return false; }
  },

  signIn() {
    return new Promise((resolve, reject) => {
      if (!window.google) { reject(new Error('Google SDK not loaded')); return; }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) { reject(response); return; }
          this.token = response.access_token;
          // Fetch user profile
          try {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${this.token}` }
            });
            const profile = await profileRes.json();
            this.user = {
              id: profile.sub,
              name: profile.name,
              email: profile.email,
              picture: profile.picture,
            };
            localStorage.setItem('ayat_token', this.token);
            localStorage.setItem('ayat_user', JSON.stringify(this.user));
            resolve(this.user);
          } catch (e) { reject(e); }
        }
      });
      client.requestAccessToken({ prompt: 'consent' });
    });
  },

  signOut() {
    if (this.token && window.google) {
      google.accounts.oauth2.revoke(this.token, () => {});
    }
    this._clearSession();
  },

  _clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('ayat_token');
    localStorage.removeItem('ayat_user');
  },

  isOwner(ownerId) {
    return this.user && this.user.id === ownerId;
  }
};
