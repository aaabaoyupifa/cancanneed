// ============================
// PLOT PLAN MANAGER
// ============================
window.PLOT_GENRES = [
  { id: 'standard', label: '王道', desc: '标准叙事节奏，起承转合完整' },
  { id: 'suspense', label: '悬疑', desc: '层层悬念，信息差驱动，反转密集' },
  { id: 'relax', label: '休闲', desc: '轻松日常，慢节奏，注重氛围与情感' },
  { id: 'cultivation', label: '修仙', desc: '境界体系，机缘奇遇，战斗升级' },
  { id: 'dark', label: '暗黑', desc: '残酷现实，道德灰色，压抑氛围' },
  { id: 'warm', label: '温馨', desc: '治愈系，角色成长，友情羁绊' },
  { id: 'epic', label: '热血', desc: '宏大场面，高潮迭起，英雄主义' },
  { id: 'comedy', label: '搞笑', desc: '幽默诙谐，轻松吐槽，反套路' },
];

var PlotPlanManager = {
  show() {
    const pp = this.normalize();
    if (!pp) return;
    this.syncProgressFromStoryLog({ emitTransition: false });
    document.getElementById('plot-total-words').value = pp.totalWords;
    this._renderPhases();
    this._renderSummary();
    document.getElementById('plot-plan-modal').classList.remove('hidden');
  },

  _renderPhases() {
    const pp = GameEngine.state.plotPlan;
    const list = document.getElementById('phase-list');
    const phases = pp.phases || [];
    list.innerHTML = phases.map((p, i) => {
      const isActive = i === pp.currentPhaseIdx;
      const pct = Math.min(100, p.wordBudget > 0 ? (p.wordsWritten / p.wordBudget * 100) : 0);
      const overBudget = p.wordsWritten > p.wordBudget;
      const genre = p.genre || 'standard';
      const genreLabel = PLOT_GENRES.find(g => g.id === genre)?.label || '王道';
      const genreOptions = PLOT_GENRES.map(g => `<option value="${g.id}"${g.id === genre ? ' selected' : ''}>${g.label}</option>`).join('');
      return `
        <div class="phase-item${isActive ? ' active' : ''}">
          <div class="phase-row">
            <span style="font-size:12px;color:var(--text-dim);min-width:20px;">${i + 1}.</span>
            <input type="text" value="${this._esc(p.name)}" placeholder="阶段名" onchange="PlotPlanManager._updatePhase(${i},'name',this.value)" style="flex:1;">
            <select onchange="PlotPlanManager._updatePhase(${i},'genre',this.value)" title="${PLOT_GENRES.find(g=>g.id===genre)?.desc||''}" style="font-size:11px;width:56px;flex-shrink:0;background:var(--input-bg);border:1px solid var(--border);color:var(--gold);border-radius:3px;padding:2px;">
              ${genreOptions}
            </select>
            <input type="text" value="${this._esc(p.desc)}" placeholder="描述" onchange="PlotPlanManager._updatePhase(${i},'desc',this.value)" style="flex:2;">
            <input type="number" class="phase-pct" value="${p.wordPct}" min="5" max="80" onchange="PlotPlanManager._updatePhase(${i},'wordPct',parseInt(this.value)||0);PlotPlanManager._recalc();" title="字数占比%">
            <span class="phase-budget">${p.wordBudget.toLocaleString()}字</span>
            <button class="phase-del" onclick="PlotPlanManager.deletePhase(${i})" title="删除">✕</button>
          </div>
          <div style="font-size:9px;color:var(--text-dim);margin-left:28px;margin-bottom:3px;">🎭 风格：${genreLabel}</div>
          <div class="phase-progress">
            <div class="phase-progress-text">已写 ${p.wordsWritten.toLocaleString()} / ${p.wordBudget.toLocaleString()} 字 (${Math.round(pct)}%)</div>
            <div class="phase-progress-bar">
              <div class="phase-progress-fill${overBudget ? ' over' : ''}" style="width:${Math.min(100, pct)}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Update percentage total
    const totalPct = phases.reduce((s, p) => s + (p.wordPct || 0), 0);
    document.getElementById('phase-pct-total').textContent = totalPct + '%';
    if (totalPct !== 100) {
      document.getElementById('phase-pct-total').style.color = 'var(--danger)';
    } else {
      document.getElementById('phase-pct-total').style.color = 'var(--text-dim)';
    }
  },

  _renderSummary() {
    const pp = GameEngine.state.plotPlan;
    const totalBudget = pp.phases.reduce((s, p) => s + p.wordBudget, 0);
    const currentPhase = pp.phases[pp.currentPhaseIdx];
    document.getElementById('plot-summary').style.display = '';
    document.getElementById('sum-total-budget').textContent = totalBudget.toLocaleString() + '字';
    document.getElementById('sum-current-phase').textContent = currentPhase ? `${currentPhase.name}（第${pp.currentPhaseIdx + 1}/${pp.phases.length}阶段）` : '-';
    document.getElementById('sum-written').textContent = pp.totalWordsWritten.toLocaleString() + '字';
  },

  addPhase() {
    const pp = GameEngine.state.plotPlan;
    const id = 'phase_' + Date.now().toString(36);
    pp.phases.push({ id, name: '新阶段', desc: '', wordPct: 10, wordBudget: 0, wordsWritten: 0, genre: 'standard' });
    this._recalc();
    this._renderPhases();
  },

  deletePhase(idx) {
    const pp = GameEngine.state.plotPlan;
    if (pp.phases.length <= 1) { UIManager.toast('至少保留一个阶段', 'warning'); return; }
    const removed = pp.phases.splice(idx, 1)[0];
    if (pp.currentPhaseIdx >= pp.phases.length) pp.currentPhaseIdx = pp.phases.length - 1;
    pp.totalWordsWritten = Math.max(0, pp.totalWordsWritten - removed.wordsWritten);
    this._recalc();
    this._renderPhases();
    this._renderSummary();
  },

  _updatePhase(idx, field, value) {
    const pp = GameEngine.state.plotPlan;
    const phase = pp.phases[idx];
    if (!phase) return;
    phase[field] = value;
    if (field === 'wordPct') this._recalc();
  },

  _recalc() {
    const pp = GameEngine.state.plotPlan;
    const totalWords = parseInt(document.getElementById('plot-total-words').value) || pp.totalWords;
    pp.totalWords = totalWords;
    pp.phases.forEach(p => {
      p.wordBudget = Math.round(totalWords * (p.wordPct || 0) / 100);
    });
    this._renderPhases();
    this._renderSummary();
  },

  async save() {
    const pp = this.normalize();
    const totalWords = parseInt(document.getElementById('plot-total-words').value) || pp.totalWords;
    pp.totalWords = totalWords;
    pp.phases.forEach(p => {
      p.wordBudget = Math.round(totalWords * (p.wordPct || 0) / 100);
      p.wordsWritten = p.wordsWritten || 0;
    });
    const totalPct = pp.phases.reduce((s, p) => s + (p.wordPct || 0), 0);
    if (Math.abs(totalPct - 100) > 1) {
      UIManager.toast('各阶段占比之和应为100%，当前为' + totalPct + '%', 'warning');
      return;
    }
    pp.enabled = true;
    this.syncProgressFromStoryLog({ emitTransition: false });
    UIManager.hideModal('plot-plan-modal');
    this._updateButtonBadge();
    UIManager.toast('剧情规划已保存！已按当前正文重新判定字数与阶段', 'success');
    if (typeof SaveManager !== 'undefined' && GameEngine.state.gameStarted) {
      try { await SaveManager.quickSave(); } catch(e) { console.warn('[PlotPlan] save persist failed:', e); }
    }
  },

  reset() {
    if (!confirm('确定重置剧情规划？这将清除所有进度数据。')) return;
    const pp = GameEngine.state.plotPlan;
    pp.enabled = false;
    pp.totalWords = 30000;
    pp.phases = [
      { id: 'beginning', name: '开端', desc: '引入主角、展示世界观、建立核心冲突', wordPct: 20, wordBudget: 6000, wordsWritten: 0, genre: 'standard' },
      { id: 'development', name: '发展', desc: '深化冲突、展开支线、角色成长', wordPct: 35, wordBudget: 10500, wordsWritten: 0, genre: 'standard' },
      { id: 'climax', name: '高潮', desc: '矛盾集中爆发、各方势力交锋、核心冲突到达顶点', wordPct: 30, wordBudget: 9000, wordsWritten: 0, genre: 'epic' },
      { id: 'ending', name: '结局', desc: '收束伏线、解决冲突、留下余韵', wordPct: 15, wordBudget: 4500, wordsWritten: 0, genre: 'warm' },
    ];
    pp.currentPhaseIdx = 0;
    pp.totalWordsWritten = 0;
    this._updateButtonBadge();
    UIManager.toast('剧情规划已重置', 'warning');
  },

  /** 修复/兼容旧存档中的规划数据 */
  normalize() {
    const gs = (typeof GameEngine !== 'undefined' && GameEngine.state) ? GameEngine.state : null;
    if (!gs) return null;
    if (!gs.plotPlan) {
      gs.plotPlan = {
        enabled: false, totalWords: 30000, currentPhaseIdx: 0, totalWordsWritten: 0,
        phases: [
          { id:'beginning', name:'开端', desc:'引入主角、展示世界观、建立核心冲突', wordPct:20, wordBudget:6000, wordsWritten:0, genre:'standard' },
          { id:'development', name:'发展', desc:'深化冲突、展开支线、角色成长', wordPct:35, wordBudget:10500, wordsWritten:0, genre:'standard' },
          { id:'climax', name:'高潮', desc:'矛盾集中爆发、各方势力交锋、核心冲突到达顶点', wordPct:30, wordBudget:9000, wordsWritten:0, genre:'epic' },
          { id:'ending', name:'结局', desc:'收束伏线、解决冲突、留下余韵', wordPct:15, wordBudget:4500, wordsWritten:0, genre:'warm' }
        ]
      };
    }
    const pp = gs.plotPlan;
    pp.totalWords = Math.max(1000, Number(pp.totalWords) || 30000);
    pp.totalWordsWritten = Math.max(0, Number(pp.totalWordsWritten) || 0);
    pp.currentPhaseIdx = Math.max(0, Number(pp.currentPhaseIdx) || 0);
    if (!Array.isArray(pp.phases) || !pp.phases.length) pp.phases = [];
    pp.phases.forEach((phase, i) => {
      phase.id = phase.id || ('phase_' + i);
      phase.name = phase.name || ('阶段' + (i + 1));
      phase.desc = phase.desc || '';
      phase.wordPct = Math.max(0, Number(phase.wordPct) || 0);
      phase.wordBudget = Math.max(0, Number(phase.wordBudget) || Math.round(pp.totalWords * phase.wordPct / 100));
      phase.wordsWritten = Math.max(0, Number(phase.wordsWritten) || 0);
      phase.genre = phase.genre || 'standard';
    });
    pp.currentPhaseIdx = Math.min(pp.currentPhaseIdx, Math.max(0, pp.phases.length - 1));
    return pp;
  },

  /** 按正文有效字符计数，与旧版本口径保持一致 */
  countWords(text) {
    const source = String(text || '')
      .replace(/【选项】[\s\S]*$/g, '')
      .replace(/【状态】[\s\S]*$/g, '')
      .replace(/```[\s\S]*?```/g, '');
    return source.replace(/[\s\n\r【】「」『』《》"'、。，；：？！…—\-\*\.\/\\()（）\[\]{}|#@\$%^&+=<>~`]/g, '').length;
  },

  /**
   * 以 storyLog 为唯一事实来源重建进度。
   * 解决：后开启规划不计历史正文、读档归零、撤销后字数不回退、重复统计等问题。
   */
  syncProgressFromStoryLog(options) {
    const opts = options || {};
    const pp = this.normalize();
    if (!pp || !pp.phases.length) return null;
    const gs = GameEngine.state;
    const previousIdx = pp.currentPhaseIdx || 0;
    const narratives = Array.isArray(gs.storyLog)
      ? gs.storyLog.filter(e => e && e.content && ['narrative', 'ai-content', 'story', 'assistant'].includes(e.type))
      : [];
    const total = narratives.reduce((sum, entry) => sum + this.countWords(entry.content), 0);
    pp.totalWordsWritten = total;

    let remaining = total;
    pp.phases.forEach((phase, i) => {
      const budget = Math.max(0, Number(phase.wordBudget) || 0);
      if (i === pp.phases.length - 1) {
        phase.wordsWritten = Math.max(0, remaining);
        remaining = 0;
      } else {
        phase.wordsWritten = budget > 0 ? Math.min(remaining, budget) : 0;
        remaining = Math.max(0, remaining - phase.wordsWritten);
      }
    });

    let idx = 0;
    while (idx < pp.phases.length - 1) {
      const phase = pp.phases[idx];
      const threshold = (phase.wordBudget || 0) * 0.9;
      if (threshold > 0 && phase.wordsWritten >= threshold) idx++;
      else break;
    }
    pp.currentPhaseIdx = idx;
    const phaseChanged = idx !== previousIdx;
    if (opts.emitTransition && phaseChanged) {
      const oldPhase = pp.phases[Math.min(previousIdx, pp.phases.length - 1)];
      const newPhase = pp.phases[idx];
      pp._pendingTransition = `故事已根据实际正文进度从「${oldPhase.name}」推进到「${newPhase.name}」阶段（${newPhase.desc}）。请自然承接，不要生硬切换。`;
    }
    pp._lastSyncedNarrativeCount = narratives.length;
    return { totalWords: total, phaseChanged, newPhase: phaseChanged ? pp.phases[idx] : null };
  },

  /** Track words written in a newly generated story segment */
  trackWords(storyText) {
    const pp = this.normalize();
    if (!pp || !pp.enabled || !pp.phases.length) return null;
    const synced = this.syncProgressFromStoryLog({ emitTransition: true });
    if (!synced) return null;
    return {
      wordCount: this.countWords(storyText),
      totalWords: synced.totalWords,
      phaseChanged: synced.phaseChanged,
      newPhase: synced.newPhase
    };
  },

  /** Get pending transition context (consumed after reading) */
  getTransitionContext() {
    const pp = GameEngine.state.plotPlan;
    if (!pp || !pp._pendingTransition) return '';
    const ctx = pp._pendingTransition;
    pp._pendingTransition = null; // consume once
    return ctx;
  },

  /** Get pacing context for AI prompt — 含进度数据 + 风格指导 */
  getPacingContext() {
    const pp = this.normalize();
    if (!pp || !pp.enabled) return '';
    this.syncProgressFromStoryLog({ emitTransition: false });
    const phases = pp.phases || [];
    const currentIdx = pp.currentPhaseIdx;
    const phase = phases[currentIdx];
    if (!phase) return '';

    const wordBudget = phase.wordBudget || 0;
    const wordsWritten = phase.wordsWritten || 0;
    const wordsRemaining = Math.max(0, wordBudget - wordsWritten);
    const totalWords = pp.totalWords || 0;
    const totalWritten = pp.totalWordsWritten || 0;
    const totalPct = totalWords > 0 ? Math.round(totalWritten / totalWords * 100) : 0;
    const phasePct = wordBudget > 0 ? Math.round(wordsWritten / wordBudget * 100) : 0;

    // 风格信息
    const genre = phase.genre || 'standard';
    const genreInfo = PLOT_GENRES.find(g => g.id === genre) || PLOT_GENRES[0];
    const genreNote = `\n【本阶段剧情结构倾向：${genreInfo.label}】${genreInfo.desc} — 只影响事件密度、冲突安排与情节走向，不覆盖用户选择的文风、视角和句式。`;

    // Phase overview
    const overview = phases.map((p, i) => {
      const pct = p.wordBudget > 0 ? Math.round(p.wordsWritten / p.wordBudget * 100) : 0;
      const pg = PLOT_GENRES.find(g => g.id === (p.genre||'standard'));
      const marker = i === currentIdx ? '◀ 当前' : (pct >= 90 ? '✓' : '○');
      return `${marker} ${i + 1}. ${p.name}（${p.wordPct}% / ${p.wordBudget.toLocaleString()}字）${pg?` [${pg.label}]`:''}${pct}%完成`;
    }).join('\n');

    return `【剧情规划——进度数据】\n当前阶段：${phase.name || '未命名'}（第${currentIdx + 1}/${phases.length}阶段）\n阶段目标：${phase.desc || '未设定'}${genreNote}\n本阶段：${wordBudget.toLocaleString()}字 | 已写${wordsWritten.toLocaleString()}字 | 剩余${wordsRemaining.toLocaleString()}字（${phasePct}%）\n总目标：${totalWords.toLocaleString()}字 | 已完成${totalWritten.toLocaleString()}字（${totalPct}%）\n\n【阶段概览】\n${overview}`;
  },

  _updateButtonBadge() {
    const btn = document.getElementById('btn-plot-plan');
    if (!btn) return;
    // Guard: GameEngine may not be loaded yet (script load order)
    const pp = (typeof GameEngine !== 'undefined' && GameEngine.state && GameEngine.state.plotPlan);
    if (pp && pp.enabled) {
      btn.style.borderColor = 'var(--gold)';
      btn.style.color = 'var(--gold-light)';
      const written = Number(pp.totalWordsWritten) || 0;
      const pct = pp.totalWords > 0 ? Math.round(written / pp.totalWords * 100) : 0;
      btn.title = `剧情规划：已写${written.toLocaleString()} / ${pp.totalWords.toLocaleString()}字（${pct}%）`;
    } else {
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.title = '剧情规划';
    }
  },

  _esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
};
// ── 确保 PlotPlanManager 在 onclick 中可访问（const 不挂 window）──
window.PlotPlanManager = PlotPlanManager;
