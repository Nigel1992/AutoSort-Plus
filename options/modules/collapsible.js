class CollapsibleManager {
  constructor() {
    this.sections = new Map();
  }

  async init() {
    const headers = document.querySelectorAll('.section-header');
    headers.forEach(header => {
      const sectionId = header.getAttribute('data-section');
      const content = document.getElementById(sectionId);
      const icon = header.querySelector('.collapse-icon');
      if (!content) return;

      this.sections.set(sectionId, { header, content, icon });

      header.addEventListener('click', () => {
        const section = header.parentElement;
        const collapsed = section.classList.contains('collapsed');
        this.toggle(sectionId, !collapsed);
      });
    });
  }

  async restoreState() {
    try {
      const { collapsedSections } = await browser.storage.local.get('collapsedSections');
      if (collapsedSections) {
        for (const sectionId of collapsedSections) {
          this.toggle(sectionId, true);
        }
      }
    } catch (e) {}
  }

  toggle(sectionId, collapsed) {
    const s = this.sections.get(sectionId);
    if (!s) return;
    const section = s.header.parentElement;

    if (collapsed) {
      section.classList.add('collapsed');
      s.content.style.display = 'none';
      s.icon.textContent = '▶';
    } else {
      section.classList.remove('collapsed');
      s.content.style.display = 'block';
      s.icon.textContent = '▼';
      setTimeout(() => { s.content.style.animation = 'slideDown 0.3s ease-out'; }, 0);
    }

    this.persistState();
  }

  async persistState() {
    const collapsed = [];
    for (const [id, s] of this.sections) {
      if (s.header.parentElement.classList.contains('collapsed')) collapsed.push(id);
    }
    await browser.storage.local.set({ collapsedSections: collapsed });
  }

  destroy() {}
}
