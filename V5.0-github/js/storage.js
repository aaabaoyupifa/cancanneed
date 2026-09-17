// ============================
// STORAGE — 纯服务端存档（通过 Flask API）
// ============================
var Storage = {

  /** 存档前修剪膨胀字段——永远执行，不限门槛。
   *  storyLog 是主膨胀源：每段 AI 叙事 2000-5000 字，
   *  150 条就可能突破 10MB（即使"不超过150"）。
   *  因此不分阈值，永远裁到安全水位。 */
  _pruneForSave(gameState) {
    var s = Object.assign({}, gameState);

    // --- storyLog：上限 80 条，最近 30 条完整，其余截断到 100 字 ---
    if (Array.isArray(s.storyLog)) {
      var MAX_LOG = 80;
      var FULL_LOG = 30;
      if (s.storyLog.length > MAX_LOG) {
        s.storyLog = s.storyLog.slice(-MAX_LOG);
      }
      // 重新计算数组长度（可能已被 slice）
      var len = s.storyLog.length;
      if (len > FULL_LOG) {
        s.storyLog = s.storyLog.map(function(entry, i) {
          var isRecent = i >= len - FULL_LOG;
          if (isRecent) return entry;
          var content = entry.content || '';
          if (content.length <= 100) return entry;
          return Object.assign({}, entry, {
            content: content.slice(0, 100) + '...[截断]'
          });
        });
      }
    }

    // --- player.history：上限 300 条 ---
    if (s.player) {
      s.player = Object.assign({}, s.player);
      if (Array.isArray(s.player.history) && s.player.history.length > 300) {
        s.player.history = s.player.history.slice(-300);
      }
    }

    return s;
  },

  async save(slot, gameState, meta) {
    // 先修剪再序列化，节省内存且避免请求体过大
    var pruned = this._pruneForSave(gameState);
    var data = {
      state: pruned,
      meta: meta || { playerName: gameState.player.name || '?', chapter: gameState.chapter || 1, scene: gameState.scene || 1 },
      time: new Date().toLocaleString('zh-CN'),
    };
    try {
      var body = JSON.stringify({ slot: slot, data: data });
      var r = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      return await r.json();
    } catch(e) {
      console.error('[Storage] save failed:', e);
      return { ok: false, error: '保存失败：' + e.message };
    }
  },

  async load(slot) {
    try {
      const r = await fetch('/api/save?slot=' + slot);
      if (r.status === 404) return null;
      const result = await r.json();
      return result.ok ? { ok: true, data: result.data } : null;
    } catch(e) {
      console.error('[Storage] load failed:', e);
      return null;
    }
  },

  async list() {
    try {
      const r = await fetch('/api/saves');
      const result = await r.json();
      return { ok: true, saves: result.saves || [] };
    } catch(e) {
      console.error('[Storage] list failed:', e);
      return { ok: true, saves: [] };
    }
  },

  async deleteSlot(slot) {
    try {
      const r = await fetch('/api/save?slot=' + slot, { method: 'DELETE' });
      return await r.json();
    } catch(e) {
      console.error('[Storage] delete failed:', e);
      return { ok: false, error: '删除失败：' + e.message };
    }
  },
};
window.Storage = Storage;
