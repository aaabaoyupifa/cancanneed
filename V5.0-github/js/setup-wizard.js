// ============================
// MAIN MENU
// ============================
var MainMenu = {
  _hasSave: false,

  /** Show the main menu overlay */
  show() {
    document.getElementById('main-menu-overlay').classList.remove('hidden');
    document.getElementById('setup-overlay').classList.add('hidden');
    document.getElementById('api-config-overlay').classList.add('hidden');
    // Render theme swatches
    document.getElementById('theme-swatches').innerHTML = ThemeManager.renderSwatches();
    this._updateContinueButton();
  },

  _updateContinueButton() {
    const btn = document.getElementById('menu-btn-continue');
    const hint = document.getElementById('menu-continue-hint');
    // Reset styles
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.style.display = 'none';
    // Check local storage for saves
    Storage.list().then(data => {
      if (data.ok && data.saves && data.saves.length > 0) {
        this._hasSave = true;
        hint.textContent = '载入最近的存档';
        btn.style.display = '';
      } else {
        this._hasSave = false;
        hint.textContent = '没有找到存档';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'default';
        btn.style.display = '';
      }
    }).catch(() => {
      this._hasSave = false;
      hint.textContent = '没有找到存档';
      btn.style.opacity = '0.5';
      btn.style.cursor = 'default';
      btn.style.display = '';
    });
  },

  /** 开始创造世界 → 打开设置向导 */
  startNewWorld() {
    document.getElementById('main-menu-overlay').classList.add('hidden');
    document.getElementById('setup-overlay').classList.remove('hidden');
    document.getElementById('btn-api-reconfig').style.display = 'inline';
    // Reset to tab 0 (世界观)
    SetupWizard.switchTab(0);
    APIConfig._checkForSaveBanner();
  },

  /** 继续冒险 → 弹出存档选择列表 */
  async continueAdventure() {
    try {
      const data = await Storage.list();
      if (!data.ok || !data.saves || data.saves.length === 0) {
        UIManager.toast('没有找到存档，请先开始一段冒险', 'warning');
        return;
      }
      // 保存 API 配置（通过服务端，不依赖 localStorage）
      const apiKey = document.getElementById('api-key')?.value?.trim() || '';
      const apiUrl = document.getElementById('api-url')?.value?.trim() || '';
      const apiModel = document.getElementById('api-model')?.value?.trim() || '';
      if (apiKey && apiUrl && apiModel) {
        try {
          await fetch('/api/config/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey, api_url: apiUrl, api_model: apiModel }),
          });
        } catch(e) { /* 忽略配置保存失败 */ }
      }
      document.getElementById('main-menu-overlay').classList.add('hidden');
      // 弹出存档选择列表，而不是自动加载最新存档
      SaveManager.showLoad();
    } catch (e) {
      console.error('[continueAdventure] error:', e);
      UIManager.toast('读取存档失败：' + e.message, 'error');
    }
  },

  /** 设置 → 打开 API 配置 */
  openSettings() {
    document.getElementById('main-menu-overlay').classList.add('hidden');
    document.getElementById('api-config-overlay').classList.remove('hidden');
  },

  /** 退出 → 关闭应用 */
  exitApp() {
    // 桌面版 pywebview: 通过 js_api 关闭窗口
    if (window.pywebview && window.pywebview.api && window.pywebview.api.close_window) {
      window.pywebview.api.close_window();
      return;
    }
    // 兜底：尝试 window.close() 或提示用户手动关闭
    try { window.close(); } catch(e) {}
    // window.close() 在 pywebview 中通常无效，提示用户
    alert('请手动关闭窗口（或使用 Ctrl+W）');
  },
};

// ============================
// SETUP WIZARD
// ============================
var SetupWizard = {
  currentTab: 0,
  aiTargetField: null,
  aiTargetLabel: '',

  switchTab(idx) {
    this.currentTab = idx;
    document.querySelectorAll('.setup-tab').forEach((t,i) => t.classList.toggle('active', i===idx));
    document.querySelectorAll('.setup-page').forEach((p,i) => p.classList.toggle('active', i===idx));
    document.getElementById('setup-prev').style.display = idx===0 ? 'none':'inline-block';
    document.getElementById('setup-next').style.display = idx===2 ? 'none':'inline-block';
    document.getElementById('setup-start').style.display = idx===2 ? 'inline-block':'none';
    document.getElementById('setup-step-indicator').textContent = `${idx+1} / 3`;
    if (idx===2) this.buildSummary();
  },

  nextTab() {
    if (this.currentTab === 0) {
      const genre = this._getFieldValue('w-genre');
      if (!genre) { UIManager.toast('请先选择冒险类型！', 'warning'); return; }
    }
    if (this.currentTab < 2) this.switchTab(this.currentTab+1);
  },
  prevTab() { if (this.currentTab > 0) this.switchTab(this.currentTab-1); },

  // ====== GENRE ======
  selectGenre(genre) {
    if (genre === 'custom') {
      document.getElementById('genre-custom-wrap').classList.remove('hidden');
      document.getElementById('w-genre-custom').focus();
      return;
    }
    document.getElementById('genre-custom-wrap').classList.add('hidden');
    document.getElementById('w-genre').value = genre;
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.genre-btn[data-genre="${genre}"]`);
    if (btn) btn.classList.add('selected');
  },

  applyCustomGenre() {
    const val = document.getElementById('w-genre-custom').value.trim();
    if (!val) { UIManager.toast('请输入冒险类型', 'warning'); return; }
    document.getElementById('w-genre').value = val;
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('genre-custom-btn').classList.add('selected');
    document.getElementById('genre-custom-wrap').classList.add('hidden');
    UIManager.toast(`冒险类型：${val}`, 'success');
  },

  addFaction() {
    const list = document.getElementById('faction-list');
    const div = document.createElement('div');
    div.className = 'faction-item';
    div.innerHTML = `<button class="faction-del" onclick="SetupWizard.removeFaction(this)" title="删除">x</button>
      <div class="faction-row">
        <input type="text" placeholder="势力名称" class="f-name">
        <input type="text" placeholder="立场（正/反/中立）" class="f-align" style="max-width:120px;">
      </div>
      <input type="text" placeholder="简介" class="f-desc" style="margin-top:6px;">`;
    list.appendChild(div);
  },

  removeFaction(btn) {
    const items = document.querySelectorAll('.faction-item');
    if (items.length <= 1) { UIManager.toast('至少保留一个势力', 'warning'); return; }
    btn.closest('.faction-item').remove();
  },

  _applyFactionsBulk(text) {
    // Strip markdown bold markers everywhere
    let cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1');

    // Split by numbered entries (1. 2. 3. etc) or bulleted entries
    let entries = cleaned.split(/\n(?=[\d]+[\.\、\)\s]+|\s*[-*•]\s+|\s*[①②③④⑤⑥⑦⑧⑨⑩])/);

    // Filter out preamble text (lines before first numbered/bulleted entry)
    entries = entries.filter(e => {
      const t = e.trim();
      return /^[\d]+[\.\、\)\s]+|^[-*•]\s+|^[①②③④⑤⑥⑦⑧⑨⑩]/.test(t);
    });

    // If no entries found by pattern, try simple line-based parsing
    if (entries.length === 0) {
      entries = cleaned.split('\n').filter(l => l.trim().length > 5);
    }

    const list = document.getElementById('faction-list');
    list.innerHTML = '';

    entries.forEach(entry => {
      // Join multi-line entry into single line
      let line = entry.replace(/\n\s*/g, ' ').trim();

      // Remove bullet/number prefix
      line = line.replace(/^[\d]+[\.\、\)\s]+/, '').replace(/^[-*•]\s*/, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '');

      // Remove markdown header artifacts
      line = line.replace(/^#{1,4}\s+.*$/, '');

      let name = '', align = '', desc = '';

      // Pattern 1: 势力名（立场）：简介
      let match = line.match(/^(.+?)[（(](.+?)[）)]\s*[：:]\s*(.+)$/);
      if (match) { name = match[1].trim(); align = match[2].trim(); desc = match[3].trim(); }

      // Pattern 2: 势力名：简介
      if (!name) {
        match = line.match(/^(.+?)[：:]\s*(.+)$/);
        if (match) { name = match[1].trim(); desc = match[2].trim(); }
      }

      // Pattern 3: 势力名（立场）
      if (!name) {
        match = line.match(/^(.+?)[（(](.+?)[）)]\s*$/);
        if (match) { name = match[1].trim(); align = match[2].trim(); }
      }

      // Fallback
      if (!name && line.length > 3) { name = line.trim().substring(0, 30); }

      if (!name) return;

      const div = document.createElement('div');
      div.className = 'faction-item';
      div.innerHTML = `<button class="faction-del" onclick="SetupWizard.removeFaction(this)" title="删除">x</button>
        <div class="faction-row">
          <input type="text" placeholder="势力名称" class="f-name" value="${this._esc(name)}">
          <input type="text" placeholder="立场" class="f-align" value="${this._esc(align)}" style="max-width:120px;">
        </div>
        <input type="text" placeholder="简介" class="f-desc" value="${this._esc(desc)}" style="margin-top:6px;">`;
      list.appendChild(div);
    });

    if (list.children.length === 0) {
      SetupWizard.addFaction();
    }
  },

  _getFieldValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (id==='w-factions'||id==='w-factions-bulk') {
      const items = document.querySelectorAll('.faction-item');
      return Array.from(items).map(item => {
        const n = item.querySelector('.f-name').value.trim();
        const a = item.querySelector('.f-align').value.trim();
        const d = item.querySelector('.f-desc').value.trim();
        return n ? `${n}（${a||'未知'}）：${d||'暂无'}` : null;
      }).filter(Boolean).join('\n');
    }
    return el.value.trim();
  },

  _getFieldLabel(id) {
    const map = {
      'w-genre':'冒险类型','w-name':'世界名称','w-desc':'世界观概述','w-era':'时代背景',
      'w-locations':'核心地点','w-factions':'势力设定','w-factions-bulk':'势力设定',
      'w-power-system':'能力等级体系',
      'c-name':'姓名','c-age':'年龄','c-sex':'性别','c-personality':'性格描述',
      'c-one-line':'一句话描述','c-appearance':'外貌描述','c-background':'背景故事',
      'c-ability':'能力详细设定','c-goal':'初始目标/动机'
    };
    return map[id] || id;
  },

  /** 从世界名/描述/关键词推断 genre（AI 没返回时兜底） */
  _inferGenre(result) {
    // 优先用 keyword（一键生成对话框输入的关键词）
    if (result._keyword) {
      const kw = result._keyword.toLowerCase();
      const kwMap = {
        '玄幻':'东方玄幻','修仙':'仙侠修真','修真':'仙侠修真','仙侠':'仙侠修真',
        '魔幻':'西方魔幻','魔法':'西方魔幻','西幻':'西方魔幻',
        '科幻':'科幻末世','末世':'科幻末世','未来':'科幻末世','赛博':'科幻末世',
        '都市':'都市异能','异能':'都市异能','现代':'都市异能',
        '重生':'重生穿越','穿越':'重生穿越',
        '游戏':'游戏异界','网游':'游戏异界',
        '悬疑':'悬疑灵异','灵异':'悬疑灵异','恐怖':'悬疑灵异',
        '历史':'历史架空','架空':'历史架空','古代':'历史架空',
        '武侠':'武侠江湖','江湖':'武侠江湖',
        '恋爱':'现代都市恋爱','校园':'校园日常','言情':'古风言情','美食':'美食生活','商战':'商战职场',
      };
      for (const [key, val] of Object.entries(kwMap)) {
        if (kw.includes(key)) return val;
      }
    }
    // 从世界描述中提取关键词
    const text = ((result.worldName||'') + ' ' + (result.world_desc||result.worldDesc||'')).toLowerCase();
    const descMap = {
      '修仙|修真|仙|道|灵气':'仙侠修真',
      '魔法|剑与魔法|精灵|龙|骑士':'西方魔幻',
      '科幻|机甲|飞船|星际|赛博|未来': '科幻末世',
      '末日|丧尸|废土|生存':'科幻末世',
      '都市|校园|现代|公司|手机':'都市异能',
      '穿越|重生|来世':'重生穿越',
      '游戏|副本|技能点|等级':'游戏异界',
      '鬼|灵异|悬疑|恐怖|诡异':'悬疑灵异',
      '历史|王朝|皇帝|朝廷|古代':'历史架空',
      '江湖|武侠|武学|内力|门派':'武侠江湖',
      '恋爱|校园|浪漫':'现代都市恋爱',
      '美食|厨艺|餐厅':'美食生活',
      '商战|金融|商业':'商战职场',
    };
    for (const [pattern, val] of Object.entries(descMap)) {
      if (new RegExp(pattern).test(text)) return val;
    }
    return '大千世界'; // 最后兜底
  },

  openAI(targetId, label, contextFields) {
    this.aiTargetField = targetId;
    this.aiTargetLabel = label;
    document.getElementById('ai-h-target').textContent = `目标字段：${label}`;
    this._buildPrompt(contextFields);
    document.getElementById('ai-h-response').value = '';
    document.getElementById('ai-helper').classList.remove('hidden');
  },

  _buildPrompt(contextFields) {
    const parts = [];
    const genre = this._getFieldValue('w-genre');
    if (genre && !contextFields.includes('w-genre')) {
      contextFields.unshift('w-genre');
    }
    contextFields.forEach(fid => {
      let val = this._getFieldValue(fid);
      if (val) {
        const lbl = this._getFieldLabel(fid);
        parts.push(`【${lbl}】\n${val}`);
      }
    });
    const sep = parts.length ? '\n---\n' : '';
    const genreHint = genre ? `\n注意：请严格遵循「${genre}」题材的风格和世界观逻辑。` : '';
    const emptyHint = parts.length <= 1 ? `\n（用户只提供了冒险类型，请随机生成一个精彩的「${genre}」题材设定，要有创意和画面感）` : '';
    const prompt = `请根据以下信息，生成 "${this.aiTargetLabel}" 的内容。要求：贴合世界观、逻辑自洽、有画面感。直接输出内容，不需要解释或前缀。${genreHint}${emptyHint}\n\n${parts.join('\n\n')}${sep}\n请生成：${this.aiTargetLabel}`;
    document.getElementById('ai-h-prompt').value = prompt;
  },

  regenerateAI() {
    const ctxFields = this._getContextFieldsForTarget(this.aiTargetField);
    const originalPrompt = document.getElementById('ai-h-prompt').value;
    const variedPrompt = originalPrompt + '\n（请生成一个与之前不同的版本，换个角度或风格）';
    document.getElementById('ai-h-prompt').value = variedPrompt;
    document.getElementById('ai-h-response').value = '';
  },

  _getContextFieldsForTarget(targetId) {
    const map = {
      'w-name': ['w-genre','w-desc'],
      'w-desc': ['w-genre','w-name'],
      'w-era': ['w-genre','w-name','w-desc'],
      'w-locations': ['w-genre','w-name','w-desc','w-era'],
      'w-factions': ['w-genre','w-name','w-desc','w-era','w-locations'],
      'w-factions-bulk': ['w-genre','w-name','w-desc','w-era','w-locations'],
      'w-power-system': ['w-genre','w-name','w-desc','w-era','w-factions'],
      'c-name': ['w-genre','w-name','w-desc','c-sex','c-personality'],
      'c-personality': ['w-genre','w-name','w-desc','c-name','c-age','c-sex','c-one-line'],
      'c-one-line': ['w-genre','w-name','w-desc','c-name','c-age','c-sex','c-personality'],
      'c-appearance': ['w-genre','w-name','w-desc','c-name','c-age','c-sex','c-personality','c-one-line'],
      'c-background': ['w-genre','w-name','w-desc','w-era','w-factions','c-name','c-age','c-sex','c-personality','c-one-line'],
      'c-ability': ['w-genre','w-name','w-desc','w-power-system','c-name','c-background','c-personality'],
      'c-goal': ['w-genre','w-name','w-desc','w-factions','c-name','c-background','c-personality'],
    };
    return map[targetId] || [];
  },

  copyPrompt() {
    const box = document.getElementById('ai-h-prompt');
    box.select(); document.execCommand('copy');
    UIManager.toast('提示词已复制！粘贴给WorkBuddy吧', 'success');
  },

  applyAI() {
    const resp = document.getElementById('ai-h-response').value.trim();
    if (!resp) { UIManager.toast('请先在下方粘贴AI的生成结果', 'warning'); return; }

    const fid = this.aiTargetField;
    if (fid==='w-factions'||fid==='w-factions-bulk') {
      const lines = resp.split('\n').filter(l=>l.trim());
      const list = document.getElementById('faction-list');
      list.innerHTML = '';
      lines.forEach(line => {
        const match = line.match(/^(.+?)[（(](.+?)[）)]\s*[：:]\s*(.+)$/);
        const div = document.createElement('div');
        div.className = 'faction-item';
        if (match) {
          div.innerHTML = `<button class="faction-del" onclick="SetupWizard.removeFaction(this)" title="删除">x</button>
            <div class="faction-row">
              <input type="text" placeholder="势力名称" class="f-name" value="${this._esc(match[1])}">
              <input type="text" placeholder="立场" class="f-align" value="${this._esc(match[2])}" style="max-width:120px;">
            </div>
            <input type="text" placeholder="简介" class="f-desc" value="${this._esc(match[3])}" style="margin-top:6px;">`;
        } else {
          div.innerHTML = `<button class="faction-del" onclick="SetupWizard.removeFaction(this)" title="删除">x</button>
            <div class="faction-row">
              <input type="text" placeholder="势力名称" class="f-name" value="${this._esc(line)}">
              <input type="text" placeholder="立场" class="f-align" style="max-width:120px;">
            </div>
            <input type="text" placeholder="简介" class="f-desc" style="margin-top:6px;">`;
        }
        list.appendChild(div);
      });
    } else {
      const el = document.getElementById(fid);
      if (el) el.value = resp;
    }
    this.closeAI();
    UIManager.toast(`${this.aiTargetLabel} 已填入！`, 'success');
  },

  closeAI() { document.getElementById('ai-helper').classList.add('hidden'); },
  _esc(s) { return s.replace(/"/g,'&quot;').replace(/</g,'&lt;'); },

  // ====== ONE-CLICK COMPLETE WORLD GENERATION ======

  /** Show the dedicated one-click gen input area */
  showOneClickGen() {
    const existing = document.getElementById('one-click-gen-area');
    if (existing) existing.classList.remove('hidden');
  },

  /** Trigger one-click generation with user's keyword (empty = random) */
  async generateCompleteWorld(keyword) {
    const cfg = localStorage.getItem('if-api-config');
    if (!cfg) { UIManager.toast('请先在API配置页面配置API后再使用一键生成', 'warning'); return; }

    // Show loading overlay
    this._showWorldGenLoading(keyword || '随机生成');

    try {
      const data = await AIBridge.generateCompleteWorld({ keyword: keyword || '' });
      this._hideWorldGenLoading();

      if (data) {
        // 字段映射：将 snake_case 或 camelCase 映射到 _fillAllSettings 期望的格式
        const prot = data.protagonist || data.protagonist_data || {};
        const mapped = {
          genre: data.genre || (keyword || ''),
          worldName: data.world_name || data.worldName || (keyword || ''),
          worldDesc: data.world_desc || data.worldDesc || '',
          era: data.era || '',
          locations: data.locations || '',
          factions: data.factions || '',
          powerSystem: data.power_system || data.powerSystem || '',
          protagonist: {
            name: prot.name || '',
            age: prot.age || '',
            sex: prot.sex || '',
            personality: prot.personality || '',
            oneLine: prot.oneLine || prot.one_line || '',
            appearance: prot.appearance || '',
            background: prot.background || '',
            ability: prot.ability || '',
            goal: prot.goal || '',
          },
          _keyword: keyword,
        };
        this._fillAllSettings(mapped);
        UIManager.toast('世界生成完成！请检查并调整设定', 'success');
      } else {
        UIManager.toast('生成失败，请重试', 'error');
      }
    } catch(e) {
      this._hideWorldGenLoading();
      UIManager.toast('生成失败：' + e.message, 'error');
    }
  },

  /** Fill ALL fields from a complete world generation result */
  _fillAllSettings(result) {
    // Helper: set value + fire event so DOM/controls refresh
    const _set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    // === World Tab ===
    // Genre — 如有必要，从关键词/世界描述推断
    if (!result.genre) {
      result.genre = this._inferGenre(result);
    }
    if (result.genre) {
      const predefined = ['东方玄幻','仙侠修真','西方魔幻','科幻末世','都市异能','重生穿越','游戏异界','悬疑灵异','历史架空','武侠江湖','大千世界','现代都市恋爱','校园日常','古风言情','美食生活','商战职场'];
      if (predefined.includes(result.genre)) {
        this.selectGenre(result.genre);
      } else {
        document.getElementById('w-genre').value = result.genre;
        document.getElementById('w-genre-custom').value = result.genre;
        document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('selected'));
        const customBtn = document.getElementById('genre-custom-btn');
        if (customBtn) customBtn.classList.add('selected');
        document.getElementById('genre-custom-wrap').classList.remove('hidden');
      }
      document.getElementById('w-genre').dispatchEvent(new Event('input', { bubbles: true }));
    }
    _set('w-name', result.worldName);
    _set('w-desc', result.worldDesc);
    _set('w-era', result.era);
    if (result.locations) {
      const val = Array.isArray(result.locations) ? result.locations.join('\n') : result.locations;
      document.getElementById('w-locations').value = val;
      document.getElementById('w-locations').dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (result.factions) {
      const factionsText = Array.isArray(result.factions) ? result.factions.join('\n') : result.factions;
      this._applyFactionsBulk(factionsText);
    }
    _set('w-power-system', result.powerSystem);

    // === Character Tab ===
    const prot = result.protagonist || {};
    _set('c-name', prot.name);
    if (prot.age) {
      document.getElementById('c-age').value = String(prot.age);
      document.getElementById('c-age').dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (prot.sex) {
      const sexEl = document.getElementById('c-sex');
      if (sexEl && ['男','女','其他'].includes(prot.sex)) {
        sexEl.value = prot.sex;
        sexEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    _set('c-personality', prot.personality);
    _set('c-one-line', prot.oneLine);
    _set('c-appearance', prot.appearance);
    _set('c-background', prot.background);
    _set('c-ability', prot.ability);
    _set('c-goal', prot.goal);

    // === Side Characters → characterBios ===
    const sideChars = result.sideCharacters || [];
    if (sideChars.length > 0) {
      const gs = GameEngine.state;
      if (!gs.characterBios) gs.characterBios = [];

      // Keep existing protagonist entry if present
      const existingProt = gs.characterBios.find(c => c.role === 'protagonist');
      gs.characterBios = existingProt ? [existingProt] : [];

      // Add protagonist from gen result
      if (prot.name) {
        const protBio = {
          id: 'bio_' + Date.now().toString(36),
          name: prot.name || '主角',
          role: 'protagonist',
          appearance: prot.appearance || '',
          personality: prot.personality || '',
          bg: prot.background || '',
          ability: prot.ability || '',
          goal: prot.goal || '',
          notes: '',
        };
        // Replace if exists
        const existingIdx = gs.characterBios.findIndex(c => c.role === 'protagonist');
        if (existingIdx >= 0) gs.characterBios[existingIdx] = protBio;
        else gs.characterBios.unshift(protBio);
      }

      // Add side characters (avoid duplicates by name)
      const roleLabels = {
        antagonist: '反派/对手',
        ally: '伙伴/盟友',
        mentor: '导师',
        rival: '竞争对手',
        neutral: '中立角色'
      };
      const existingNames = new Set(gs.characterBios.map(c => c.name));
      sideChars.forEach(c => {
        if (!existingNames.has(c.name)) {
          gs.characterBios.push({
            id: 'bio_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
            name: c.name || '未命名',
            role: c.role || 'ally',
            appearance: c.appearance || '',
            personality: c.personality || '',
            bg: c.bg || '',
            ability: c.ability || '',
            goal: c.goal || '',
            notes: c.notes || (roleLabels[c.role] ? `（${roleLabels[c.role]}）` : ''),
          });
          existingNames.add(c.name);
        }
      });
    }

    // Switch to tab 0 and scroll up
    this.switchTab(0);
  },

  _showWorldGenLoading(keyword) {
    const overlay = document.createElement('div');
    overlay.id = 'world-gen-loading';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:radial-gradient(ellipse at center, #080806 0%, #020201 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;';
    const msgs = [
      '命运的丝线正在编织...',
      '星辰在虚空中凝聚...',
      '世界在你的意志下成形...',
      '创世之火正在燃烧...',
      '角色的灵魂正在注入...',
      '万物的因果正在连接...',
      '叙事之河开始流淌...',
      '墨迹在纸页上晕开...',
    ];
    let msgIdx = 0;
    overlay.innerHTML = `<canvas id="gen-stars-canvas" style="position:absolute;inset:0;pointer-events:none;"></canvas>
    <div style="text-align:center;position:relative;z-index:1;">
      <div style="position:relative;width:220px;height:220px;margin:0 auto 24px;">
        <svg id="gen-earth-pie" viewBox="0 0 220 220" style="width:220px;height:220px;filter:drop-shadow(0 0 50px rgba(201,168,76,.25));">
          <defs>
            <radialGradient id="globeGrad" cx="35%" cy="30%">
              <stop offset="0%" stop-color="#1a1810"/>
              <stop offset="60%" stop-color="#0d0c08"/>
              <stop offset="100%" stop-color="#050504"/>
            </radialGradient>
            <filter id="globeGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <!-- 深色球体 -->
          <circle cx="110" cy="110" r="90" fill="url(#globeGrad)" stroke="rgba(201,168,76,.25)" stroke-width="1"/>
          <!-- 经纬线网格 -->
          <g stroke="rgba(201,168,76,.12)" stroke-width=".5" fill="none">
            <!-- 经线 -->
            <ellipse cx="110" cy="110" rx="15" ry="90"/>
            <ellipse cx="110" cy="110" rx="35" ry="90"/>
            <ellipse cx="110" cy="110" rx="55" ry="90"/>
            <ellipse cx="110" cy="110" rx="75" ry="90"/>
            <!-- 纬线 -->
            <ellipse cx="110" cy="110" rx="90" ry="15"/>
            <ellipse cx="110" cy="110" rx="90" ry="35"/>
            <ellipse cx="110" cy="110" rx="90" ry="55"/>
            <ellipse cx="110" cy="110" rx="90" ry="75"/>
            <!-- 赤道加粗 -->
            <ellipse cx="110" cy="110" rx="90" ry="3" stroke="rgba(201,168,76,.2)" stroke-width=".8"/>
          </g>
          <!-- 外发光圈 -->
          <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(201,168,76,.08)" stroke-width="2"/>
          <!-- 饼图填充（同色系深色蒙版） -->
          <path id="gen-pie-fill" d="M110,110 L110,20 A90,90 0 0,1 110,200 Z" fill="rgba(0,0,0,.65)" style="display:block;"/>
          <!-- 百分比文字 -->
          <text id="gen-pie-text" x="110" y="102" text-anchor="middle" fill="#f0d88a" font-size="32" font-weight="700" font-family="var(--font-main),sans-serif" filter="url(#globeGlow)">0%</text>
          <text x="110" y="128" text-anchor="middle" fill="rgba(201,168,76,.5)" font-size="11" font-family="var(--font-main),sans-serif" letter-spacing="3">构建中</text>
        </svg>
      </div>
      <p style="color:rgba(226,201,126,.75);font-size:16px;margin-bottom:6px;letter-spacing:2px;">正在构建「${keyword || '随机世界'}」...</p>
      <p style="color:rgba(201,168,76,.35);font-size:13px;" id="gen-loading-msg">${msgs[0]}</p>
    </div>`;
    document.body.appendChild(overlay);
    this._startStarfield('gen-stars-canvas');
    this._startPieFixed('gen-pie-fill', 'gen-pie-text');
    const msgTimer = setInterval(() => {
      const el = document.getElementById('gen-loading-msg');
      if (!el) { clearInterval(msgTimer); return; }
      msgIdx = (msgIdx + 1) % msgs.length;
      el.textContent = msgs[msgIdx];
    }, 4000);
    overlay._msgTimer = msgTimer;
  },

  /** 饼图填充动画（精确角度 → 百分比对应） */
  _startPieFixed(fillId, textId) {
    const startTime = Date.now();
    const totalMs = 90000; // 90秒爬到90%
    const fillEl = document.getElementById(fillId);
    const textEl = document.getElementById(textId);
    if (!fillEl || !textEl) return;
    const r = 90, cx = 110, cy = 110;

    const tick = () => {
      if (!document.getElementById('world-gen-loading')) return;
      const elapsed = Date.now() - startTime;
      let pct = Math.min(elapsed / totalMs, 1) * 90;
      pct = Math.floor(pct);
      textEl.textContent = pct + '%';

      // 精确角度计算：12点方向(0%) → 顺时针
      // SVG坐标中0°=3点钟，12点方向=-90°
      const angleDeg = -90 + (pct / 100) * 360;
      const rad = angleDeg * Math.PI / 180;
      const ex = cx + r * Math.cos(rad);
      const ey = cy + r * Math.sin(rad);
      const largeArc = pct > 50 ? 1 : 0;
      fillEl.setAttribute('d', `M${cx},${cy} L${cx},${cy-r} A${r},${r} 0 ${largeArc},1 ${ex},${ey} Z`);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  /** 星空粒子背景 */
  _startStarfield(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005
      });
    }
    const draw = () => {
      if (!document.getElementById('world-gen-loading')) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.twinkle += s.speed;
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,210,255,${alpha})`;
        ctx.fill();
      });
      canvas._animId = requestAnimationFrame(draw);
    };
    draw();
  },

  _hideWorldGenLoading() {
    const overlay = document.getElementById('world-gen-loading');
    if (overlay) {
      if (overlay._msgTimer) clearInterval(overlay._msgTimer);
      // 停止星空动画
      const canvas = document.getElementById('gen-stars-canvas');
      if (canvas && canvas._animId) cancelAnimationFrame(canvas._animId);
      overlay.remove();
    }
  },

  buildSummary() {
    const w = { genre: this._getFieldValue('w-genre'), name: this._getFieldValue('w-name'), desc: this._getFieldValue('w-desc'),
      era: this._getFieldValue('w-era'), locations: this._getFieldValue('w-locations'),
      factions: this._getFieldValue('w-factions-bulk'), power: this._getFieldValue('w-power-system') };
    const c = { name: this._getFieldValue('c-name'), age: this._getFieldValue('c-age'),
      sex: this._getFieldValue('c-sex'), personality: this._getFieldValue('c-personality'),
      oneLine: this._getFieldValue('c-one-line'), appearance: this._getFieldValue('c-appearance'),
      background: this._getFieldValue('c-background'), ability: this._getFieldValue('c-ability'),
      goal: this._getFieldValue('c-goal') };

    document.getElementById('summary-world').innerHTML = `<h4>世界观</h4>
      ${w.genre?`<div class="sum-row"><span class="sum-label">冒险类型</span><span class="sum-value" style="color:var(--gold);">${w.genre}</span></div>`:''}
      ${w.name?`<div class="sum-row"><span class="sum-label">名称</span><span class="sum-value">${w.name}</span></div>`:''}
      ${w.era?`<div class="sum-row"><span class="sum-label">时代</span><span class="sum-value">${w.era}</span></div>`:''}
      ${w.desc?`<div class="sum-row"><span class="sum-label">概述</span><span class="sum-value">${w.desc.substring(0,80)}${w.desc.length>80?'...':''}</span></div>`:''}
      ${w.factions?`<div class="sum-row"><span class="sum-label">势力</span><span class="sum-value">${w.factions.replace(/\n/g,', ').substring(0,80)}</span></div>`:''}
      ${w.power?`<div class="sum-row"><span class="sum-label">能力体系</span><span class="sum-value">${w.power.substring(0,80)}</span></div>`:''}`;

    document.getElementById('summary-char').innerHTML = `<h4>主角</h4>
      <div class="sum-row"><span class="sum-label">姓名</span><span class="sum-value">${c.name||'---'} · ${c.sex||'?'} · ${c.age||'?'}岁</span></div>
      ${c.oneLine?`<div class="sum-row"><span class="sum-label">定位</span><span class="sum-value">${c.oneLine.substring(0,80)}</span></div>`:''}
      ${c.personality?`<div class="sum-row"><span class="sum-label">性格</span><span class="sum-value">${c.personality.substring(0,80)}</span></div>`:''}
      ${c.goal?`<div class="sum-row"><span class="sum-label">目标</span><span class="sum-value">${c.goal.substring(0,80)}</span></div>`:''}`;

    document.getElementById('summary-attrs').innerHTML = '<h4>状态面板</h4><div class="sum-row"><span class="sum-label">说明</span><span class="sum-value" style="color:var(--text-dim);">进入游戏后由AI根据能力体系自动生成</span></div>';

    // 剧本规则预设入口
    const spSelected = ScenarioPresets.getSelected();
    const spSummary = document.getElementById('summary-scenario');
    if (spSummary) {
      const preset = spSelected;
      if (preset) {
        spSummary.innerHTML = `<h4>剧本规则：${preset.icon} ${preset.name}</h4>
          <div class="sum-row"><span class="sum-label">规则数</span><span class="sum-value">${ScenarioPresets.getRules().length} 条</span></div>
          <button class="btn sm" onclick="UIManager.showModal('scenario-presets-modal');ScenarioPresets.renderGrid();ScenarioPresets._updatePreview();" style="margin-top:6px;">修改预设</button>`;
      } else {
        spSummary.innerHTML = `<h4>剧本规则预设</h4>
          <div style="padding:10px;background:var(--card);border-radius:6px;margin-top:6px;">
            <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">选择一个剧本规则模板，AI 会在整个故事中严格遵守这些规则。</p>
            <button class="btn primary sm" onclick="UIManager.showModal('scenario-presets-modal');ScenarioPresets.renderGrid();ScenarioPresets._updatePreview();">选择预设</button>
          </div>`;
      }
    }
  },

  _collectAllSettings() {
    const p = {};
    p.genre = this._getFieldValue('w-genre');
    p.worldName = this._getFieldValue('w-name');
    p.world = this._getFieldValue('w-desc');
    p.era = this._getFieldValue('w-era');
    p.locations = this._getFieldValue('w-locations');
    p.factions = this._getFieldValue('w-factions-bulk');
    p.powerSystem = this._getFieldValue('w-power-system');
    p.name = this._getFieldValue('c-name');
    p.age = parseInt(this._getFieldValue('c-age')) || 20;
    p.sex = this._getFieldValue('c-sex') || '男';
    p.personality = this._getFieldValue('c-personality');
    p.oneLine = this._getFieldValue('c-one-line');
    p.appearance = this._getFieldValue('c-appearance');
    p.background = this._getFieldValue('c-background');
    p.ability = this._getFieldValue('c-ability');
    p.goal = this._getFieldValue('c-goal');
    // 收集设置向导中已创建的人物小传
    const gs = GameEngine.state;
    p.characterBios = (gs.characterBios || []).map(c => JSON.parse(JSON.stringify(c)));
    return p;
  },

  _checkServerReady() {
    return Promise.resolve(AIBridge.isConfigured());
  },

  triggerImport() {
    this._checkServerReady().then(ok => {
      if (!ok) { UIManager.toast('请先在API配置页面配置API后再使用导入功能', 'warning'); return; }
      document.getElementById('import-file-input').click();
    });
  },

  async handleImport(input) {
    const file = input.files[0];
    if (!file) return;
    // Show loading
    this._showImportLoading();
    try {
      const text = await this._readFile(file);
      // Send to server for AI extraction
      const result = await this._callImportAPI(text);
      if (result.ok) {
        this._fillSettings(result.data);
        UIManager.toast('设定导入成功！请检查并调整', 'success');
      } else {
        UIManager.toast(result.error || 'AI解析失败', 'error');
      }
    } catch(e) {
      UIManager.toast('导入失败：' + e.message, 'error');
    }
    this._hideImportLoading();
    input.value = ''; // Clear so same file can be re-imported
  },

  _showImportLoading() {
    const overlay = document.createElement('div');
    overlay.id = 'import-loading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:radial-gradient(ellipse at center, #080806 0%, #020201 100%);display:flex;align-items:center;justify-content:center;';
    const impId = 'import-earth';
    overlay.innerHTML = `<div style="text-align:center;">
      <svg id="${impId}-svg" viewBox="0 0 160 160" style="width:140px;height:140px;margin:0 auto 18px;filter:drop-shadow(0 0 30px rgba(201,168,76,.2));">
        <defs>
          <radialGradient id="${impId}-globe" cx="35%" cy="30%">
            <stop offset="0%" stop-color="#1a1810"/>
            <stop offset="60%" stop-color="#0d0c08"/>
            <stop offset="100%" stop-color="#050504"/>
          </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="64" fill="url(#${impId}-globe)" stroke="rgba(201,168,76,.2)" stroke-width="1"/>
        <g stroke="rgba(201,168,76,.1)" stroke-width=".5" fill="none">
          <ellipse cx="80" cy="80" rx="11" ry="64"/><ellipse cx="80" cy="80" rx="25" ry="64"/>
          <ellipse cx="80" cy="80" rx="39" ry="64"/><ellipse cx="80" cy="80" rx="53" ry="64"/>
          <ellipse cx="80" cy="80" rx="64" ry="11"/><ellipse cx="80" cy="80" rx="64" ry="25"/>
          <ellipse cx="80" cy="80" rx="64" ry="39"/><ellipse cx="80" cy="80" rx="64" ry="53"/>
          <ellipse cx="80" cy="80" rx="64" ry="2.5" stroke="rgba(201,168,76,.18)" stroke-width=".6"/>
        </g>
        <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(201,168,76,.06)" stroke-width="1.5"/>
        <path id="${impId}-fill" d="M80,80 L80,16 A64,64 0 0,1 80,144 Z" fill="rgba(0,0,0,.6)"/>
        <text id="${impId}-pct" x="80" y="75" text-anchor="middle" fill="#e2c97e" font-size="22" font-weight="700" style="text-shadow:0 0 12px rgba(201,168,76,.4);">0%</text>
        <text x="80" y="92" text-anchor="middle" fill="rgba(201,168,76,.4)" font-size="8" letter-spacing="2">解读中</text>
      </svg>
      <p style="color:rgba(226,201,126,.7);font-size:16px;margin-bottom:8px;">命运之书正在解读你的设定...</p>
      <p style="color:rgba(201,168,76,.3);font-size:13px;">AI正在分析文档中的世界观与角色信息</p>
    </div>`;
    document.body.appendChild(overlay);
    // 启动饼图
    GameEngine._startPieSmall(`${impId}-fill`, `${impId}-pct`, 64, 80, 80, 50000);
  },

  _hideImportLoading() {
    const overlay = document.getElementById('import-loading-overlay');
    if (overlay) overlay.remove();
  },

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'md' || ext === 'txt') {
        reader.readAsText(file, 'UTF-8');
      } else {
        // Try as text anyway
        reader.readAsText(file, 'UTF-8');
      }
    });
  },

  async _callImportAPI(text) {
    try {
      const data = await AIBridge.importSettings(text);
      return data;
    } catch(e) {
      return { ok: false, error: '请求失败：' + e.message };
    }
  },

  _fillSettings(data) {
    // Genre - click the matching button or set custom
    if (data.genre) {
      const predefined = ['东方玄幻','仙侠修真','西方魔幻','科幻末世','都市异能','重生穿越','游戏异界','悬疑灵异','历史架空','武侠江湖','大千世界','现代都市恋爱','校园日常','古风言情','美食生活','商战职场'];
      if (predefined.includes(data.genre)) {
        this.selectGenre(data.genre);
      } else {
        // Custom genre
        document.getElementById('w-genre').value = data.genre;
        document.getElementById('w-genre-custom').value = data.genre;
        document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('selected'));
        const customBtn = document.getElementById('genre-custom-btn');
        if (customBtn) customBtn.classList.add('selected');
        document.getElementById('genre-custom-wrap').classList.remove('hidden');
      }
    }
    // Worldview fields
    if (data.worldName) this._setField('w-name', data.worldName);
    if (data.world) this._setField('w-desc', data.world);
    if (data.era) this._setField('w-era', data.era);
    if (data.locations) this._setField('w-locations', Array.isArray(data.locations) ? data.locations.join('\n') : data.locations);
    if (data.factions) this._setField('w-factions-bulk', Array.isArray(data.factions) ? data.factions.join('\n') : data.factions);
    if (data.powerSystem) this._setField('w-power-system', data.powerSystem);
    // Character fields
    if (data.name) this._setField('c-name', data.name);
    if (data.age) this._setField('c-age', String(data.age));
    if (data.sex) {
      const el = document.getElementById('c-sex');
      if (el) el.value = data.sex;
    }
    if (data.personality) this._setField('c-personality', data.personality);
    if (data.oneLine) this._setField('c-one-line', data.oneLine);
    if (data.appearance) this._setField('c-appearance', data.appearance);
    if (data.background) this._setField('c-background', data.background);
    if (data.ability) this._setField('c-ability', data.ability);
    if (data.goal) this._setField('c-goal', data.goal);
  },

  _setField(id, value) {
    const el = document.getElementById(id);
    if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }
  },

  // ====== MEDIA EXTRACTION (3-LEVEL CASCADE) ======

  _mediaResult: null,  // cached result for apply
  _mediaStep: 1,       // 1=IP input, 2=select work, 3=result
  _mediaWorks: [],     // list of sub-works from /list-sub-works
  _mediaIPName: '',    // original IP name entered by user

  openMediaExtract() {
    this._checkServerReady().then(ok => {
      if (!ok) { UIManager.toast('请先在API配置页面配置API后再使用提取功能', 'warning'); return; }
      // Reset to step 1
      this._mediaStep = 1;
      this._mediaWorks = [];
      this._mediaResult = null;
      this._mediaIPName = '';
      document.getElementById('media-work-name').value = '';
      document.getElementById('media-extra-text').value = '';
      this._updateMediaSteps();
      UIManager.showModal('media-extract-modal');
      setTimeout(() => document.getElementById('media-work-name').focus(), 100);
    });
  },

  _updateMediaSteps() {
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`media-step-${i}`);
      if (stepEl) {
        stepEl.style.background = i === this._mediaStep ? 'var(--accent)' : 'var(--card)';
        stepEl.style.color = i === this._mediaStep ? 'var(--bg)' : 'var(--text-dim)';
      }
      const contentEl = document.getElementById(`media-step${i}-content`);
      if (contentEl) contentEl.style.display = i === this._mediaStep ? '' : 'none';
    }
    const title = { 1: '🎬 影视/文学信息提取', 2: '📋 选择特定作品', 3: '✅ 确认设定信息' };
    const titleEl = document.getElementById('media-modal-title');
    if (titleEl) titleEl.textContent = title[this._mediaStep] || title[1];
  },

  async doMediaExtract() {
    const workName = document.getElementById('media-work-name').value.trim();
    if (!workName) { UIManager.toast('请输入作品名称', 'warning'); return; }

    this._mediaIPName = workName;
    const btn = document.getElementById('btn-media-extract');
    btn.disabled = true;
    btn.textContent = '⏳ AI正在查询...';

    try {
      // Step 1: Query sub-works list (via AIBridge)
      const data = await AIBridge.listSubWorks(workName);
      btn.disabled = false;
      btn.textContent = '🔍 开始提取';

      if (data.ok && data.works && data.works.length > 1) {
        // Multiple sub-works found → show step 2 for user to pick
        this._mediaWorks = data.works;
        this._renderWorksList(data.works);
        this._mediaStep = 2;
        this._updateMediaSteps();
      } else if (data.ok && data.works && data.works.length === 1) {
        // Only one work → skip to step 3 directly
        this._fetchSpecificWork(data.works[0].name);
      } else {
        // No sub-works found or error → use original name as work name
        this._fetchSpecificWork(workName);
      }
    } catch(e) {
      btn.disabled = false;
      btn.textContent = '🔍 开始提取';
      // Fallback: try original name directly
      this._fetchSpecificWork(workName);
    }
  },

  selectMediaWork(workName) {
    this._fetchSpecificWork(workName);
  },

  async _fetchSpecificWork(workName) {
    const btn = document.getElementById('btn-media-extract');
    const workType = document.getElementById('media-work-type').value;
    const extraText = document.getElementById('media-extra-text').value.trim();

    const resultDiv = document.getElementById('media-extract-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="color:var(--text-dim);text-align:center;">🔍 AI正在检索作品信息，请稍候...</p>';

    // If still on step 1 or 2, show loading in step3 area
    if (this._mediaStep < 3) {
      this._mediaStep = 3;
      this._updateMediaSteps();
    }

    try {
      const result = await AIBridge.extractMedia(workName, workType);

      if (result.ok) {
        this._mediaResult = result.data;
        this._showMediaPreview(result.data);
        document.getElementById('btn-media-apply').style.display = '';
        UIManager.toast('提取成功！检查预览后点击「应用此设定」', 'success');
      } else {
        resultDiv.innerHTML = `<p style="color:var(--danger);">❌ ${result.error || '提取失败'}</p>`;
        UIManager.toast(result.error || 'AI提取失败', 'error');
      }
    } catch(e) {
      resultDiv.innerHTML = `<p style="color:var(--danger);">❌ 连接失败：${e.message}</p>`;
      UIManager.toast('提取失败：' + e.message, 'error');
    }
  },

  _renderWorksList(works) {
    const container = document.getElementById('media-works-list');
    container.innerHTML = '';
    works.forEach(w => {
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;';
      card.onmouseenter = () => { card.style.borderColor = 'var(--accent)'; card.style.background = 'var(--bg)'; };
      card.onmouseleave = () => { card.style.borderColor = 'var(--border)'; card.style.background = 'var(--card)'; };
      card.onclick = () => SetupWizard.selectMediaWork(w.name);
      card.innerHTML = `<div style="font-size:14px;font-weight:bold;color:var(--accent);margin-bottom:4px;">${w.name}</div>
        <div style="font-size:12px;color:var(--text-dim);">${w.brief || ''}</div>`;
      container.appendChild(card);
    });
  },

  backToMediaStep1() {
    this._mediaStep = 1;
    this._mediaWorks = [];
    this._mediaResult = null;
    document.getElementById('media-extract-result').style.display = 'none';
    this._updateMediaSteps();
  },

  backToMediaStep2() {
    if (this._mediaWorks.length > 1) {
      this._mediaStep = 2;
      this._renderWorksList(this._mediaWorks);
      this._updateMediaSteps();
    } else {
      this.backToMediaStep1();
    }
  },

  _showMediaPreview(data) {
    const resultDiv = document.getElementById('media-extract-result');
    const sideChars = (data.sideCharacters || []).map(c =>
      `<span style="color:var(--gold-light);">${c.name}</span>(${c.role})`
    ).join('、') || '无';

    resultDiv.innerHTML = `
      <div style="color:var(--accent);font-size:14px;font-weight:bold;margin-bottom:8px;">📋 ${data.workName || '未知作品'}</div>
      <div style="color:var(--text-dim);font-size:12px;margin-bottom:12px;">类型：${data.workType || '未知'} | 冒险类型：${data.genre || '未知'}</div>
      ${data.mainPlot ? `<div style="margin-bottom:8px;"><span style="color:var(--gold);">📖 主线：</span><span style="color:var(--text-dim);font-size:13px;">${data.mainPlot}</span></div>` : ''}
      <div style="margin-bottom:8px;"><span style="color:var(--gold);">🌍 世界观：</span><span style="color:var(--text-dim);font-size:13px;">${(data.world || '').substring(0, 120)}...</span></div>
      <div style="margin-bottom:8px;"><span style="color:var(--gold);">👤 主角：</span><span style="color:var(--text);">${data.name || '未知'}${data.age ? ` (${data.age}岁)` : ''}</span></div>
      <div><span style="color:var(--gold);">👥 配角：</span><span style="color:var(--text-dim);font-size:13px;">${sideChars}</span></div>
    `;
  },

  applyMediaExtract() {
    if (!this._mediaResult) { UIManager.toast('没有可应用的提取结果', 'warning'); return; }
    const data = this._mediaResult;

    // Use existing _fillSettings for main fields
    this._fillSettings(data);

    // === Side Characters → characterBios ===
    const sideChars = data.sideCharacters || [];
    if (sideChars.length > 0) {
      const gs = GameEngine.state;
      if (!gs.characterBios) gs.characterBios = [];

      // Keep existing protagonist entry if present, otherwise add from extract
      const existingProt = gs.characterBios.find(c => c.role === 'protagonist');
      if (!existingProt && data.name) {
        gs.characterBios.unshift({
          id: 'bio_' + Date.now().toString(36),
          name: data.name || '主角',
          role: 'protagonist',
          appearance: data.appearance || '',
          personality: data.personality || '',
          bg: data.background || '',
          ability: data.ability || '',
          goal: data.goal || '',
          notes: data.oneLine || '',
        });
      }

      // Add side characters (avoid duplicates by name)
      const roleLabels = {
        antagonist: '反派/对手',
        ally: '伙伴/盟友',
        mentor: '导师',
        rival: '竞争对手',
        neutral: '中立角色'
      };
      const existingNames = new Set(gs.characterBios.map(c => c.name));
      sideChars.forEach(c => {
        if (c.name && !existingNames.has(c.name)) {
          gs.characterBios.push({
            id: 'bio_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
            name: c.name,
            role: c.role || 'ally',
            appearance: c.appearance || '',
            personality: c.personality || '',
            bg: c.bg || '',
            ability: c.ability || '',
            goal: c.goal || '',
            notes: c.notes || (roleLabels[c.role] || ''),
          });
          existingNames.add(c.name);
        }
      });
    }

    UIManager.hideModal('media-extract-modal');
    UIManager.toast(`「${data.workName || data.name || '作品'}」设定已应用！人物小传也已同步`, 'success');

    // Scroll to top of setup card to review
    document.getElementById('setup-card').scrollTop = 0;
    SetupWizard.switchTab(0);
  },

  triggerMediaFile() {
    document.getElementById('media-file-input').click();
  },

  async handleMediaFile(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await this._readFile(file);
      document.getElementById('media-extra-text').value = text.substring(0, 15000);
      UIManager.toast('文件内容已加载到补充文本区', 'success');
    } catch(e) {
      UIManager.toast('文件读取失败：' + e.message, 'error');
    }
    input.value = '';
  },

  // ====== WORLD GEN MODAL ======

  openWorldGenModal() {
    this._checkServerReady().then(ok => {
      if (!ok) { UIManager.toast('请先在API配置页面配置API后再使用', 'warning'); return; }
      document.getElementById('wgen-keyword').value = '';
      document.getElementById('wgen-loading-area').style.display = 'none';
      UIManager.showModal('world-gen-modal');
      setTimeout(() => document.getElementById('wgen-keyword').focus(), 100);
    });
  },

  async doWorldGenFromModal(isRandom) {
    const keyword = isRandom ? '' : document.getElementById('wgen-keyword').value.trim();
    UIManager.hideModal('world-gen-modal');

    // Show loading overlay (same as before)
    this._showWorldGenLoading(keyword || '随机生成');

    try {
      const data = await AIBridge.generateCompleteWorld({ keyword });
      this._hideWorldGenLoading();

      // generateCompleteWorld 返回的是直接解析的 JSON，不是 {ok, data} 包装
      if (data && typeof data === 'object' && !data.error) {
        const prot = data.protagonist || data.protagonist_data || {};
        const mapped = {
          genre: data.genre || keyword || '',
          worldName: data.world_name || data.worldName || (keyword || ''),
          worldDesc: data.world_desc || data.worldDesc || '',
          era: data.era || '',
          locations: data.locations || '',
          factions: data.factions || '',
          powerSystem: data.power_system || data.powerSystem || '',
          protagonist: {
            name: prot.name || '',
            age: prot.age || '',
            sex: prot.sex || '',
            personality: prot.personality || '',
            oneLine: prot.oneLine || prot.one_line || '',
            appearance: prot.appearance || '',
            background: prot.background || '',
            ability: prot.ability || '',
            goal: prot.goal || '',
          },
          _keyword: keyword,
        };
        this._fillAllSettings(mapped);
        UIManager.toast('世界生成完成！请检查并调整设定', 'success');
      } else {
        UIManager.toast(data.error || '数据解析失败，请重试', 'error');
      }
    } catch(e) {
      this._hideWorldGenLoading();
      UIManager.toast('生成失败：' + e.message, 'error');
    }
  },
};

// ── 确保 MainMenu / SetupWizard 在 onclick 中可访问 ──
window.MainMenu = MainMenu;
window.SetupWizard = SetupWizard;
