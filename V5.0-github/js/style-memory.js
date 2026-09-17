// ============================
// STYLE MEMORY - 文笔模仿 (三入口：口述/故事/范文)
// ============================
var StyleMemory = {
  async init() {
    this._strength = (window.GameEngine && window.GameEngine.state && window.GameEngine.state.styleStrength) || localStorage.getItem('if-style-strength') || 'strong';
    localStorage.setItem('if-style-strength', this._strength);
    const stateStyle = (window.GameEngine && window.GameEngine.state && window.GameEngine.state.styleMemory) ? window.GameEngine.state.styleMemory : '';
    const saved = stateStyle || localStorage.getItem('if-style-memory');
    if (saved) {
      this._activeStyle = saved;
      if (typeof AIBridge !== 'undefined') AIBridge._styleMemory = saved;
      if (window.GameEngine && window.GameEngine.state) window.GameEngine.state.styleMemory = saved;
      localStorage.setItem('if-style-memory', saved);
      this._setUIActive(this._activeStyle);
    } else {
      this._activeStyle = '';
      if (window.GameEngine && window.GameEngine.state) window.GameEngine.state.styleMemory = '';
      this._setInactive();
    }
  },

  getActiveStyle() {
    return this._activeStyle || '';
  },

  getStrength() {
    return this._strength || localStorage.getItem('if-style-strength') || 'strong';
  },

  setStrength(value) {
    this._strength = ['light', 'standard', 'strong'].includes(value) ? value : 'strong';
    localStorage.setItem('if-style-strength', this._strength);
    if (window.GameEngine && window.GameEngine.state) window.GameEngine.state.styleStrength = this._strength;
    UIManager.toast('文风模仿强度已更新', 'success');
  },

  getStylePrompt() {
    const style = this.getActiveStyle();
    if (!style) return '';
    return '\n【文笔记忆——本章高优先级文风指令】\n' + style + '\n请在本次正文中稳定模仿以上文笔特征：句子节奏、用词偏好、对话风格、描写方式都要贴近；不得只在开头模仿后半段失效。';
  },

  openModal() {
    document.getElementById('style-memory-modal').classList.remove('hidden');
    var statusEl = document.getElementById('sm-status');
    document.getElementById('sm-clear-btn').style.display = statusEl.classList.contains('active') ? 'inline-block' : 'none';
    var previewEl = document.getElementById('sm-preview');
    if (previewEl.textContent) {
      document.getElementById('sm-result').style.display = 'block';
      document.getElementById('sm-result').textContent = previewEl.textContent;
    }
    var editor = document.getElementById('sm-active-editor');
    if (editor) editor.value = this.getActiveStyle();
    var strength = document.getElementById('sm-strength');
    if (strength) strength.value = this.getStrength();
    this.switchTab('desc');
  },

  close() {
    document.getElementById('style-memory-modal').classList.add('hidden');
  },

  /** 切换学习方式 tab */
  switchTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.sm-tab').forEach(function(t) {
      t.classList.remove('active');
      t.style.borderBottomColor = 'transparent';
      t.style.color = 'var(--text-dim)';
    });
    var activeBtn = document.querySelector('.sm-tab[data-tab="' + tab + '"]');
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.borderBottomColor = 'var(--gold)';
      activeBtn.style.color = 'var(--gold)';
    }
    document.querySelectorAll('.sm-panel').forEach(function(p) { p.classList.add('hidden'); });
    var panel = document.getElementById('sm-panel-' + tab);
    if (panel) {
      panel.classList.remove('hidden');
      if (tab === 'story') this._loadStoryPreview();
    }
  },

  /** 加载故事预览 */
  _loadStoryPreview() {
    var gs = (typeof GameEngine !== 'undefined' && GameEngine.state) ? GameEngine.state : null;
    var preview = document.getElementById('sm-story-preview');
    if (!preview) return;
    if (!gs || !gs.storyLog || gs.storyLog.length === 0) {
      if (gs && gs.chapterSummaries && gs.chapterSummaries.length > 0) {
        preview.textContent = gs.chapterSummaries.slice(-3).map(function(s) { return s.summary; }).join('\n');
      } else {
        preview.textContent = '暂无故事内容可提取——请先进行一段剧情再回来。';
      }
      return;
    }
    var narratives = gs.storyLog.filter(function(e) { return e && e.content && ['narrative', 'ai-content', 'story', 'assistant'].includes(e.type); });
    if (narratives.length === 0) {
      if (gs.chapterSummaries && gs.chapterSummaries.length > 0) {
        preview.textContent = gs.chapterSummaries.slice(-3).map(function(s) { return s.summary; }).join('\n');
      } else {
        preview.textContent = '暂无故事内容可提取';
      }
      return;
    }
    var snippets = narratives.slice(-3).map(function(n) {
      return (n.content || '').slice(0, 150).replace(/\s+/g, ' ');
    });
    preview.textContent = snippets.join('\n\n---\n\n');
  },

  /** 口述风格 → AI 生成写作规则 */
  async learnFromDesc() {
    var desc = document.getElementById('sm-desc-text').value.trim();
    if (!desc || desc.length < 10) {
      UIManager.toast('请至少输入10个字描述你想要的风格', 'warning');
      return;
    }
    var btn = document.querySelector('#sm-panel-desc .btn');
    btn.disabled = true; btn.textContent = '分析中...';
    document.getElementById('sm-result').style.display = 'none';
    try {
      var style = await AIBridge.learnStyleFromDesc(desc);
      if (style) {
        this._setActive(style);
        this._showResult(style);
        UIManager.toast('风格已学习！', 'success');
      } else {
        UIManager.toast('学习失败：AI 未返回有效结果', 'error');
      }
    } catch(e) {
      UIManager.toast('请求失败：' + e.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '从描述学习'; }
  },

  /** 从当前故事提取风格 */
  async learnFromStory() {
    var gs = (typeof GameEngine !== 'undefined' && GameEngine.state) ? GameEngine.state : null;
    var text = '';
    if (gs && gs.storyLog) {
      var narratives = gs.storyLog.filter(function(e) { return e && e.content && ['narrative', 'ai-content', 'story', 'assistant'].includes(e.type); });
      text = narratives.slice(-5).map(function(n) { return n.content || ''; }).join('\n\n').slice(0, 4000);
    }
    if (!text && gs && gs.chapterSummaries) {
      text = gs.chapterSummaries.slice(-5).map(function(s) { return s.summary; }).join('\n');
    }
    if (!text) {
      UIManager.toast('暂无故事内容，请先进行一段剧情', 'warning');
      return;
    }
    var btn = document.querySelector('#sm-panel-story .btn');
    btn.disabled = true; btn.textContent = '分析中...';
    document.getElementById('sm-result').style.display = 'none';
    try {
      var style = await AIBridge.learnStyle(text);
      if (style) {
        this._setActive(style);
        this._showResult(style);
        UIManager.toast('从故事中学习成功！', 'success');
      } else {
        UIManager.toast('学习失败：AI 未返回有效结果', 'error');
      }
    } catch(e) {
      UIManager.toast('请求失败：' + e.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '从当前故事学习'; }
  },

  /** 贴范文学习（原逻辑） */
  async learn() {
    var text = document.getElementById('sm-sample-text').value.trim();
    if (!text || text.length < 100) {
      UIManager.toast('范文至少需要100字', 'warning');
      return;
    }
    var btn = document.querySelector('#sm-panel-paste .btn');
    btn.disabled = true; btn.textContent = '分析中...';
    document.getElementById('sm-result').style.display = 'none';
    try {
      var style = await AIBridge.learnStyle(text);
      if (style) {
        this._setActive(style);
        this._showResult(style);
        UIManager.toast('文笔学习成功！后续剧情将模仿此风格', 'success');
      } else {
        UIManager.toast('学习失败：AI 未返回有效结果', 'error');
      }
    } catch(e) {
      UIManager.toast('请求失败：' + e.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '学习文笔'; }
  },

  applyManualEdit() {
    var editor = document.getElementById('sm-active-editor');
    var text = editor ? editor.value.trim() : '';
    if (!text) {
      UIManager.toast('请输入要应用的文风规则', 'warning');
      return;
    }
    this._setActive(text);
    this._showResult(text);
    UIManager.toast('文风修改已保存，下一段剧情立即生效', 'success');
  },

  async clear() {
    AIBridge.clearStyle();
    localStorage.removeItem('if-style-memory');
    if (window.GameEngine && window.GameEngine.state) window.GameEngine.state.styleMemory = '';
    this._setInactive();
    document.getElementById('sm-result').style.display = 'none';
    document.getElementById('sm-desc-text').value = '';
    document.getElementById('sm-sample-text').value = '';
    var editor = document.getElementById('sm-active-editor');
    if (editor) editor.value = '';
    UIManager.toast('文笔记忆已清除', 'success');
    this.close();
  },

  _showResult(text) {
    document.getElementById('sm-result').style.display = 'block';
    document.getElementById('sm-result').textContent = text;
    var editor = document.getElementById('sm-active-editor');
    if (editor) editor.value = text;
  },

  _setActive(styleText) {
    this._activeStyle = styleText;
    if (typeof AIBridge !== 'undefined') AIBridge._styleMemory = styleText;
    if (window.GameEngine && window.GameEngine.state) window.GameEngine.state.styleMemory = styleText;
    localStorage.setItem('if-style-memory', styleText);
    this._setUIActive(styleText);
  },

  _setUIActive(styleText) {
    var statusEl = document.getElementById('sm-status');
    statusEl.textContent = '已学习';
    statusEl.className = 'sm-status active';
    var previewEl = document.getElementById('sm-preview');
    previewEl.textContent = styleText.length > 120 ? styleText.substring(0, 120) + '…' : styleText;
    previewEl.classList.remove('hidden');
    document.getElementById('sm-clear-btn').style.display = 'inline-block';
  },

  _setInactive() {
    this._activeStyle = '';
    var statusEl = document.getElementById('sm-status');
    statusEl.textContent = '未学习';
    statusEl.className = 'sm-status';
    document.getElementById('sm-preview').classList.add('hidden');
    document.getElementById('sm-clear-btn').style.display = 'none';
  },

  async loadPreset(name) {
    var style = AIBridge.loadStylePreset(name);
    if (style) {
      this._setActive(style);
      this._showResult(style);
      UIManager.toast('文笔预设「' + name + '」已加载', 'success');
    } else {
      UIManager.toast('预设「' + name + '」不存在', 'error');
    }
  },
};
window.StyleMemory = StyleMemory;
