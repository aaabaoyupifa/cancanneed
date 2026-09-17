// ============================
// API CONFIGURATION (APK版 — 直连AI)
// ============================
var APIConfig = {
  _preset: 'deepseek',
  init() {
    const saved = localStorage.getItem('if-api-config');
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        document.getElementById('api-url').value = cfg.api_url || 'https://api.deepseek.com/v1/chat/completions';
        document.getElementById('api-key').value = cfg.api_key || '';
        document.getElementById('api-model').value = cfg.api_model || 'deepseek-chat';
        this._preset = cfg.preset || 'deepseek';
      } catch(e) {}
    }

    document.querySelectorAll('#api-preset-grid .genre-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#api-preset-grid .genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._preset = btn.dataset.preset;
        if (this._preset === 'deepseek') {
          document.getElementById('api-url').value = 'https://api.deepseek.com/v1/chat/completions';
          document.getElementById('api-model').value = 'deepseek-chat';
        } else if (this._preset === 'openai') {
          document.getElementById('api-url').value = 'https://api.openai.com/v1/chat/completions';
          document.getElementById('api-model').value = 'gpt-4o';
        } else {
          document.getElementById('api-url').value = '';
          document.getElementById('api-model').value = '';
        }
      });
      if (btn.dataset.preset === this._preset) btn.classList.add('active');
    });

    this._checkForSaveBanner();
  },

  async _checkForSaveBanner() {
    try {
      const data = await Storage.list();
      document.getElementById('continue-banner').style.display = (data.ok && data.saves && data.saves.length > 0) ? '' : 'none';
    } catch (e) {
      document.getElementById('continue-banner').style.display = 'none';
    }
  },

  findLatestSave() {
    return { data: null, slot: -1 };
  },

  async continueAdventure() {
    try {
      const data = await Storage.list();
      if (!data.ok || !data.saves || data.saves.length === 0) {
        UIManager.toast('没有找到存档', 'error');
        return;
      }
      let latestSlot = data.saves[0].slot;
      let latestTime = data.saves[0].time || '';
      for (const s of data.saves) {
        if ((s.time || '') > latestTime) { latestSlot = s.slot; latestTime = s.time || ''; }
      }
      document.getElementById('main-menu-overlay').classList.add('hidden');
      SaveManager.load(latestSlot);
    } catch (e) {
      UIManager.toast('无法读取存档', 'error');
    }
  },

  _toggleKey() {
    const el = document.getElementById('api-key');
    el.type = el.type === 'password' ? 'text' : 'password';
  },

  async save() {
    const apiKey = document.getElementById('api-key').value.trim();
    const apiUrl = document.getElementById('api-url').value.trim();
    const apiModel = document.getElementById('api-model').value.trim();
    const errDiv = document.getElementById('api-config-error');
    const saveBtn = document.querySelector('#api-config-card .btn.primary');

    if (!apiKey) {
      errDiv.textContent = '请输入 API Key'; errDiv.style.display = ''; errDiv.style.color = 'var(--danger)'; return;
    }
    if (!apiUrl) {
      errDiv.textContent = '请输入 API 地址'; errDiv.style.display = ''; errDiv.style.color = 'var(--danger)'; return;
    }

    errDiv.style.display = 'none';
    document.getElementById('api-key').disabled = true;
    saveBtn.disabled = true;
    errDiv.style.color = 'var(--ai-color)';
    errDiv.textContent = '正在验证 API 连接...';
    errDiv.style.display = '';

    // 调用 Flask 代理验证（最多等 25 秒）
    let result = { ok: false, error: '验证超时' };
    try {
      if (typeof AIBridge === 'undefined') {
        result = { ok: false, error: 'AIBridge 未加载，请刷新页面' };
      } else {
        result = await Promise.race([
          AIBridge.testConfig(apiKey, apiUrl, apiModel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('前端超时')), 25000))
        ]);
      }
    } catch(e) {
      result = { ok: false, error: '验证失败：' + (e.message || '未知错误') };
    }
    document.getElementById('api-key').disabled = false;
    saveBtn.disabled = false;

    if (result.ok) {
      AIBridge.setConfig(apiKey, apiUrl, apiModel);
      localStorage.setItem('if-api-config', JSON.stringify({
        api_key: apiKey, api_url: apiUrl, api_model: apiModel, preset: this._preset
      }));
      errDiv.style.color = 'var(--success)';
      errDiv.textContent = '验证通过！';
      setTimeout(() => {
        document.getElementById('api-config-overlay').classList.add('hidden');
        MainMenu.show();
      }, 600);
    } else {
      errDiv.style.color = 'var(--danger)';
      errDiv.textContent = result.error || 'API 验证失败';
      errDiv.style.display = '';
    }
  },

  skip() {
    const apiKey = document.getElementById('api-key').value.trim();
    const apiUrl = document.getElementById('api-url').value.trim();
    const apiModel = document.getElementById('api-model').value.trim();
    if (apiKey && apiUrl && apiModel) {
      AIBridge.setConfig(apiKey, apiUrl, apiModel);
      localStorage.setItem('if-api-config', JSON.stringify({
        api_key: apiKey, api_url: apiUrl, api_model: apiModel, preset: this._preset
      }));
    }
    document.getElementById('api-config-overlay').classList.add('hidden');
    MainMenu.show();
  },

  showConfig() {
    document.getElementById('setup-overlay').classList.add('hidden');
    document.getElementById('api-config-overlay').classList.remove('hidden');
  }
};
// ── 确保 APIConfig 在 onclick 中可访问（const 不挂 window）──
window.APIConfig = APIConfig;
