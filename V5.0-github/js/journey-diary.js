// ============================
// JOURNEY DIARY — 旅途日记侧栏
// v3.5 新增，基于 storyLog / player.history / chapterSummaries 渲染时间线
// ============================
var JourneyDiary = {
  _open: false,
  _tab: 'timeline', // timeline | choices | items

  init() {
    // 顶栏按钮已在 HTML 中，绑定事件
    const btn = document.getElementById('btn-journey-diary');
    if (btn) btn.onclick = () => this.toggle();
  },

  toggle() {
    this._open = !this._open;
    const panel = document.getElementById('journey-diary-panel');
    if (!panel) return;
    if (this._open) {
      this.render();
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  },

  close() {
    this._open = false;
    const panel = document.getElementById('journey-diary-panel');
    if (panel) panel.classList.add('hidden');
  },

  switchTab(tab) {
    this._tab = tab;
    // Update tab buttons
    document.querySelectorAll('.jd-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    this.renderContent();
  },

  render() {
    const content = document.getElementById('jd-content');
    if (content) this.renderContent(content);
  },

  renderContent(container) {
    const el = container || document.getElementById('jd-content');
    if (!el) return;
    const gs = GameEngine.state;

    switch (this._tab) {
      case 'timeline': this._renderTimeline(el, gs); break;
      case 'choices': this._renderChoices(el, gs); break;
      case 'items': this._renderItems(el, gs); break;
    }
  },

  // ── 时间线（章节 + 摘要） ──
  _renderTimeline(el, gs) {
    const summaries = gs.chapterSummaries || [];
    const p = gs.player;

    let html = `<div class="jd-stats">`;
    html += `<div class="jd-stat"><span class="jd-stat-label">章节</span><span class="jd-stat-value">${gs.chapter}</span></div>`;
    html += `<div class="jd-stat"><span class="jd-stat-label">场景</span><span class="jd-stat-value">${gs.scene}</span></div>`;
    html += `<div class="jd-stat"><span class="jd-stat-label">天数</span><span class="jd-stat-value">${gs.days || 1}</span></div>`;
    html += `<div class="jd-stat"><span class="jd-stat-label">总字数</span><span class="jd-stat-value">${(gs.milestones?.totalWords || 0).toLocaleString()}</span></div>`;
    html += `<div class="jd-stat"><span class="jd-stat-label">抉择次数</span><span class="jd-stat-value">${gs.milestones?.choicesMade || 0}</span></div>`;
    html += `</div>`;

    if (summaries.length === 0) {
      html += `<div class="jd-empty">旅途尚未开始…</div>`;
      el.innerHTML = html;
      return;
    }

    html += `<div class="jd-timeline">`;
    let lastChapter = 0;
    for (const s of summaries) {
      if (s.chapter !== lastChapter) {
        if (lastChapter > 0) html += `</div>`; // close previous chapter group
        lastChapter = s.chapter;
        html += `<div class="jd-chapter-group">`;
        html += `<div class="jd-chapter-marker">第${s.chapter}章</div>`;
      }
      html += `<div class="jd-entry" title="${s.summary || ''}">`;
      html += `<div class="jd-entry-dot"></div>`;
      html += `<div class="jd-entry-content">`;
      html += `<div class="jd-entry-scene">第${s.scene}节</div>`;
      html += `<div class="jd-entry-summary">${this._escapeHTML(s.summary || '(无摘要)')}</div>`;
      html += `</div></div>`;
    }
    if (lastChapter > 0) html += `</div>`;
    html += `</div>`;

    el.innerHTML = html;
  },

  // ── 抉择记录 ──
  _renderChoices(el, gs) {
    const history = gs.player.history || [];

    if (history.length === 0) {
      el.innerHTML = `<div class="jd-empty">尚未做出任何抉择…</div>`;
      return;
    }

    let html = `<div class="jd-choice-list">`;
    for (const h of history) {
      const isCustom = h.choice.startsWith('[自定义]');
      const healthColor = this._healthColor(h.playerState?.health);
      html += `<div class="jd-choice-entry">`;
      html += `<div class="jd-choice-header">`;
      html += `<span class="jd-choice-chapter">第${h.chapter}章·第${h.scene}节</span>`;
      if (h.playerState) {
        html += `<span class="jd-choice-state" style="color:${healthColor}">${h.playerState.health || ''}</span>`;
      }
      html += `</div>`;
      html += `<div class="jd-choice-text">${isCustom ? '<span class="jd-custom-tag">自定义</span>' : ''}${this._escapeHTML(h.choice)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    el.innerHTML = html;
  },

  // ── 道具获取记录 ──
  _renderItems(el, gs) {
    const p = gs.player;
    const items = InventorySystem ? InventorySystem.getBagItems(p) : (p.items || []);

    if (items.length === 0) {
      el.innerHTML = `<div class="jd-empty">背包空空如也…</div>`;
      return;
    }

    let html = `<div class="jd-items-grid">`;
    for (const it of items) {
      if (it.qty <= 0) continue;
      html += `<div class="jd-item-card" title="${this._escapeHTML(it.desc || '')}">`;
      html += `<div class="jd-item-emoji">${it.emoji || '📦'}</div>`;
      html += `<div class="jd-item-name">${this._escapeHTML(it.name)}</div>`;
      html += `<div class="jd-item-qty">x${it.qty}</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    // 装备区
    const equipped = InventorySystem ? InventorySystem.getEquipped(p) : {};
    const eqEntries = Object.entries(equipped).filter(([, v]) => v);
    if (eqEntries.length > 0) {
      html += `<div class="jd-equipped">`;
      html += `<div class="jd-equipped-label">当前装备</div>`;
      for (const [slot, item] of eqEntries) {
        html += `<div class="jd-equipped-item">`;
        html += `<span class="jd-equipped-slot">${slot}</span>`;
        html += `<span class="jd-equipped-name">${item.emoji || ''} ${this._escapeHTML(item.name)}</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    el.innerHTML = html;
  },

  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  _healthColor(health) {
    if (!health) return 'var(--text-dim)';
    if (['健康'].includes(health)) return 'var(--success)';
    if (['轻伤', '疲惫'].includes(health)) return 'var(--gold)';
    if (['重伤'].includes(health)) return 'var(--danger)';
    if (['濒危', '濒死'].includes(health)) return '#ff4444';
    return 'var(--text-dim)';
  },
};
window.JourneyDiary = JourneyDiary;
