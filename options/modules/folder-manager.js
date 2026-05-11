class FolderManager {
  constructor() {
    this.loadedFolders = [];
    this._bindButtons();
  }

  _bindButtons() {
    const loadBtn = document.getElementById('load-imap-folders');
    if (loadBtn) loadBtn.addEventListener('click', () => this.loadFolders());

    const useImapBtn = document.getElementById('use-imap-folders');
    if (useImapBtn) useImapBtn.addEventListener('click', () => this.useLoadedFolders());

    const useCustomBtn = document.getElementById('use-custom-folders');
    if (useCustomBtn) useCustomBtn.addEventListener('click', () => { showMessage(i18n.get('addCustomFoldersMsg'), true); });

    const importBtn = document.getElementById('import-labels');
    if (importBtn) importBtn.addEventListener('click', () => this.bulkImport());
  }

  async loadFolders() {
    const indicator = document.getElementById('folder-loading');
    const selection = document.getElementById('folder-selection');
    if (indicator) indicator.style.display = 'block';
    if (selection) selection.style.display = 'none';
    try {
      const accounts = await browser.accounts.list();
      const allFolders = [];
      for (const account of accounts) {
        await this._collectFolders(account.rootFolder || account.folders, allFolders);
      }
      this.loadedFolders = [...new Set(allFolders.filter(f => !['Inbox', 'Trash', 'Drafts', 'Sent', 'Spam', 'Junk', 'Templates', 'Outbox', 'Archives'].includes(f)).map(f => f.replace(/^INBOX\./i, '').trim()))].sort();

      if (this.loadedFolders.length === 0) { showMessage(i18n.get('noFoldersFound'), false); return; }

      const countEl = document.getElementById('folder-count');
      const previewEl = document.getElementById('folders-preview');
      if (countEl) countEl.textContent = this.loadedFolders.length;
      if (previewEl) previewEl.innerHTML = this.loadedFolders.slice(0, 10).map(f => `<div class="folder-preview-item">${this._escHtml(f)}</div>`).join('') + (this.loadedFolders.length > 10 ? `<div class="folder-preview-item">…and ${this.loadedFolders.length - 10} more</div>` : '');
      if (selection) selection.style.display = 'block';
      showMessage(i18n.get('folderFoundText', [this.loadedFolders.length]), true);
    } catch (e) { showMessage(i18n.get('errorLoadingFolders', [e.message]), false); }
    finally { if (indicator) indicator.style.display = 'none'; }
  }

  useLoadedFolders() {
    if (!confirm(i18n.get('replaceFoldersConfirm', [this.loadedFolders.length]))) return;
    const container = document.getElementById('labels-container');
    if (container) {
      container.innerHTML = '';
      this.loadedFolders.forEach(f => {
        const item = document.createElement('div'); item.className = 'label-item';
        const input = document.createElement('input'); input.type = 'text'; input.className = 'label-input'; input.value = f;
        const remove = document.createElement('button'); remove.className = 'remove-label'; remove.textContent = '×';
        remove.addEventListener('click', () => { item.remove(); if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater(); });
        item.append(input, remove); container.appendChild(item);
      });
    }
    if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater();
    showMessage(i18n.get('loadedFoldersMsg', [this.loadedFolders.length]), true);
  }

  async bulkImport() {
    const textarea = document.getElementById('bulk-import-text');
    if (!textarea) return;
    const labels = textarea.value.trim().split('\n').map(l => l.trim()).filter(l => l !== '');
    if (labels.length === 0) { showMessage(i18n.get('importOneLabelRequired'), false); return; }

    const container = document.getElementById('labels-container');
    if (container) container.innerHTML = '';
    labels.forEach(label => {
      const item = document.createElement('div'); item.className = 'label-item';
      const input = document.createElement('input'); input.type = 'text'; input.className = 'label-input'; input.value = label;
      const remove = document.createElement('button'); remove.className = 'remove-label'; remove.textContent = '×';
      remove.addEventListener('click', () => { item.remove(); if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater(); });
      item.append(input, remove); container.appendChild(item);
    });
    textarea.value = '';
    if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater();
    showMessage(i18n.get('importedFoldersMsg', [labels.length]), true);
  }

  async _collectFolders(folderOrFolders, allFolders) {
    if (!folderOrFolders) return;
    const skipTypes = ['inbox', 'trash', 'sent', 'drafts', 'junk', 'templates', 'outbox', 'archives'];
    const processFolder = (folder) => {
      if (folder.type && !skipTypes.includes(folder.type)) allFolders.push(folder.name);
      if (folder.subFolders) { for (const sf of folder.subFolders) processFolder(sf); }
    };
    if (Array.isArray(folderOrFolders)) {
      for (const f of folderOrFolders) processFolder(f);
    } else {
      processFolder(folderOrFolders);
    }
  }

  _escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  getConfig() {
    const inputs = document.querySelectorAll('.label-input');
    const labels = Array.from(inputs).map(i => i.value.trim()).filter(l => l);
    return { labels };
  }

  setConfig(config) {
    if (config.labels) {
      this.loadedFolders = config.labels;
      const container = document.getElementById('labels-container');
      if (container) {
        container.innerHTML = '';
        config.labels.forEach(l => {
          const item = document.createElement('div'); item.className = 'label-item';
          const input = document.createElement('input'); input.type = 'text'; input.className = 'label-input'; input.value = l;
          const remove = document.createElement('button'); remove.className = 'remove-label'; remove.textContent = '×';
          remove.addEventListener('click', () => { item.remove(); if (window.AutoSortPlusSaveButtonUpdater) window.AutoSortPlusSaveButtonUpdater(); });
          item.append(input, remove); container.appendChild(item);
        });
      }
    }
  }

  validate() {
    const inputs = document.querySelectorAll('.label-input');
    const labels = Array.from(inputs).map(i => i.value.trim()).filter(l => l);
    return { valid: labels.length > 0, error: labels.length > 0 ? '' : 'At least one folder/label required' };
  }

  destroy() {}
}
