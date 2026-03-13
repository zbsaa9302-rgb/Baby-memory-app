// ── UI Controller ──
window.UI = {
  appData: null,
  activeChildId: null,
  activeFilter: 'all',
  searchQuery: '',
  editingMemory: null,
  viewingMemory: null,
  pendingFiles: [],
  isOwner: false,

  // ── Init ──
  async init() {
    this.applyTheme(localStorage.getItem('ayat_theme') || 'warm');
    this.applyFont(localStorage.getItem('ayat_font') || 'playfair');

    document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
    document.getElementById('fab').addEventListener('click', () => this.openAddMemory());
    document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
    document.getElementById('search-input').addEventListener('input', e => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderGrid();
    });

    this.bindSheetCloses();
  },

  // ── Auth ──
  async handleLogin() {
    const btn = document.getElementById('login-btn');
    btn.textContent = 'Signing in…';
    btn.disabled = true;
    try {
      await Auth.signIn();
      await this.loadApp();
    } catch (e) {
      btn.textContent = 'Continue with Google';
      btn.disabled = false;
      this.toast('Sign-in failed. Please try again.');
    }
  },

  async loadApp() {
    this.showScreen('loading-screen');
    this.appData = await Drive.loadData();

    // Set owner
    if (!this.appData.owner) {
      this.appData.owner = Auth.user.id;
      this.appData.ownerEmail = Auth.user.email;
      this.appData.ownerName = Auth.user.name;
      await Drive.saveData(this.appData);
    }
    this.isOwner = Auth.user.id === this.appData.owner;

    // Active child
    this.activeChildId = this.appData.children[0]?.id || null;

    // Apply saved settings
    if (this.appData.settings?.theme) this.applyTheme(this.appData.settings.theme);
    if (this.appData.settings?.font) this.applyFont(this.appData.settings.font);

    this.renderApp();
    this.showScreen('main-screen');
  },

  // ── Screens ──
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  },

  // ── Render main app ──
  renderApp() {
    this.renderNavUser();
    this.renderChildTabs();
    this.renderChildBanner();
    this.renderStats();
    this.renderGrid();
    if (!this.isOwner) document.getElementById('fab').style.display = 'none';
  },

  renderNavUser() {
    const el = document.getElementById('nav-avatar');
    if (Auth.user?.picture) {
      el.innerHTML = `<img src="${Auth.user.picture}" alt="">`;
    } else {
      el.textContent = (Auth.user?.name || 'U')[0].toUpperCase();
    }
    el.onclick = () => this.openSettings();
  },

  renderChildTabs() {
    const wrap = document.getElementById('child-tabs');
    wrap.innerHTML = '';
    this.appData.children.forEach(child => {
      const tab = document.createElement('div');
      tab.className = 'child-tab' + (child.id === this.activeChildId ? ' active' : '');
      tab.innerHTML = `
        <div class="child-tab-avatar">${child.coverFileId
          ? `<img src="${Drive.getThumbnailUrl(child.coverFileId)}" alt="">`
          : child.emoji || '👶'}</div>
        ${child.name}
      `;
      tab.onclick = () => { this.activeChildId = child.id; this.renderApp(); };
      wrap.appendChild(tab);
    });

    if (this.isOwner) {
      const addBtn = document.createElement('button');
      addBtn.className = 'add-child-tab';
      addBtn.textContent = '+';
      addBtn.title = 'Add child';
      addBtn.onclick = () => this.openAddChild();
      wrap.appendChild(addBtn);
    }
  },

  renderChildBanner() {
    const child = this.appData.children.find(c => c.id === this.activeChildId);
    if (!child) return;
    const banner = document.getElementById('child-banner');
    banner.style.background = `linear-gradient(160deg, ${child.coverColor || '#fae8d8'}, var(--bg))`;

    const img = banner.querySelector('img');
    if (child.coverFileId) {
      img.src = Drive.getDirectUrl(child.coverFileId);
      img.style.display = '';
    } else {
      img.style.display = 'none';
    }

    document.getElementById('child-banner-name').textContent = child.name + "'s Memory Book";
    const editBtn = document.getElementById('child-banner-edit');
    if (this.isOwner) {
      editBtn.style.display = '';
      editBtn.onclick = () => this.openEditChild(child);
    } else {
      editBtn.style.display = 'none';
    }
  },

  renderStats() {
    const mems = this.appData.memories.filter(m => m.childId === this.activeChildId);
    const withMedia = mems.filter(m => m.files?.length > 0).length;
    const milestones = mems.filter(m => m.tag === 'milestone').length;

    document.getElementById('stat-memories').textContent = mems.length;
    document.getElementById('stat-media').textContent = withMedia;
    document.getElementById('stat-milestones').textContent = milestones;
  },

  getFilteredMemories() {
    return this.appData.memories.filter(m => {
      if (m.childId !== this.activeChildId) return false;
      if (this.activeFilter !== 'all' && m.tag !== this.activeFilter) return false;
      if (this.searchQuery) {
        const q = this.searchQuery;
        return m.title?.toLowerCase().includes(q) || m.note?.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  renderGrid() {
    const grid = document.getElementById('memory-grid');
    const mems = this.getFilteredMemories();
    if (mems.length === 0) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <div class="empty-icon">🌸</div>
          <div class="empty-title">No memories yet</div>
          <div class="empty-sub">${this.isOwner ? 'Tap + to add your first memory' : 'Check back soon!'}</div>
        </div>`;
      return;
    }
    grid.innerHTML = mems.map((m, i) => this.memoryCardHTML(m, i)).join('');
    grid.querySelectorAll('.memory-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.viewMemory(this.appData.memories.find(m => m.id === id));
      });
    });
  },

  memoryCardHTML(m, i) {
    const thumb = m.files?.[0];
    let mediaHTML;
    if (thumb) {
      if (thumb.mimeType?.startsWith('video/')) {
        mediaHTML = `<div class="card-media" style="background:#111"><span>🎬</span></div>`;
      } else if (thumb.mimeType?.startsWith('image/')) {
        mediaHTML = `<div class="card-media"><img src="${Drive.getThumbnailUrl(thumb.fileId)}" loading="lazy" alt=""></div>`;
      } else {
        mediaHTML = `<div class="card-media"><span>📎</span></div>`;
      }
    } else {
      const emojis = { milestone:'🏆', everyday:'☀️', funny:'😄', love:'💕', growth:'🌱' };
      mediaHTML = `<div class="card-media" style="background:${m.color||'var(--bg2)'}"><span style="font-size:42px">${emojis[m.tag]||'🌸'}</span></div>`;
    }
    const countBadge = m.files?.length > 1 ? `<span class="card-media-count">${m.files.length} 📷</span>` : '';
    const tagColors = { milestone:'#e8845a', everyday:'#5a84e8', funny:'#845ae8', love:'#e85a84', growth:'#5ae884' };
    const tagColor = tagColors[m.tag] || 'var(--accent)';

    return `<div class="memory-card" data-id="${m.id}" style="animation-delay:${i * 0.04}s">
      <div style="position:relative">${mediaHTML}${countBadge}</div>
      <div class="card-body">
        <div class="card-tag" style="background:${tagColor}22;color:${tagColor}">
          <span style="width:5px;height:5px;border-radius:50%;background:${tagColor};display:inline-block"></span>
          ${m.tag}
        </div>
        <div class="card-title">${m.title}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="card-date">${this.formatDate(m.date)}</div>
          ${m.age ? `<div class="card-age">· ${m.age}</div>` : ''}
        </div>
      </div>
    </div>`;
  },

  // ── View Memory ──
  viewMemory(mem) {
    this.viewingMemory = mem;
    const sheet = document.getElementById('detail-sheet');
    this.populateDetail(mem);
    this.openOverlay('detail-overlay');
  },

  populateDetail(mem) {
    const heroWrap = document.getElementById('detail-hero-wrap');
    const scrollWrap = document.getElementById('detail-media-scroll');

    // Hero
    if (mem.files?.length > 0) {
      this.setDetailHero(mem.files[0], mem);
    } else {
      heroWrap.innerHTML = `<div class="detail-hero" style="background:${mem.color||'var(--bg2)'}"><span>🌸</span></div>`;
    }

    // Thumbnails
    scrollWrap.innerHTML = '';
    if (mem.files?.length > 1) {
      scrollWrap.style.display = '';
      mem.files.forEach((f, i) => {
        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        const thumb = document.createElement('div');
        thumb.className = 'detail-media-thumb' + (i === 0 ? ' active' : '');
        if (f.mimeType?.startsWith('image/')) {
          thumb.innerHTML = `<img src="${Drive.getThumbnailUrl(f.fileId)}" loading="lazy">`;
        } else if (f.mimeType?.startsWith('video/')) {
          thumb.innerHTML = '🎬';
        } else {
          thumb.innerHTML = '📎';
        }
        thumb.onclick = () => {
          scrollWrap.querySelectorAll('.detail-media-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          this.setDetailHero(f, mem);
        };
        wrap.appendChild(thumb);

        if (this.isOwner) {
          const del = document.createElement('button');
          del.className = 'detail-media-del';
          del.textContent = '×';
          del.onclick = (e) => { e.stopPropagation(); this.deleteMedia(mem, i); };
          wrap.appendChild(del);
        }
        scrollWrap.appendChild(wrap);
      });
    } else {
      scrollWrap.style.display = 'none';
    }

    // Info
    const tagColors = { milestone:'#e8845a', everyday:'#5a84e8', funny:'#845ae8', love:'#e85a84', growth:'#5ae884' };
    const tc = tagColors[mem.tag] || 'var(--accent)';
    document.getElementById('detail-tag').innerHTML = `
      <span class="card-tag" style="background:${tc}22;color:${tc}">
        <span style="width:5px;height:5px;border-radius:50%;background:${tc};display:inline-block"></span>
        ${mem.tag}
      </span>`;
    document.getElementById('detail-title').textContent = mem.title;
    document.getElementById('detail-date').textContent = this.formatDate(mem.date);
    document.getElementById('detail-age').textContent = mem.age ? `· ${mem.age}` : '';
    document.getElementById('detail-note').textContent = mem.note || '';

    // Action buttons
    const actions = document.getElementById('detail-actions');
    actions.innerHTML = '';
    if (this.isOwner) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-ghost';
      editBtn.innerHTML = '✏️ Edit';
      editBtn.onclick = () => { this.closeOverlay('detail-overlay'); this.openEditMemory(mem); };
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.innerHTML = '🗑️ Delete';
      delBtn.onclick = () => this.confirmDeleteMemory(mem);
      actions.appendChild(delBtn);
    }
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-primary';
    shareBtn.innerHTML = '↑ Share';
    shareBtn.onclick = () => this.openShareMemory(mem);
    actions.appendChild(shareBtn);
  },

  setDetailHero(file, mem) {
    const heroWrap = document.getElementById('detail-hero-wrap');
    if (file.mimeType?.startsWith('image/')) {
      heroWrap.innerHTML = `<img class="detail-hero" src="${Drive.getDirectUrl(file.fileId)}" onclick="UI.openMediaViewer('${file.fileId}','image')">`;
    } else if (file.mimeType?.startsWith('video/')) {
      heroWrap.innerHTML = `<video class="detail-hero" src="${Drive.getDirectUrl(file.fileId)}" controls></video>`;
    } else {
      heroWrap.innerHTML = `<div class="detail-hero" style="background:${mem.color||'var(--bg2)'}"><span style="font-size:48px">📎</span></div>`;
    }
  },

  openMediaViewer(fileId, type) {
    const viewer = document.getElementById('media-viewer');
    viewer.classList.add('open');
    const inner = document.getElementById('media-viewer-inner');
    if (type === 'image') {
      inner.innerHTML = `<img src="${Drive.getDirectUrl(fileId)}" alt="">`;
    }
  },

  // ── Add / Edit Memory ──
  openAddMemory() {
    this.editingMemory = null;
    this.pendingFiles = [];
    this.resetMemoryForm();
    document.getElementById('memory-sheet-title').textContent = 'New Memory ✨';
    document.getElementById('delete-memory-btn').style.display = 'none';
    this.openOverlay('memory-overlay');
  },

  openEditMemory(mem) {
    this.editingMemory = mem;
    this.pendingFiles = mem.files ? [...mem.files] : [];
    this.fillMemoryForm(mem);
    document.getElementById('memory-sheet-title').textContent = 'Edit Memory';
    document.getElementById('delete-memory-btn').style.display = '';
    this.openOverlay('memory-overlay');
  },

  resetMemoryForm() {
    document.getElementById('mem-title').value = '';
    document.getElementById('mem-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('mem-age').value = '';
    document.getElementById('mem-note').value = '';
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('sel', b.dataset.tag === 'milestone'));
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('sel', d.dataset.color === '#fde8d8'));
    this.renderThumbGrid();
  },

  fillMemoryForm(mem) {
    document.getElementById('mem-title').value = mem.title || '';
    document.getElementById('mem-date').value = mem.date || '';
    document.getElementById('mem-age').value = mem.age || '';
    document.getElementById('mem-note').value = mem.note || '';
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('sel', b.dataset.tag === mem.tag));
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('sel', d.dataset.color === mem.color));
    this.renderThumbGrid();
  },

  renderThumbGrid() {
    const grid = document.getElementById('thumb-grid');
    grid.innerHTML = '';
    this.pendingFiles.forEach((f, i) => {
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      if (f.fileId) {
        if (f.mimeType?.startsWith('image/')) {
          thumb.innerHTML = `<img src="${Drive.getThumbnailUrl(f.fileId)}" alt="">`;
        } else if (f.mimeType?.startsWith('video/')) {
          thumb.textContent = '🎬';
        } else {
          thumb.textContent = '📎';
        }
      } else if (f._preview) {
        thumb.innerHTML = `<img src="${f._preview}" alt="">`;
      } else if (f._file?.type?.startsWith('video/')) {
        thumb.textContent = '🎬';
      } else {
        thumb.textContent = '📎';
      }
      const del = document.createElement('button');
      del.className = 'thumb-del';
      del.textContent = '×';
      del.onclick = () => { this.pendingFiles.splice(i, 1); this.renderThumbGrid(); };
      wrap.appendChild(thumb);
      wrap.appendChild(del);
      grid.appendChild(wrap);
    });
  },

  handleFileSelect(input) {
    Array.from(input.files).forEach(file => {
      const entry = { _file: file, _name: file.name, _type: file.type };
      if (file.type.startsWith('image/')) {
        entry._preview = URL.createObjectURL(file);
      }
      this.pendingFiles.push(entry);
    });
    this.renderThumbGrid();
    input.value = '';
  },

  async saveMemory() {
    const title = document.getElementById('mem-title').value.trim();
    const note = document.getElementById('mem-note').value.trim();
    if (!title) { this.toast('Please add a title'); return; }

    const saveBtn = document.getElementById('save-memory-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const tag = document.querySelector('.tag-btn.sel')?.dataset.tag || 'milestone';
    const color = document.querySelector('.color-dot.sel')?.dataset.color || '#fde8d8';
    const date = document.getElementById('mem-date').value;
    const age = document.getElementById('mem-age').value.trim();

    // Upload new files
    const progressWrap = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-bar');
    const newFilesRaw = this.pendingFiles.filter(f => f._file);
    const existingFiles = this.pendingFiles.filter(f => f.fileId);
    const uploadedFiles = [...existingFiles];

    if (newFilesRaw.length > 0) {
      progressWrap.style.display = '';
      for (let i = 0; i < newFilesRaw.length; i++) {
        const f = newFilesRaw[i];
        const uploaded = await Drive.uploadFile(f._file, pct => {
          const overall = ((i / newFilesRaw.length) + pct / 100 / newFilesRaw.length) * 100;
          progressBar.style.width = overall + '%';
        });
        uploadedFiles.push({
          fileId: uploaded.id,
          name: uploaded.name,
          mimeType: uploaded.mimeType,
          viewLink: uploaded.webViewLink
        });
      }
      progressWrap.style.display = 'none';
    }

    if (this.editingMemory) {
      const idx = this.appData.memories.findIndex(m => m.id === this.editingMemory.id);
      if (idx >= 0) {
        this.appData.memories[idx] = {
          ...this.editingMemory,
          title, note, tag, color, date, age,
          files: uploadedFiles,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      this.appData.memories.push({
        id: 'mem_' + Date.now(),
        childId: this.activeChildId,
        title, note, tag, color, date, age,
        files: uploadedFiles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    await Drive.saveData(this.appData);
    this.closeOverlay('memory-overlay');
    this.renderApp();
    this.toast(this.editingMemory ? 'Memory updated ✨' : 'Memory saved 🌸');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Memory ✨';
  },

  // ── Delete ──
  confirmDeleteMemory(mem) {
    this.closeOverlay('detail-overlay');
    const box = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = 'Delete this memory?';
    document.getElementById('confirm-msg').textContent = `"${mem.title}" will be permanently deleted, along with all its media.`;
    document.getElementById('confirm-ok').onclick = async () => {
      box.classList.remove('open');
      // Delete files from drive
      for (const f of (mem.files || [])) {
        await Drive.deleteFile(f.fileId);
      }
      this.appData.memories = this.appData.memories.filter(m => m.id !== mem.id);
      await Drive.saveData(this.appData);
      this.renderApp();
      this.toast('Memory deleted');
    };
    document.getElementById('confirm-cancel').onclick = () => box.classList.remove('open');
    box.classList.add('open');
  },

  async deleteMedia(mem, index) {
    const file = mem.files[index];
    await Drive.deleteFile(file.fileId);
    mem.files.splice(index, 1);
    await Drive.saveData(this.appData);
    this.populateDetail(mem);
    this.renderGrid();
    this.toast('Media deleted');
  },

  // ── Share ──
  openShareMemory(mem) {
    document.getElementById('share-sheet-title').textContent = `Share "${mem.title}"`;
    const opts = document.getElementById('share-options');
    opts.innerHTML = `
      <div class="share-opt" id="share-link-opt"><div class="share-opt-icon">🔗</div><div class="share-opt-label">Copy Link</div></div>
      <div class="share-opt" id="share-msg-opt"><div class="share-opt-icon">💬</div><div class="share-opt-label">Message</div></div>
      <div class="share-opt" id="share-whatsapp-opt"><div class="share-opt-icon">📱</div><div class="share-opt-label">WhatsApp</div></div>
    `;

    const shareUrl = `${location.origin}${location.pathname}?share=${mem.id}&owner=${this.appData.owner}`;

    document.getElementById('share-link-opt').onclick = async () => {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      this.toast('Link copied! 🔗');
    };
    document.getElementById('share-msg-opt').onclick = () => {
      window.open(`sms:?body=Check out this memory: ${shareUrl}`);
    };
    document.getElementById('share-whatsapp-opt').onclick = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this memory from Ayat's Memory Book: ${shareUrl}`)}`);
    };

    // Media sharing row
    if (mem.files?.length > 0) {
      const mediaTitle = document.createElement('div');
      mediaTitle.style.cssText = 'font-size:13px;color:var(--text2);margin-top:16px;margin-bottom:10px;font-family:var(--font-body)';
      mediaTitle.textContent = 'Share individual photos/videos:';
      opts.appendChild(mediaTitle);

      const mediaRow = document.createElement('div');
      mediaRow.style.cssText = 'display:flex;gap:10px;overflow-x:auto;padding-bottom:4px';
      mem.files.forEach(f => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex-shrink:0;cursor:pointer;text-align:center';
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        thumb.style.cssText = 'width:64px;height:64px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px';
        if (f.mimeType?.startsWith('image/')) {
          thumb.innerHTML = `<img src="${Drive.getThumbnailUrl(f.fileId)}" style="width:100%;height:100%;object-fit:cover">`;
        } else {
          thumb.textContent = f.mimeType?.startsWith('video/') ? '🎬' : '📎';
        }
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px;color:var(--text3);margin-top:4px;font-family:var(--font-body)';
        lbl.textContent = 'Tap to share';
        wrap.appendChild(thumb);
        wrap.appendChild(lbl);
        wrap.onclick = async () => {
          const url = await Drive.makeShareable(f.fileId);
          if (url) {
            await navigator.clipboard.writeText(url).catch(() => {});
            this.toast('Media link copied! 📷');
          }
        };
        mediaRow.appendChild(wrap);
      });
      opts.appendChild(mediaRow);
    }

    this.openOverlay('share-overlay');
  },

  // ── Add/Edit Child ──
  openAddChild() {
    document.getElementById('child-sheet-title').textContent = 'Add Child';
    document.getElementById('child-name-input').value = '';
    document.getElementById('child-emoji-input').value = '👶';
    document.getElementById('child-color-input').value = '#fde8d8';
    document.getElementById('child-cover-preview').innerHTML = '';
    this._editingChild = null;
    this._childCoverFile = null;
    this.openOverlay('child-overlay');
  },

  openEditChild(child) {
    document.getElementById('child-sheet-title').textContent = 'Edit ' + child.name;
    document.getElementById('child-name-input').value = child.name;
    document.getElementById('child-emoji-input').value = child.emoji || '👶';
    document.getElementById('child-color-input').value = child.coverColor || '#fde8d8';
    if (child.coverFileId) {
      document.getElementById('child-cover-preview').innerHTML = `<img src="${Drive.getDirectUrl(child.coverFileId)}" style="width:100%;height:120px;object-fit:cover;border-radius:12px;margin-top:8px">`;
    } else {
      document.getElementById('child-cover-preview').innerHTML = '';
    }
    this._editingChild = child;
    this._childCoverFile = null;
    this.openOverlay('child-overlay');
  },

  handleChildCoverSelect(input) {
    const file = input.files[0];
    if (!file) return;
    this._childCoverFile = file;
    const preview = URL.createObjectURL(file);
    document.getElementById('child-cover-preview').innerHTML = `<img src="${preview}" style="width:100%;height:120px;object-fit:cover;border-radius:12px;margin-top:8px">`;
  },

  async saveChild() {
    const name = document.getElementById('child-name-input').value.trim();
    if (!name) { this.toast('Please enter a name'); return; }

    const btn = document.getElementById('save-child-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const emoji = document.getElementById('child-emoji-input').value || '👶';
    const coverColor = document.getElementById('child-color-input').value;

    let coverFileId = this._editingChild?.coverFileId || null;
    if (this._childCoverFile) {
      const uploaded = await Drive.uploadFile(this._childCoverFile, () => {});
      coverFileId = uploaded.id;
    }

    if (this._editingChild) {
      const idx = this.appData.children.findIndex(c => c.id === this._editingChild.id);
      if (idx >= 0) {
        this.appData.children[idx] = { ...this.appData.children[idx], name, emoji, coverColor, coverFileId };
      }
    } else {
      this.appData.children.push({
        id: 'child_' + Date.now(),
        name, emoji, coverColor, coverFileId,
        createdAt: new Date().toISOString()
      });
    }

    await Drive.saveData(this.appData);
    this.closeOverlay('child-overlay');
    this.renderApp();
    this.toast('Saved! 🌸');
    btn.disabled = false; btn.textContent = 'Save';
  },

  // ── Settings ──
  openSettings() {
    this.renderInviteList();
    document.getElementById('settings-user-name').textContent = Auth.user?.name || '';
    document.getElementById('settings-user-email').textContent = Auth.user?.email || '';
    if (Auth.user?.picture) {
      document.getElementById('settings-avatar').innerHTML = `<img src="${Auth.user.picture}" alt="">`;
    } else {
      document.getElementById('settings-avatar').textContent = (Auth.user?.name || 'U')[0];
    }

    // Mark active theme/font
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === (this.appData.settings?.theme || 'warm'));
    });
    document.querySelectorAll('.font-card').forEach(c => {
      c.classList.toggle('active', c.dataset.font === (this.appData.settings?.font || 'playfair'));
    });

    document.getElementById('signout-btn').onclick = () => {
      Auth.signOut();
      this.showScreen('login-screen');
      document.getElementById('login-btn').textContent = 'Continue with Google';
      document.getElementById('login-btn').disabled = false;
    };

    this.openOverlay('settings-overlay');
  },

  renderInviteList() {
    const list = document.getElementById('invite-list');
    const invites = this.appData.invites || [];
    if (invites.length === 0) {
      list.innerHTML = `<div style="font-size:13px;color:var(--text3);font-style:italic;padding:8px 0">No viewers yet</div>`;
      return;
    }
    list.innerHTML = invites.map(inv => `
      <div class="invite-item">
        <div class="invite-avatar">${(inv.name || inv.email)[0].toUpperCase()}</div>
        <div class="invite-info">
          <div class="invite-name">${inv.name || inv.email}</div>
          <div class="invite-email">${inv.email}</div>
        </div>
        <div class="invite-role">viewer</div>
        ${this.isOwner ? `<button onclick="UI.removeInvite('${inv.email}')" style="background:transparent;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:4px">×</button>` : ''}
      </div>`).join('');
  },

  async sendInvite() {
    const email = document.getElementById('invite-email').value.trim();
    if (!email || !email.includes('@')) { this.toast('Enter a valid email'); return; }

    const btn = document.getElementById('invite-btn');
    btn.disabled = true; btn.textContent = 'Sending…';

    // Share data file
    if (this.appData.dataFileId) {
      await Drive.shareDataFile(this.appData.dataFileId, email);
    }

    // Add to invites list
    if (!this.appData.invites) this.appData.invites = [];
    if (!this.appData.invites.find(i => i.email === email)) {
      this.appData.invites.push({ email, addedAt: new Date().toISOString() });
      await Drive.saveData(this.appData);
    }

    document.getElementById('invite-email').value = '';
    this.renderInviteList();
    this.toast(`Invite sent to ${email} 📨`);
    btn.disabled = false; btn.textContent = 'Send Invite';
  },

  async removeInvite(email) {
    this.appData.invites = this.appData.invites.filter(i => i.email !== email);
    await Drive.saveData(this.appData);
    this.renderInviteList();
    this.toast('Viewer removed');
  },

  // ── Theme / Font ──
  applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ayat_theme', theme);
    if (this.appData?.settings) {
      this.appData.settings.theme = theme;
    }
  },

  applyFont(font) {
    document.documentElement.dataset.font = font;
    localStorage.setItem('ayat_font', font);
    if (this.appData?.settings) {
      this.appData.settings.font = font;
    }
  },

  async changeTheme(theme) {
    this.applyTheme(theme);
    document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === theme));
    if (this.appData) await Drive.saveData(this.appData);
  },

  async changeFont(font) {
    this.applyFont(font);
    document.querySelectorAll('.font-card').forEach(c => c.classList.toggle('active', c.dataset.font === font));
    if (this.appData) await Drive.saveData(this.appData);
  },

  // ── Filter pills ──
  setFilter(tag) {
    this.activeFilter = tag;
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.tag === tag || (tag === 'all' && p.dataset.tag === 'all'));
    });
    this.renderGrid();
  },

  // ── Overlay helpers ──
  bindSheetCloses() {
    document.querySelectorAll('.overlay').forEach(ov => {
      ov.addEventListener('click', e => {
        if (e.target === ov) this.closeOverlay(ov.id);
      });
    });
    document.querySelectorAll('.sheet-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const ov = btn.closest('.overlay');
        if (ov) this.closeOverlay(ov.id);
      });
    });
    // Media viewer
    document.getElementById('media-viewer-close').onclick = () => {
      document.getElementById('media-viewer').classList.remove('open');
    };
    // Confirm cancel
    document.getElementById('confirm-cancel').onclick = () => {
      document.getElementById('confirm-overlay').classList.remove('open');
    };
  },

  openOverlay(id) { document.getElementById(id).classList.add('open'); },
  closeOverlay(id) { document.getElementById(id).classList.remove('open'); },

  // ── Utilities ──
  formatDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },

  toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
};
