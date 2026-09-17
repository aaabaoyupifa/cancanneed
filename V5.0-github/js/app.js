// ============================
// EVENT HANDLERS (EXE版 — 自动读取 config.json)
// ============================
// 启动配置结果（HelloScreen 退出后根据此值决定显示哪个界面）
window.__bootConfig = null;  // null=还没加载, {ok:true}=有效配置, {ok:false}=无配置

document.addEventListener('DOMContentLoaded', () => {
  // 启动时所有 overlay 都隐藏（HelloScreen z-index 9999 覆盖一切）
  document.getElementById('api-config-overlay').classList.add('hidden');
  document.getElementById('main-menu-overlay').classList.add('hidden');
  document.getElementById('setup-overlay').classList.add('hidden');

  // 读取 config.json — 只存结果，不切换界面（HelloScreen 退出时处理）
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/config', true);
  xhr.timeout = 5000;
  xhr.onload = function() {
    try {
      const cfg = JSON.parse(xhr.responseText);
      if (cfg.ok && cfg.api_key) {
        AIBridge.setConfig(cfg.api_key, cfg.api_url, cfg.api_model);
        console.log('[Config] 自动加载:', cfg.api_model);
        window.__bootConfig = { ok: true };
      } else {
        console.log('[Config] 无有效配置');
        window.__bootConfig = { ok: false };
      }
    } catch(e) {
      console.error('[Config] 解析失败:', e.message);
      window.__bootConfig = { ok: false };
    }
  };
  xhr.onerror = () => { console.log('[Config] 无法读取配置'); window.__bootConfig = { ok: false }; };
  xhr.ontimeout = () => { console.log('[Config] 读取超时'); window.__bootConfig = { ok: false }; };
  xhr.send();

  // server-status element removed in v3.5, skip
  const se = document.getElementById('server-status');
  if (se) { se.className = 'server-on'; se.textContent = 'APK版 · 直连AI'; }

  APIConfig.init();
  ThemeManager.init();
  StyleMemory.init();
  PlotPlanManager._updateButtonBadge();
  JourneyDiary.init();
  StoryAssistant.init();
  Foreshadowing.init();

  const savedFont = localStorage.getItem('if-font-size');
  if (savedFont) document.getElementById('story-content').style.fontSize = savedFont + 'px';

  document.querySelectorAll('.genre-btn').forEach(btn => {
    btn.addEventListener('click', () => SetupWizard.selectGenre(btn.dataset.genre));
  });
  document.getElementById('w-genre-custom').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') SetupWizard.applyCustomGenre();
  });

  document.getElementById('custom-input').addEventListener('keydown',(e)=>{ if(e.key==='Enter') GameEngine.handleCustomChoice(); });

  UIManager.initInventoryActions();
  document.addEventListener('keydown',(e)=>{
    const menuHidden = document.getElementById('main-menu-overlay').classList.contains('hidden');
    const apiHidden = document.getElementById('api-config-overlay').classList.contains('hidden');
    if (!menuHidden && apiHidden) {
      if (e.key === '1') { MainMenu.startNewWorld(); e.preventDefault(); }
      else if (e.key === '2') { MainMenu.continueAdventure(); e.preventDefault(); }
      else if (e.key === '3') { MainMenu.openSettings(); e.preventDefault(); }
      else if (e.key === '4') { MainMenu.exitApp(); e.preventDefault(); }
    }
    if(e.key==='Escape') {
      if (!document.getElementById('main-menu-overlay').classList.contains('hidden')) return;
      document.querySelectorAll('.modal-overlay:not(.hidden), .ai-overlay:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    }
    const anyModalOpen = document.querySelector('.modal-overlay:not(.hidden), .ai-overlay:not(.hidden), #setup-overlay:not(.hidden), #main-menu-overlay:not(.hidden), #api-config-overlay:not(.hidden)');
    const targetIsInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable;
    if(GameEngine.state.waitingForChoice && e.key>='1' && e.key<='9' && !anyModalOpen && !targetIsInput){
      const idx=parseInt(e.key)-1;
      if(idx < GameEngine.state.currentChoices.length) GameEngine._handleChoice(idx);
    }
  });
});
