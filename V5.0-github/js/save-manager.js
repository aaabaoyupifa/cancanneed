// ============================
// SAVE MANAGER — localStorage-based (APK版)
// ============================
var SaveManager = {
  async showSave() {
    if (!GameEngine.state.gameStarted) { UIManager.toast('请先开始游戏', 'warning'); return; }
    const container = document.getElementById('save-slots');
    container.innerHTML = '<p style="text-align:center;color:var(--text-dim);">加载存档列表...</p>';
    document.getElementById('save-modal').classList.remove('hidden');

    try {
      const data = await Storage.list();
      const saveMap = {};
      if (data.ok) data.saves.forEach(s => { saveMap[s.slot] = s; });

      container.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const info = saveMap[i] || null;
        const div = document.createElement('div');
        div.className = 'save-slot';
        const metaText = info ? (info.meta.playerName || '?') + ' · 第' + (info.meta.chapter || '?') + '章第' + (info.meta.scene || '?') + '节 · ' + (info.time || '') : '空';
        div.innerHTML = '<div><div style="color:var(--text);">存档槽 ' + (i + 1) + '</div><div class="slot-info">' + metaText + '</div></div><div class="slot-actions"><button class="btn primary" onclick="SaveManager.save(' + i + ')">保存</button>' + (info ? '<button class="btn danger" onclick="SaveManager.confirmDelete(' + i + ',\'save\')" style="margin-left:6px;">删除</button>' : '') + '</div>';
        container.appendChild(div);
      }
    } catch (e) {
      container.innerHTML = '<p style="text-align:center;color:var(--danger);">读取存档列表失败</p>';
    }
  },

  async showLoad() {
    const container = document.getElementById('load-slots');
    container.innerHTML = '<p style="text-align:center;color:var(--text-dim);">加载存档列表...</p>';
    document.getElementById('load-modal').classList.remove('hidden');

    try {
      const data = await Storage.list();
      const saveMap = {};
      if (data.ok) data.saves.forEach(s => { saveMap[s.slot] = s; });

      container.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const info = saveMap[i] || null;
        const div = document.createElement('div');
        div.className = 'save-slot';
        const metaText = info ? (info.meta.playerName || '?') + ' · 第' + (info.meta.chapter || '?') + '章第' + (info.meta.scene || '?') + '节 · ' + (info.time || '') : '空';
        div.innerHTML = '<div><div style="color:var(--text);">存档槽 ' + (i + 1) + '</div><div class="slot-info">' + metaText + '</div></div><div class="slot-actions">' + (info ? '<button class="btn" onclick="SaveManager.load(' + i + ')">读取</button><button class="btn danger" onclick="SaveManager.confirmDelete(' + i + ',\'load\')" style="margin-left:6px;">删除</button>' : '') + '</div>';
        container.appendChild(div);
      }
    } catch (e) {
      container.innerHTML = '<p style="text-align:center;color:var(--danger);">读取存档列表失败</p>';
    }
  },

  /** 关闭读取存档modal — 如果未开始游戏则回到主菜单 */
  closeLoadModal() {
    UIManager.hideModal('load-modal');
    if (!GameEngine.state.gameStarted) {
      MainMenu.show();
    }
  },

  async save(slot) {
    const gs = GameEngine.state;
    gs.autoContinue = false;
    gs.autoContinueCount = 0;
    const meta = {
      playerName: gs.player.name,
      chapter: gs.chapter,
      scene: gs.scene,
    };
    const result = await Storage.save(slot, gs, meta);
    if (result.ok) {
      UIManager.hideModal('save-modal');
      UIManager.toast('已保存到存档槽 ' + (slot + 1), 'success');
    } else {
      UIManager.toast('保存失败：' + (result.error || '未知错误'), 'error');
    }
  },

  async quickSave() {
    const gs = GameEngine.state;
    gs.autoContinue = false;
    gs.autoContinueCount = 0;
    await Storage.save(0, gs, {
      playerName: gs.player.name,
      chapter: gs.chapter,
      scene: gs.scene,
    });
  },

  async load(slot) {
    const result = await Storage.load(slot);
    if (!result || !result.ok) {
      UIManager.toast('存档为空或已损坏', 'error');
      return;
    }
    GameEngine.state = result.data.state;
    GameEngine.state.gameStarted = true;
    GameEngine.state.autoContinue = false;
    GameEngine.state.waitingForChoice = false;
    // v3.5: Ensure characterBios have x/y coords (legacy saves)
    if (GameEngine.state.characterBios) {
      GameEngine.state.characterBios.forEach((c, i) => {
        if (c.x == null || c.y == null) {
          const angle = (i / GameEngine.state.characterBios.length) * Math.PI * 2;
          c.x = Math.cos(angle) * 200;
          c.y = Math.sin(angle) * 200;
        }
      });
    }
    if (!GameEngine.state.characterRelations) GameEngine.state.characterRelations = [];
    if (!GameEngine.state.foreshadows) GameEngine.state.foreshadows = [];
    if (GameEngine.state.styleMemory == null) GameEngine.state.styleMemory = '';
    if (GameEngine.state._foreshadowActive == null) GameEngine.state._foreshadowActive = false;
    if (GameEngine.state._foreshadowArmed == null) GameEngine.state._foreshadowArmed = false;
    if (GameEngine.state._foreshadowResolveArmed == null) GameEngine.state._foreshadowResolveArmed = false;
    if (GameEngine.state._foreshadowResolveId == null) GameEngine.state._foreshadowResolveId = null;
    if (typeof PlotPlanManager !== 'undefined') {
      try { PlotPlanManager.normalize(); PlotPlanManager.syncProgressFromStoryLog({ emitTransition: false }); }
      catch(e) { console.warn('[Load] plot plan sync failed:', e); }
    }
    if (typeof StyleMemory !== 'undefined') {
      try { StyleMemory.init(); } catch(e) { console.warn('[Load] style memory init failed:', e); }
    }
    if (typeof Foreshadowing !== 'undefined') {
      try { Foreshadowing.init(); } catch(e) { console.warn('[Load] foreshadowing init failed:', e); }
    }
    // v4.0: 加载存档后同步 player.relations → 画布节点
    if (typeof CharacterBioManager !== 'undefined' && CharacterBioManager._syncFromPlayerRelations) {
      try { CharacterBioManager._syncFromPlayerRelations(); } catch(e) { console.warn('[Load] sync relations failed:', e); }
    }
    InventorySystem.init(GameEngine.state.player);
    AnnotationEngine.rebuildTerms();
    document.getElementById('setup-overlay').classList.add('hidden');
    document.getElementById('main-menu-overlay').classList.add('hidden');
    document.getElementById('btn-world-builder').style.display = '';
    document.getElementById('choice-bar').style.display = 'none';
    // v4.0.1: 读档后也显示 AI 助手浮动按钮（原仅 startGame 时显示）
    var saFab = document.getElementById('sa-fab');
    if (saFab) saFab.style.display = 'flex';
    document.getElementById('chapter-label').textContent = '第' + result.data.state.chapter + '章';
    document.getElementById('scene-label').textContent = '第' + result.data.state.scene + '节';
    document.getElementById('topbar-subtitle').textContent = '· ' + result.data.state.player.name + '的冒险';

    const storyDiv = document.getElementById('story-content');
    storyDiv.innerHTML = '';
    const buildAnnotatedHTML = (raw) => {
      const annotated = AnnotationEngine.annotate(raw);
      return annotated.split('\n\n').filter(p => p.trim() !== '')
        .map(p => p.replace(/\n/g, '<br>')).join('</p><p>');
    };
    result.data.state.storyLog.forEach(log => {
      const div = document.createElement('div');
      if (log.type === 'narrative') div.innerHTML = '<p>' + buildAnnotatedHTML(log.content) + '</p>';
      else if (log.type === 'ai-content') div.innerHTML = '<p style="color:var(--accent);font-size:12px;">AI剧情 —</p><p>' + buildAnnotatedHTML(log.content) + '</p>';
      storyDiv.appendChild(div);
    });

    UIManager.updateAllStatus();
    UIManager.hideModal('load-modal');
    UIManager.toast('存档读取成功', 'success');
    PlotPlanManager._updateButtonBadge();

    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'fade-in';
      div.innerHTML = '<hr class="separator"><p class="system">📖 存档已读取 — 继续你的冒险</p>';
      storyDiv.appendChild(div);
      const savedChoices = result.data.state.currentChoices;
      const savedPrompt = result.data.state.choicePrompt;
      if (savedChoices && savedChoices.length >= 3) {
        GameEngine._presentChoices(savedPrompt || '继续你的冒险——做出你的选择', savedChoices);
      } else {
        GameEngine._fallbackChoices();
      }
    }, 500);
  },

  async confirmDelete(slot, from) {
    const result = await Storage.load(slot);
    if (!result || !result.ok) { UIManager.toast('存档为空', 'error'); return; }
    const info = result.data;
    const desc = (info.meta.playerName || '?') + ' · 第' + (info.meta.chapter || '?') + '章第' + (info.meta.scene || '?') + '节 · ' + (info.time || '');
    document.getElementById('confirm-delete-text').textContent = '确定删除存档「' + desc + '」吗？';
    document.getElementById('confirm-delete-overlay').classList.remove('hidden');
    document.getElementById('confirm-delete-yes').onclick = () => { this._doDelete(slot, from); };
    document.getElementById('confirm-delete-cancel').onclick = () => {
      document.getElementById('confirm-delete-overlay').classList.add('hidden');
    };
  },

  async _doDelete(slot, from) {
    await Storage.deleteSlot(slot);
    document.getElementById('confirm-delete-overlay').classList.add('hidden');
    if (from === 'save') { this.showSave(); }
    else { this.showLoad(); }
    UIManager.toast('存档已删除', 'warning');
    APIConfig._checkForSaveBanner();
  },

  // ========== 导入存档（支持单文件JSON / ZIP多槽位）==========
  async importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      try {
        if (ext === 'zip') {
          // ZIP文件：逐个导入slot_*.json
          const arrayBuf = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuf);
          let imported = 0;
          const slotFiles = Object.keys(zip.files).filter(n => n.match(/slot_\d+\.json$/));
          for (const fname of slotFiles) {
            const raw = await zip.file(fname).async('string');
            const data = JSON.parse(raw);
            const slotMatch = fname.match(/slot_(\d+)\.json/);
            const slot = slotMatch ? parseInt(slotMatch[1]) : 0;
            // v4.0兼容：补缺失字段
            const state = data.state || data;
            state.worldBuilderData = state.worldBuilderData || null;
            state.characterRelations = state.characterRelations || [];
            state.foreshadows = state.foreshadows || [];
            state.styleMemory = state.styleMemory || '';
            state._foreshadowActive = !!state._foreshadowActive;
            state._foreshadowArmed = !!state._foreshadowArmed;
          state._foreshadowResolveArmed = !!state._foreshadowResolveArmed;
          state._foreshadowResolveId = state._foreshadowResolveId || null;
            state._foreshadowResolveArmed = !!state._foreshadowResolveArmed;
            state._foreshadowResolveId = state._foreshadowResolveId || null;
            state.player.inventory = state.player.inventory || null;
            const meta = data.meta || { playerName: state.player?.name || '?', chapter: state.chapter || 1, scene: state.scene || 1 };
            const result = await Storage.save(slot, state, meta);
            if (result.ok) imported++;
          }
          UIManager.toast(`导入成功：${imported}个存档槽位`, 'success');
          this.showLoad(); // 刷新列表
        } else if (ext === 'json') {
          // 单个JSON文件：自动选择第一个空槽位（或覆盖最旧存档）
          const raw = await file.text();
          const data = JSON.parse(raw);
          const state = data.state || data;
          state.worldBuilderData = state.worldBuilderData || null;
          state.characterRelations = state.characterRelations || [];
          state.foreshadows = state.foreshadows || [];
          state.styleMemory = state.styleMemory || '';
          state._foreshadowActive = !!state._foreshadowActive;
          state._foreshadowArmed = !!state._foreshadowArmed;
          state._foreshadowResolveArmed = !!state._foreshadowResolveArmed;
          state._foreshadowResolveId = state._foreshadowResolveId || null;
          state.player.inventory = state.player.inventory || null;
          const meta = data.meta || { playerName: state.player?.name || '?', chapter: state.chapter || 1, scene: state.scene || 1 };
          // 找空槽位
          const listData = await Storage.list();
          const usedSlots = listData.ok ? listData.saves.map(s => s.slot) : [];
          let slot = -1;
          for (let i = 0; i < 5; i++) { if (!usedSlots.includes(i)) { slot = i; break; } }
          if (slot === -1) slot = 0; // 全满则覆盖槽位0
          const result = await Storage.save(slot, state, meta);
          if (result.ok) {
            UIManager.toast(`导入成功：存档槽 ${slot + 1}`, 'success');
            this.showLoad();
          } else {
            UIManager.toast('导入失败：' + (result.error || '未知错误'), 'error');
          }
        } else {
          UIManager.toast('仅支持 .json 或 .zip 文件', 'warning');
        }
      } catch(e) {
        UIManager.toast('导入失败：' + e.message, 'error');
      }
    };
    input.click();
  },
};
// ── 确保 SaveManager 在 onclick 中可访问（const 不挂 window）──
window.SaveManager = SaveManager;

