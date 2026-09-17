// ============================
// ANNOTATION ENGINE — glow + tooltip for characters, items, locations
// ============================
var AnnotationEngine = {
  enabled: true,
  _terms: [],
  _descMap: {},

  /** Initialize from localStorage */
  init() {
    const saved = localStorage.getItem('anno-enabled');
    if (saved !== null) this.enabled = saved === 'true';
    this._updateButton();
  },

  /** Rebuild term list from current game state */
  rebuildTerms() {
    const gs = GameEngine.state;
    if (!gs || !gs.gameStarted) { this._terms = []; this._descMap = {}; this._portraitMap = {}; return; }

    const seen = new Set();
    const terms = [];

    const add = (text, desc, portrait) => {
      if (!text || seen.has(text)) return;
      seen.add(text);
      terms.push({ text, desc: desc || text, portrait: portrait || null });
    };

    const p = gs.player;

    // Player name
    const playerBio = (gs.characterBios || []).find(c => c.role === 'protagonist' || c.name === p.name);
    add(p.name, '主角', playerBio?.portrait);

    // Relations
    Object.keys(p.relations || {}).forEach(name => {
      if (name === '_charDetails') return;
      const detail = p._charDetails?.[name];
      const desc = detail
        ? (detail.relation ? detail.relation + ' · ' : '') + (detail.background || '')
        : '人物';
      // 找对应 bio 取贴图
      const bio = (gs.characterBios || []).find(c => c.name === name);
      add(name, desc || '人物', bio?.portrait);
    });

    // Character bios
    (gs.characterBios || []).forEach(bio => {
      const desc = (bio.role ? bio.role + ' · ' : '') + (bio.bg || bio.background || '');
      add(bio.name, desc || '人物', bio.portrait);
      // Also add aliases if present (rare but handle it)
      if (bio.alias) add(bio.alias, '别名 · ' + bio.name, bio.portrait);
    });

    // Items
    (p.items || []).forEach(item => {
      add(item.name, item.desc || '物品');
    });

    // Skills
    (p.skills || []).forEach(skill => {
      add(skill.name, skill.desc || '技能');
    });

    // Locations — split by common delimiters
    if (gs.locations) {
      const locParts = gs.locations.split(/[\n,，;；、\u2022\-\u2014]+/).filter(Boolean);
      locParts.forEach(s => {
        const name = s.trim().substring(0, 12); // first 12 chars as location name
        if (name.length >= 2) add(name, '地点');
      });
    }

    // Factions
    if (gs.factions) {
      const facParts = gs.factions.split(/[\n,，;；、\u2022\-\u2014]+/).filter(Boolean);
      facParts.forEach(s => {
        const name = s.trim().substring(0, 12);
        if (name.length >= 2) add(name, '势力');
      });
    }

    // Sort by length descending (greedy match: longest first)
    terms.sort((a, b) => b.text.length - a.text.length);

    // Build lookup map
    this._terms = terms;
    this._descMap = {};
    this._portraitMap = {};
    terms.forEach(t => {
      this._descMap[t.text] = t.desc;
      if (t.portrait) this._portraitMap[t.text] = t.portrait;
    });
  },

  /**
   * Annotate raw text: wrap known terms in glow spans.
   * Returns annotated raw text (still with \n separators, not HTML) or original if disabled.
   */
  annotate(rawText) {
    if (!this.enabled || this._terms.length === 0) return rawText;

    const escaped = this._terms.map(t => ({
      text: t.text,
      desc: t.desc,
      portrait: t.portrait,
      _re: new RegExp(escapeRegex(t.text), 'g'),
    }));

    let result = rawText;
    escaped.forEach(({ text, desc, portrait, _re }) => {
      _re.lastIndex = 0;
      result = result.replace(_re, (match) => {
        const descEsc = escapeHTML(desc);
        if (portrait) {
          // 带贴图的注释：用占位 div + data 属性，hover 时显示贴图弹窗
          const portraitEsc = portrait.replace(/"/g, '&quot;');
          return `<span class="glow-annotation has-portrait" data-type="anno" data-desc="${descEsc}" data-portrait="${portraitEsc}">${escapeHTML(match)}<span class="anno-portrait-popup">${portrait}</span></span>`;
        }
        return `<span class="glow-annotation" data-type="anno" data-desc="${descEsc}">${escapeHTML(match)}</span>`;
      });
    });
    return result;
  },

  /** Toggle annotations on/off */
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('anno-enabled', String(this.enabled));
    this._updateButton();
    UIManager.toast(this.enabled ? '注释已开启 — 人物/道具/地点将发光标注' : '注释已关闭', 'info');
    // Re-render current story content
    this._rerenderStory();
  },

  _updateButton() {
    const btn = document.getElementById('anno-toggle-btn');
    if (btn) {
      btn.textContent = this.enabled ? '💡 注释开' : '💡 注释关';
      btn.title = this.enabled ? '点击关闭注释' : '点击开启注释';
    }
  },

  /** Re-render existing story content with/without annotations */
  _rerenderStory() {
    const gs = GameEngine.state;
    if (!gs || !gs.storyLog) return;
    const storyDiv = document.getElementById('story-content');
    if (!storyDiv) return;

    const children = [...storyDiv.children];
    // Walk children and match them to storyLog entries
    let logIdx = 0;
    children.forEach(child => {
      // Skip non-narrative elements (separators, system messages, choices, etc.)
      // Find matching narrative entries
      while (logIdx < gs.storyLog.length && gs.storyLog[logIdx].type !== 'narrative') {
        logIdx++;
      }
      if (logIdx >= gs.storyLog.length) return;

      const raw = gs.storyLog[logIdx].content;
      if (!raw) { logIdx++; return; }

      // If child is a wrapper div (from typewriter), replace its inner HTML
      // The structure from Typewriter is: div.fade-in > hr.separator + p...
      if (child.classList && child.classList.contains('fade-in')) {
        if (this.enabled) {
          const annotated = this.annotate(raw);
          const paras = annotated.split('\n\n').filter(p => p.trim() !== '');
          child.innerHTML = `<hr class="separator">${paras.map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('')}`;
        } else {
          const paras = raw.split('\n\n').filter(p => p.trim() !== '');
          child.innerHTML = `<hr class="separator">${paras.map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('')}`;
        }
      }
      logIdx++;
    });
  }
};

/** Escape regex special characters */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Escape HTML entities */
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  AnnotationEngine.init();
});
// ── 确保 AnnotationEngine 在 onclick 中可访问（const 不挂 window）──
window.AnnotationEngine = AnnotationEngine;
