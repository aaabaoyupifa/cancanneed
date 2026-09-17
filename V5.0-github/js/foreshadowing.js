// ============================
// FORESHADOWING SYSTEM — 伏笔系统 v2
// ============================
// 点击按钮启用 → 下次手动抉择时触发AI埋设伏笔 → 伏笔栏显示 → 可解除/呼应
// 自动续写不触发（仅手动操作生效）

var Foreshadowing = {
  _active: false,       // 已启用，等待下次抉择
  _used: false,         // 已触发，等待 AI 生成后标记完成
  _plantedCount: 0,     // 累计埋设伏笔数

  // === 用户操作：顶栏按钮切换 ===
  toggle() {
    if (this._active && !this._used) { this.deactivate(); } else { this.activate(); }
  },

  activate() {
    this._active = true;
    this._used = false;
    if (window.GameEngine && window.GameEngine.state) {
      window.GameEngine.state._foreshadowActive = true;
      window.GameEngine.state._foreshadowArmed = false;
    }
    this._updateButtonUI();
    UIManager.toast('🔮 伏笔已就绪 — 将在下一次抉择时埋入剧情', 'success');
  },

  deactivate() {
    this._active = false; this._used = false;
    if (window.GameEngine && window.GameEngine.state) {
      window.GameEngine.state._foreshadowActive = false;
      window.GameEngine.state._foreshadowArmed = false;
    }
    this._updateButtonUI();
  },

  // === 核心判断（供 GameEngine 调用）===
  isPending() { return this._active && !this._used; },
  markRequested() {
    this._used = true;
    if (window.GameEngine && window.GameEngine.state) {
      window.GameEngine.state._foreshadowActive = true;
      window.GameEngine.state._foreshadowArmed = true;
    }
    this._updateButtonUI();
  },

  /** AI 返回成功后调用：记录伏笔到列表 */
  markCompleted(desc) {
    const gs = window.GameEngine.state;
    const entry = {
      id: 'fs_' + Date.now().toString(36),
      desc: desc || '伏笔已埋设',
      chapter: gs.chapter,
      scene: gs.scene,
      plantedAt: new Date().toISOString(),
      status: 'pending',     // pending | resolved | callbacked
      resolvedAt: null,
      callbackTo: null,      // 呼应到的伏笔id
      notes: ''
    };
    // 确保存储在 state 中（存档兼容）
    if (!gs.foreshadows) gs.foreshadows = [];
    gs.foreshadows.push(entry);
    this._plantedCount++;
    this._active = false; this._used = false;
    gs._foreshadowActive = false;
    gs._foreshadowArmed = false;
    this._updateButtonUI();
    this.renderPanel();
    UIManager.toast(`🔮 伏笔已埋入第${gs.chapter}章第${gs.scene}节`, 'success');
  },

  /** 从 AI 正文或状态块中兜底提取伏笔，避免格式偏差导致右栏不落库 */
  extractDescription(data) {
    if (!data) return '';
    const direct = data.status_updates && data.status_updates.foreshadowing;
    if (direct) return String(direct).trim();
    const story = String(data.story || '');
    const patterns = [
      /(?:^|\n)\s*[-*•·]?\s*\*{0,2}伏笔埋设\*{0,2}\s*[:：]\s*([^\n]+)/i,
      /(?:^|\n)\s*【伏笔埋设】\s*[:：]?\s*([^\n]+)/i,
      /(?:^|\n)\s*[-*•·]?\s*\*{0,2}foreshadowing\*{0,2}\s*[:：]\s*([^\n]+)/i,
    ];
    for (const pattern of patterns) {
      const match = story.match(pattern);
      if (match && match[1]) return match[1].replace(/\*+$/,'').trim();
    }
    return '';
  },

  /** 用户主动选择：在下一段剧情中回收/使用该伏笔 */
  armResolve(id) {
    const gs = window.GameEngine && window.GameEngine.state;
    if (!gs || !gs.foreshadows) return;
    const fs = gs.foreshadows.find(f => f.id === id);
    if (!fs || fs.status !== 'pending') return;
    gs._foreshadowResolveId = id;
    gs._foreshadowResolveArmed = true;
    this.renderPanel();
    this._updateButtonUI();
    UIManager.toast(`🔗 已选择伏笔「${fs.desc.slice(0,18)}…」— 将在下一次行动中回收`, 'success');
  },

  cancelResolve() {
    const gs = window.GameEngine && window.GameEngine.state;
    if (!gs) return;
    gs._foreshadowResolveId = null;
    gs._foreshadowResolveArmed = false;
    this.renderPanel();
    this._updateButtonUI();
  },

  getResolvePromptInjection() {
    const gs = window.GameEngine && window.GameEngine.state;
    if (!gs || !gs._foreshadowResolveArmed || !gs.foreshadows) return '';
    const fs = gs.foreshadows.find(f => f.id === gs._foreshadowResolveId && f.status === 'pending');
    if (!fs) { this.cancelResolve(); return ''; }
    return '\n\n【伏笔回收——本段必须执行】\n' +
      `待回收伏笔：第${fs.chapter}章第${fs.scene}节「${fs.desc}」\n` +
      '必须让该伏笔在当前剧情中产生明确作用或揭示新的含义。不要只重复原句；通过事件、人物反应或证据完成回收。\n' +
      '在状态块输出：伏笔回收：' + fs.id + '\n';
  },

  markResolvedByAI() {
    const gs = window.GameEngine && window.GameEngine.state;
    if (!gs || !gs._foreshadowResolveArmed || !gs.foreshadows) return;
    const fs = gs.foreshadows.find(f => f.id === gs._foreshadowResolveId);
    if (fs && fs.status === 'pending') {
      fs.status = 'resolved';
      fs.resolvedAt = new Date().toISOString();
      fs.notes = (fs.notes || '') + ' [由剧情回收]';
      UIManager.toast(`✓ 伏笔「${fs.desc.slice(0,18)}…」已在剧情中回收`, 'success');
    }
    gs._foreshadowResolveId = null;
    gs._foreshadowResolveArmed = false;
    this.renderPanel();
    this._updateButtonUI();
  },
  /** 记录 AI 返回的具体伏笔描述（更新最后一条 pending 的 desc） */
  record(desc) {
    const gs = window.GameEngine.state;
    if (!gs.foreshadows) return;
    const pending = gs.foreshadows.filter(f => f.status === 'pending' && f.desc === '伏笔已埋设').slice(-1);
    if (pending.length > 0 && desc) { pending[0].desc = desc; this.renderPanel(); }
  },

  // === 面板操作：解除 / 呼应 ===
  resolve(id) {
    const gs = window.GameEngine.state;
    if (!gs.foreshadows) return;
    const fs = gs.foreshadows.find(f => f.id === id);
    if (!fs || fs.status !== 'pending') return;
    fs.status = 'resolved';
    fs.resolvedAt = new Date().toISOString();
    this.renderPanel();
    UIManager.toast(`✓ 伏笔「${fs.desc.slice(0,15)}…」已解除`, 'success');
  },

  callback(fromId, toId) {
    const gs = window.GameEngine.state;
    if (!gs.foreshadows) return;
    const from = gs.foreshadows.find(f => f.id === fromId);
    const to = gs.foreshadows.find(f => f.id === toId);
    if (!from || from.status !== 'pending') return;
    from.status = 'callbacked';
    from.resolvedAt = new Date().toISOString();
    from.callbackTo = toId || null;
    if (to) to.notes = (to.notes || '') + ` [被「${from.desc.slice(0,20)}」呼应]`;
    this.renderPanel();
    const label = to ? `→ 「${to.desc.slice(0,15)}…」` : '';
    UIManager.toast(`🔗 伏笔已呼应回收 ${label}`, 'success');
  },

  resolveAll() {
    const gs = window.GameEngine.state;
    if (!gs.foreshadows) return;
    let count = 0;
    for (const fs of gs.foreshadows) {
      if (fs.status === 'pending') { fs.status = 'resolved'; fs.resolvedAt = new Date().toISOString(); count++; }
    }
    if (count > 0) { this.renderPanel(); UIManager.toast(`✓ 已解除 ${count} 条伏笔`, 'success'); }
  },

  deleteEntry(id) {
    const gs = window.GameEngine.state;
    if (!gs.foreshadows) return;
    gs.foreshadows = gs.foreshadows.filter(f => f.id !== id);
    this.renderPanel();
  },

  // === AI 提示词注入 ===
  getPromptInjection() {
    if (!this._active) return '';
    const gs = window.GameEngine.state;
    const all = gs.foreshadows || [];
    const pending = all.filter(f => f.status === 'pending');
    const resolved = all.filter(f => f.status === 'resolved' || f.status === 'callbacked');

    let historyNote = '';
    if (resolved.length > 0) {
      historyNote = '\n【已回收/解除的伏笔——可考虑延续或新埋】\n' +
        resolved.map((f, i) => `  ${i+1}. 第${f.chapter}章：${f.desc}${f.callbackTo ? ' (已呼应)' : ' (已解除)'}`).join('\n') + '\n';
    }
    if (pending.length > 0) {
      historyNote += '\n【待回收的活跃伏笔——本段可考虑暗示性呼应】\n' +
        pending.map((f, i) => `  ${i+1}. 第${f.chapter}章第${f.scene}节：${f.desc}`).join('\n') + '\n';
    }

    return '\n\n【🎭 伏笔系统——本段必须埋设伏笔】\n' +
      '你必须在当前段落的剧情中自然地埋设一个伏笔。要求：\n' +
      '1. 伏笔必须隐蔽——读者初读时不会察觉，但回头重读时会恍然大悟\n' +
      '2. 形式不限：看似无关的细节、不经意的对话、反常的环境描述、角色微妙反应、被忽略的物品\n' +
      '3. 必须与主线或支线有关联\n' +
      '4. 回收应在至少3-5节之后\n' +
      '5. 在状态块中记录：伏笔埋设：<简短描述>\n' +
      historyNote;
  },

  // === UI 渲染：右侧面板伏笔栏 ===
  renderPanel() {
    const container = document.getElementById('foreshadow-panel-list');
    if (!container) return;
    const gs = window.GameEngine.state;
    const all = gs.foreshadows || [];
    const resolveAllBtn = document.getElementById('fs-resolve-all-btn');

    if (all.length === 0) {
      resolveAllBtn.style.display = 'none';
      container.innerHTML = '<div style="font-size:11px;color:var(--text-dim);text-align:center;padding:8px 0;">暂无伏笔 · 点击顶部 🔮 按钮启用</div>';
      return;
    }

    const hasPending = all.some(f => f.status === 'pending');
    resolveAllBtn.style.display = hasPending ? '' : 'none';

    let html = '';
    for (const fs of all) {
      const dotClass = fs.status === 'pending' ? 'pending' : 'resolved';
      const statusLabel = fs.status === 'pending' ? '待回收' :
                          fs.status === 'resolved' ? '已解除' : '已呼应';
      html += `<div class="fs-item">`;
      html += `<div class="fs-dot ${dotClass}" title="${statusLabel}"></div>`;
      html += `<div class="fs-body">`;
      html += `<div class="fs-desc" title="${this._esc(fs.desc)}">${this._esc(fs.desc)}</div>`;
      html += `<div class="fs-meta">第${fs.chapter}章·第${fs.scene}节 · ${statusLabel}</div>`;
      if (fs.status === 'pending') {
        html += `<div class="fs-actions">`;
        const isResolveArmed = gs._foreshadowResolveArmed && gs._foreshadowResolveId === fs.id;
        html += `<button class="fs-btn fs-use${isResolveArmed ? ' active' : ''}" onclick="window.Foreshadowing.${isResolveArmed ? 'cancelResolve()' : `armResolve('${fs.id}')`}">${isResolveArmed ? '取消回收' : '回收'}</button>`;
        html += `<button class="fs-btn" onclick="window.Foreshadowing.resolve('${fs.id}')">解除</button>`;
        html += `<button class="fs-btn fs-delete" onclick="window.Foreshadowing.deleteEntry('${fs.id}')" title="永久删除">删除</button>`;
        // 可选择呼应该条
        if (all.filter(f => f.id !== fs.id && (f.status === 'resolved' || f.status === 'callbacked')).length > 0) {
          html += `<select class="fs-btn" onchange="if(this.value){window.Foreshadowing.callback('${fs.id}',this.value);this.value='';}" style="font-size:9px;">`;
          html += `<option value="">呼应→</option>`;
          for (const other of all.filter(f => f.id !== fs.id && (f.status === 'resolved' || f.status === 'callbacked'))) {
            html += `<option value="${other.id}">${this._esc(other.desc.slice(0,12))}</option>`;
          }
          html += `</select>`;
        }
        html += `</div>`;
      } else if (fs.status === 'callbacked') {
        const target = all.find(f => f.id === fs.callbackTo);
        html += `<div class="fs-meta" style="color:#60aca8;">↩ 呼应了「${target ? this._esc(target.desc.slice(0,12)) : '?'}」</div>`;
      }
      html += `</div></div>`;
    }
    container.innerHTML = html;

    // 统计角标
    const pendingCount = all.filter(f => f.status === 'pending').length;
    if (resolveAllBtn) resolveAllBtn.title = `解除全部 ${pendingCount} 条待回收伏笔`;
  },

  // === 顶栏按钮 UI ===
  _updateButtonUI() {
    const btn = document.getElementById('btn-foreshadow');
    if (!btn) return;
    if (this._active && !this._used) {
      btn.classList.add('active'); btn.textContent = '🔮 就绪';
      btn.title = '伏笔已就绪，将在下一次手动抉择时埋入剧情（点击取消）';
    } else if (this._active && this._used) {
      btn.classList.add('active'); btn.textContent = '🔮 生成中';
      btn.title = '伏笔正在由AI生成…';
    } else {
      btn.classList.remove('active'); btn.textContent = '🔮 伏笔';
      const fs = (window.GameEngine && window.GameEngine.state) ? (window.GameEngine.state.foreshadows || []) : [];
      const total = fs.length;
      const pending = fs.filter(f=>f.status==='pending').length;
      btn.title = `点击启用：在下次手动抉择时，AI会在剧情中巧埋伏笔${total ? `（已有${total}条/${pending}条待回收）` : ''}`;

    }
  },

  _esc(s) {
    const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
  },

  init() {
    const gs = (window.GameEngine && window.GameEngine.state) ? window.GameEngine.state : null;
    if (gs) {
      if (!gs.foreshadows) gs.foreshadows = [];
      this._active = !!gs._foreshadowActive && !gs._foreshadowArmed;
      this._used = !!gs._foreshadowArmed;
      this._plantedCount = gs.foreshadows.length;
      if (gs._foreshadowResolveArmed == null) gs._foreshadowResolveArmed = false;
      if (gs._foreshadowResolveId == null) gs._foreshadowResolveId = null;
    }
    this._updateButtonUI();
    this.renderPanel();
  }
};

// ── 确保 Foreshadowing 在 onclick 中可访问 ──
window.Foreshadowing = Foreshadowing;


