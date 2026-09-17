// ============================
// WORLD BUILDER — 世界构建器（游戏内模态面板版）
// 数据绑定到 GameEngine.state.worldBuilderData
// 提供 getPromptContext() 注入 AI 提示词
// ============================
var WorldBuilder = {
  tab: 'character',
  selectedId: null,
  genre: '',

  /** 从 GameEngine.state 获取数据（不可变引用） */
  getData() {
    if (!GameEngine.state.worldBuilderData) {
      GameEngine.state.worldBuilderData = { characters: [], abilities: [], locations: [], _nextId: 1 };
    }
    return GameEngine.state.worldBuilderData;
  },

  /** 设置数据（用于读档恢复） */
  setData(data) {
    GameEngine.state.worldBuilderData = data;
  },

  get list() {
    const d = this.getData();
    return this.tab === 'character' ? d.characters :
           this.tab === 'ability' ? d.abilities : d.locations;
  },

  show() {
    if (!GameEngine.state.gameStarted) { UIManager.toast('请先开始游戏', 'warning'); return; }
    this.genre = GameEngine.state.genre || localStorage.getItem('wb-genre') || '';
    const gi = document.getElementById('wb-genre-input');
    if (gi) gi.value = this.genre;
    this.selectedId = null;
    document.getElementById('world-builder-modal').classList.remove('hidden');
    this.render();
    document.getElementById('btn-world-builder').style.display = '';
  },

  hide() {
    document.getElementById('world-builder-modal').classList.add('hidden');
  },

  setGenre(v) {
    this.genre = v;
    localStorage.setItem('wb-genre', v);
  },

  switchTab(tab) {
    this.tab = tab; this.selectedId = null;
    document.querySelectorAll('#wb-header .wb-tab').forEach(t => {
      t.classList.toggle('active',
        tab === 'character' ? t.textContent.includes('人物') :
        tab === 'ability' ? t.textContent.includes('功法') : t.textContent.includes('地点'));
    });
    this.render();
  },

  addItem() {
    const d = this.getData();
    const defaults = {
      character: { id: 'c'+(d._nextId++), name: '新人物', role: '', traits: [], appearance: '', background: '', abilities: '', level: '', weapon: '' },
      ability: { id: 'a'+(d._nextId++), name: '新功法', type: '', description: '', effects: '', requirements: '' },
      location: { id: 'l'+(d._nextId++), name: '新地点', type: '', description: '', significance: '', atmosphere: '' }
    };
    const item = defaults[this.tab];
    this.list.push(item);
    this.selectedId = item.id;
    this.render();
  },

  selectItem(id) { this.selectedId = id; this.render(); },

  deleteItem() {
    if (!this.selectedId) return;
    const idx = this.list.findIndex(x => x.id === this.selectedId);
    if (idx >= 0) { this.list.splice(idx, 1); this.selectedId = null; }
    this.render();
    this.toast('已删除');
  },

  updateField(field, value) {
    const item = this.list.find(x => x.id === this.selectedId);
    if (!item) return;
    if (field === 'traits') { item.traits = value.split(/[,，]/).map(s => s.trim()).filter(Boolean); }
    else { item[field] = value; }
  },

  saveItem() { this.toast('已保存'); },

  // ===== AI Auto-complete =====
  async aiFillField(field) {
    const item = this.list.find(x => x.id === this.selectedId);
    if (!item || !item.name) return;
    if (typeof AIBridge === 'undefined' || !AIBridge.isConfigured()) {
      this.toast('请先配置 AI API'); return;
    }
    const btn = document.querySelector(`.wb-ai-btn[data-field="${field}"]`);
    if (btn) btn.classList.add('loading');
    try {
      const result = await AIBridge.autoComplete(this.tab, item, this.genre);
      if (result) {
        for (const [k, v] of Object.entries(result)) {
          if (v && (!item[k] || item[k].length < 3)) {
            item[k] = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : v);
          }
        }
        this.render();
        this.toast('AI 补全完成');
      }
    } catch(e) { this.toast('补全失败: ' + e.message); }
    if (btn) btn.classList.remove('loading');
  },

  async aiFillAll() {
    if (typeof AIBridge === 'undefined' || !AIBridge.isConfigured()) {
      this.toast('请先配置 AI API'); return;
    }
    this.toast('⏳ AI正在补全所有空缺...');
    let count = 0;
    const d = this.getData();
    const allItems = [...d.characters, ...d.abilities, ...d.locations];
    for (const item of allItems) {
      if (!item.name || item.name === '新人物' || item.name === '新功法' || item.name === '新地点') continue;
      try {
        const tab = d.characters.includes(item) ? 'character' :
                    d.abilities.includes(item) ? 'ability' : 'location';
        const result = await AIBridge.autoComplete(tab, item, this.genre);
        if (result) {
          for (const [k, v] of Object.entries(result)) {
            if (v && (!item[k] || (typeof item[k] === 'string' && item[k].length < 3))) {
              item[k] = typeof v === 'string' ? v : (Array.isArray(v) ? v.join(', ') : v);
              count++;
            }
          }
        }
      } catch(e) {}
    }
    this.render();
    this.toast(`✅ 补全了 ${count} 个字段`);
  },

  // ===== Render =====
  render() {
    this._renderList();
    this._renderDetail();
  },

  _renderList() {
    const panel = document.getElementById('wb-list');
    if (!panel) return;
    const items = this.list;
    if (items.length === 0) {
      panel.innerHTML = '<div class="wb-empty">暂无条目<br>点击 ＋ 新建</div>';
      return;
    }
    panel.innerHTML = items.map(i => {
      const sel = i.id === this.selectedId ? ' selected' : '';
      const sub = this.tab === 'character' ? (i.role || i.level || '') :
                  this.tab === 'ability' ? (i.type || '') : (i.type || '');
      return `<div class="wb-item${sel}" onclick="WorldBuilder.selectItem('${i.id}')">
        <div class="wb-name">${this._esc(i.name)}</div>
        <div class="wb-sub">${this._esc(sub)}</div>
      </div>`;
    }).join('');
  },

  _renderDetail() {
    const panel = document.getElementById('wb-detail');
    if (!panel) return;
    const item = this.list.find(x => x.id === this.selectedId);
    if (!item) {
      panel.innerHTML = '<div class="wb-hint">← 选择或新建一个条目<br>悬停空白字段出现 🤖 补全按钮</div>';
      return;
    }

    const F = (label, field, type, rows) => {
      const val = field === 'traits' ? (item.traits||[]).join(', ') :
                  (typeof item[field] === 'string' ? item[field] : (item[field]||''));
      const isEmpty = !val || val.length < 2;
      const aiBtn = isEmpty ? `<button class="wb-ai-btn" data-field="${field}" onclick="WorldBuilder.aiFillField('${field}')" title="AI补全">🤖</button>` : '';
      const input = type === 'textarea'
        ? `<textarea rows="${rows||2}" onchange="WorldBuilder.updateField('${field}', this.value)">${this._esc(val)}</textarea>`
        : `<input type="text" value="${this._esc(val)}" onchange="WorldBuilder.updateField('${field}', this.value)">`;
      return `<div class="wb-field"><label>${label} ${aiBtn}</label>${input}</div>`;
    };

    let fields = '';
    if (this.tab === 'character') {
      fields = F('姓名', 'name') + F('身份/角色', 'role') +
        F('性格特质（逗号分隔）', 'traits') + F('外貌', 'appearance', 'textarea', 2) +
        F('背景故事', 'background', 'textarea', 3) +
        F('功法/能力', 'abilities') + F('境界等级', 'level') + F('武器', 'weapon');
    } else if (this.tab === 'ability') {
      fields = F('功法名', 'name') + F('类型（攻击/防御/辅助/修炼）', 'type') +
        F('描述', 'description', 'textarea', 3) + F('效果', 'effects', 'textarea', 2) +
        F('修炼要求', 'requirements');
    } else {
      fields = F('地点名', 'name') + F('类型（城市/荒野/宗门/秘境）', 'type') +
        F('描述', 'description', 'textarea', 3) + F('重要性', 'significance', 'textarea', 2) +
        F('氛围', 'atmosphere');
    }

    panel.innerHTML = `<h2>${this._esc(item.name)}</h2>${fields}
      <div class="wb-actions">
        <button class="wb-btn-save" onclick="WorldBuilder.saveItem()">💾 保存</button>
        <button class="wb-btn-delete" onclick="WorldBuilder.deleteItem()">🗑 删除</button>
      </div>`;
  },

  _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },

  toast(msg) {
    UIManager.toast(msg, 'success');
  },

  // ===== Export/Import =====
  exportAll() {
    const blob = new Blob([JSON.stringify(this.getData(), null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = '世界设定_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
  },

  importAll() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          this.setData(JSON.parse(r.result));
          this.render();
          this.toast('导入成功');
        } catch(ex) { this.toast('导入失败: ' + ex.message); }
      };
      r.readAsText(f);
    };
    input.click();
  },

  /** 给故事生成用的上下文（注入到 AI 提示词） */
  getPromptContext() {
    const d = this.getData();
    let ctx = '';
    const cv = d.characters;
    if (cv && cv.length) {
      ctx += '【世界构建器·人物设定】\n';
      for (const c of cv) {
        ctx += `- ${c.name}（${c.role||'未知'}）：${c.background||''}。特质：${(c.traits||[]).join('、')}。外貌：${c.appearance||'无'}。功法：${c.abilities||'无'}。境界：${c.level||'未知'}。武器：${c.weapon||'无'}\n`;
      }
    }
    const al = d.abilities;
    if (al && al.length) {
      ctx += '\n【世界构建器·功法体系】\n';
      for (const a of al) {
        ctx += `- ${a.name}（${a.type||'未知'}）：${a.description||''}。效果：${a.effects||'无'}。要求：${a.requirements||'无'}\n`;
      }
    }
    const lc = d.locations;
    if (lc && lc.length) {
      ctx += '\n【世界构建器·重要地点】\n';
      for (const l of lc) {
        ctx += `- ${l.name}（${l.type||'未知'}）：${l.description||''}。重要性：${l.significance||'无'}。氛围：${l.atmosphere||'无'}\n`;
      }
    }
    return ctx;
  }
};
// ── 确保 WorldBuilder 在 onclick 中可访问（const 不挂 window）──
window.WorldBuilder = WorldBuilder;
