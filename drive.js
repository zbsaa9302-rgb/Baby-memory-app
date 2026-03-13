// ── Google Drive Storage ──
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER = 'AyatMemoryBook';
const DATA_FILE = 'data.json';

window.Drive = {
  folderId: null,

  _headers(extra = {}) {
    return {
      'Authorization': `Bearer ${Auth.token}`,
      'Content-Type': 'application/json',
      ...extra
    };
  },

  // ── Folder management ──
  async ensureFolder() {
    if (this.folderId) return this.folderId;

    // Search for existing folder
    const q = encodeURIComponent(`name='${APP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, {
      headers: this._headers()
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
      return this.folderId;
    }

    // Create folder
    const create = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        name: APP_FOLDER,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folder = await create.json();
    this.folderId = folder.id;
    return this.folderId;
  },

  // ── App data JSON ──
  async loadData() {
    try {
      const folderId = await this.ensureFolder();
      const q = encodeURIComponent(`name='${DATA_FILE}' and '${folderId}' in parents and trashed=false`);
      const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, {
        headers: this._headers()
      });
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        const fileId = data.files[0].id;
        const content = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
          headers: this._headers()
        });
        return await content.json();
      }

      // Return default structure
      return this._defaultData();
    } catch (e) {
      console.error('Load error:', e);
      return this._defaultData();
    }
  },

  _defaultData() {
    return {
      version: 1,
      owner: Auth.user?.id || null,
      ownerEmail: Auth.user?.email || null,
      ownerName: Auth.user?.name || null,
      settings: {
        theme: 'warm',
        font: 'playfair',
        language: 'en'
      },
      children: [
        {
          id: 'child_1',
          name: 'Ayat',
          emoji: '🌸',
          coverFileId: null,
          coverColor: '#fde8d8',
          createdAt: new Date().toISOString()
        }
      ],
      memories: [],
      invites: [],
      dataFileId: null
    };
  },

  async saveData(appData) {
    try {
      const folderId = await this.ensureFolder();
      const content = JSON.stringify(appData, null, 2);
      const blob = new Blob([content], { type: 'application/json' });

      // Check if file exists
      const q = encodeURIComponent(`name='${DATA_FILE}' and '${folderId}' in parents and trashed=false`);
      const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
        headers: this._headers()
      });
      const existing = await res.json();

      let fileId;
      if (existing.files && existing.files.length > 0) {
        // Update existing
        fileId = existing.files[0].id;
        await fetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${Auth.token}`, 'Content-Type': 'application/json' },
          body: blob
        });
      } else {
        // Create new
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({
          name: DATA_FILE,
          parents: [folderId]
        })], { type: 'application/json' }));
        form.append('file', blob);
        const create = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${Auth.token}` },
          body: form
        });
        const f = await create.json();
        fileId = f.id;
      }
      appData.dataFileId = fileId;
      return true;
    } catch (e) {
      console.error('Save error:', e);
      return false;
    }
  },

  // ── File upload ──
  async uploadFile(file, onProgress) {
    const folderId = await this.ensureFolder();

    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [folderId]
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink`);
      xhr.setRequestHeader('Authorization', `Bearer ${Auth.token}`);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const f = JSON.parse(xhr.responseText);
          resolve(f);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  },

  // ── Get thumbnail/preview URL ──
  getThumbnailUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  },

  getViewUrl(fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  },

  getDirectUrl(fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  },

  // ── Delete file ──
  async deleteFile(fileId) {
    try {
      await fetch(`${DRIVE_API}/files/${fileId}`, {
        method: 'DELETE',
        headers: this._headers()
      });
      return true;
    } catch (e) {
      console.error('Delete error:', e);
      return false;
    }
  },

  // ── Share / make link shareable ──
  async makeShareable(fileId) {
    try {
      await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
      return `https://drive.google.com/file/d/${fileId}/view`;
    } catch (e) {
      console.error('Share error:', e);
      return null;
    }
  },

  // ── Share data file for viewer access ──
  async shareDataFile(dataFileId, email) {
    try {
      await fetch(`${DRIVE_API}/files/${dataFileId}/permissions`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ role: 'reader', type: 'user', emailAddress: email })
      });
      return true;
    } catch { return false; }
  }
};
