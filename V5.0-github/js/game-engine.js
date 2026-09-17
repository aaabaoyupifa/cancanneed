// ============================
// GAME ENGINE
// ============================
var GameEngine;
try {
GameEngine = {
  state: {
    genre: '',
    worldName: '', world: '', era: '', locations: '', factions: '', powerSystem: '',
    player: {
      name: '', background: '',
      age: 20, sex: '男', personality: '', oneLine: '', appearance: '', ability: '', goal: '',
      health: '健康', mood: '平淡',
      stats: {},          // Dynamic stats from AI layout (eg. 灵力, 异能等级, etc.)
      statsLayout: null,   // AI-generated layout for status panel
      level: 1,            // 当前等级（由能力体系驱动）
      rank: '',            // 当前品阶/段位名称（如：筑基、F级）
      exp: 0,              // 当前经验值
      expToNext: 100,      // 升级所需经验
      skills: [], items: [], relations: {}, quests: [],
      history: []
    },
    chapter: 1, scene: 1, storyLog: [],
    currentChoices: [], choiceCount: 0,
    gameStarted: false, waitingForChoice: false,
    lastSnapshot: null, lastStoryHTML: '', lastSceneNum: 1,
    lastUndoneChoice: null,
    autoContinue: false,   // 自动续写模式
    autoContinueMax: 5,
    autoContinueCount: 0,
    lastAutoSave: 0,
    lorebook: [],          // 世界观书：[{keyword, content, priority}]
    authorsNote: '',       // 作者注：固定在prompt中的指令
    styleMemory: '',       // 文风记忆：进入存档与生成链路
    foreshadows: [],       // 伏笔列表：[{id, desc, chapter, scene, status...}]
    _foreshadowActive: false, // 伏笔按钮已就绪，等待下一次手动抉择
    _foreshadowArmed: false,  // 伏笔已随本次抉择发射，等待 AI 返回后落库
    _foreshadowResolveArmed: false, // 用户指定下一段回收伏笔
    _foreshadowResolveId: null,
    worldBuilderData: null, // 世界构建器数据：{characters, abilities, locations, _nextId}
    characterBios: [],     // 人物小传 [{id,name,role,appearance,personality,bg,ability,goal,notes}]
    plotPlan: {            // 剧情规划
      enabled: false,
      totalWords: 30000,
      phases: [
        { id: 'beginning', name: '开端', desc: '引入主角、展示世界观、建立核心冲突', wordPct: 20, wordBudget: 6000, wordsWritten: 0 },
        { id: 'development', name: '发展', desc: '深化冲突、展开支线、角色成长', wordPct: 35, wordBudget: 10500, wordsWritten: 0 },
        { id: 'climax', name: '高潮', desc: '矛盾集中爆发、各方势力交锋、核心冲突到达顶点', wordPct: 30, wordBudget: 9000, wordsWritten: 0 },
        { id: 'ending', name: '结局', desc: '收束伏线、解决冲突、留下余韵', wordPct: 15, wordBudget: 4500, wordsWritten: 0 },
      ],
      currentPhaseIdx: 0,
      totalWordsWritten: 0,
    },

    // === v2.2 游戏化系统 ===
    days: 1,                      // 游戏内天数
    pendingConsequences: [],      // 延迟后果 [{text, triggerScene, applied}]
    milestones: {                 // 里程碑统计
      totalWords: 0, choicesMade: 0, chaptersCompleted: 0,
      npcsMet: 0, daysSurvived: 1, timesNearDeath: 0,
    },
    chapterTriggered: false,      // 是否已触发过本章的章节小结
    randomEventCounter: 0,       // 意外事件计数器
  },

  // ========== 意外事件池 ==========
  FATE_EVENTS: [
    '一阵狂风毫无征兆地刮来。等风停时，地上多了一枚不属于任何人的金币。',
    '你在路边发现一封被雨水浸透的信。大部分字迹模糊了，只有署名还能看清——是你的名字。',
    '一个乞丐拦住了你。"我见过你，"他说，"在梦里。你走错路了。"然后他转身消失在人群里。',
    '天边有什么东西在坠落。很远，但你能看到那道火光。镇上的人开始骚动。',
    '有人从你身边跑过，撞了你的肩膀。等你回过神来，口袋里多了一样东西——你不知道是谁放的，也不知道是什么。',
    '天突然下起雨。不对——这不是雨。滴在皮肤上的是温热的，带着铁锈味。',
    '一只猫跟着你走了三条街。它不靠近，不叫唤，只是跟着。你觉得它在等什么。',
    '你听到有人叫你——用的是你已经很久没用的那个名字。但回头看时，街上没有人。',
    '路边摊的算命先生拉住你的手。"今天别走水路，"他低声说，"也别信戴红围巾的人。"他收了一枚铜板，闭上了眼睛。',
    '你踩到了一样东西。低头看时，是一个碎了的小木盒。盒子里什么都没有，但盒盖内侧刻着一个日期——明天的日期。',
    '远处传来钟声。但镇上没有钟楼。',
    '一个孩子递给你一朵花。你接过来，花在你手里碎了。孩子没有消失——他笑了，然后跑开了。',
    '你发现自己的影子比常人慢了半拍。你抬手，影子等了一下才抬手。你假装没看到。',
    '客栈的店小二给你倒了茶。茶是甜的。他说今天没放糖。',
    '外面传来一阵歌声——不是你熟悉的调子，但你觉得很熟悉。像是有人在你记忆里挖走了一段，现在又还了回来。',
    '你看见一个人站在巷子里，穿着你昨天的衣服。你走过去，巷子是空的。',
    '一本书从书架上层掉下来，正好翻开在你脚边。你没有碰它。但你在余光里看到那页纸上有一个你认识的名字。',
    '有人在墙上画了一扇门。用粉笔。画得歪歪扭扭，但很认真。你注意到门下有湿湿的脚印——从门外走进来。',
    '一条狗叼着你的手套跑了。你追了三条街。手套它不要了，但它回头看了你一眼。那眼神不像狗。',
    '夜里你被冻醒。不是因为冷。是因为你发现有人在哭——声音很近，好像就在你枕头旁边。但你是一个人睡的。',
  ],

  // ========== 风险标记映射 ==========
  RISK_EMOJI: {
    combat_win: '⚔', combat_loss: '💀', combat_risk: '⚔',
    exploration: '🔍', exploration_risk: '⚠', exploration_loot: '💎',
    social_success: '💬', social_fail: '😶', social_negotiate: '🤝',
    rest: '🛌', train: '📖',
    quest_progress: '🎯', mystery: '❓', danger: '⚡', escape: '🏃',
    neutral: '→',
  },

  startGame() {
    try {
    const s = SetupWizard._collectAllSettings();
    // 必填校验
    const missing = [];
    if (!s.worldName) missing.push('世界观 → 世界名称');
    if (s.genre === '未知' || !s.genre) missing.push('世界观 → 题材/类型');
    if (!s.world) missing.push('世界观 → 世界观概述');
    if (!s.name) missing.push('主角设定 → 主角姓名');
    if (missing.length > 0) {
      const hint = '以下内容未填写，无法开启命运：\n• ' + missing.join('\n• ');
      UIManager.toast(hint, 'warning', 5000);
      // 跳转到第一个缺失的标签页
      if (missing[0].includes('世界观')) SetupWizard.switchTab(0);
      else if (missing[0].includes('主角')) SetupWizard.switchTab(1);
      return;
    }

    const gs = this.state;
    gs.genre = s.genre; gs.worldName = s.worldName; gs.world = s.world; gs.era = s.era;
    gs.locations = s.locations; gs.factions = s.factions; gs.powerSystem = s.powerSystem;

    const p = gs.player;
    p.name = s.name; p.age = s.age; p.sex = s.sex;
    p.personality = s.personality; p.oneLine = s.oneLine;
    p.appearance = s.appearance; p.background = s.background;
    p.ability = s.ability; p.goal = s.goal;
    p.health = '健康'; p.mood = '平淡';
    p.stats = {}; p.statsLayout = null;
    p.level = 1; p.rank = ''; p.exp = 0; p.expToNext = 100;
    p.skills = [];
    p.items = [{ name: '初始装备', qty: 1, desc: '冒险开始时的随身物品' }];
    p.relations = {};
    p.quests = [{ title: '命运的起点', desc: '冒险刚刚开始', status: 'active' }];
    p.history = [];
    // v3.1-hotfix3: 清空 inventory 后重新初始化，避免跨小说道具残留
    p.inventory = null;
    // v3.0: 初始化物品道具系统（自动迁移 old p.items → inventory）
    try { InventorySystem.init(p); } catch(e) { console.warn('InventorySystem.init failed:', e); }
    gs.chapter = 1; gs.scene = 1; gs.storyLog = []; gs.choiceCount = 0;
    gs.gameStarted = true; gs.waitingForChoice = false;
    gs.autoContinue = false; gs.autoContinueCount = 0;
    gs.lastAutoSave = Date.now();
    // v2.2 游戏化系统初始化
    gs.days = 1;
    gs.pendingConsequences = [];
    gs.milestones = { totalWords: 0, choicesMade: 0, chaptersCompleted: 0, npcsMet: 0, daysSurvived: 1, timesNearDeath: 0 };
    gs.chapterTriggered = false;
    gs.randomEventCounter = 0;
    // 新世界：清空旧世界人物库，再由设置向导传入
    gs.characterBios = s.characterBios || [];

    document.getElementById('setup-overlay').classList.add('hidden');
    document.getElementById('story-content').innerHTML = '';
    document.getElementById('choice-bar').style.display = 'none';
    document.getElementById('topbar-subtitle').textContent = `· ${p.name}的冒险`;
    // v3.5: 显示 AI 助手浮动按钮
    const saFab = document.getElementById('sa-fab');
    if (saFab) saFab.style.display = 'flex';
    document.getElementById('btn-world-builder').style.display = '';
    UIManager.updateAllStatus();
    UIManager.toast('命运之轮开始转动…', 'success');

    // Start periodic auto-save (every 120s)
    this._stopAutoSave();
    this._autoSaveTimer = setInterval(() => {
      if (this.state.gameStarted && Date.now() - this.state.lastAutoSave > 100000) {
        this.state.lastAutoSave = Date.now();
        SaveManager.quickSave();
        UIManager.toast('💾 自动保存', 'success');
      }
    }, 120000);
    try { AnnotationEngine.rebuildTerms(); } catch(e) { console.warn('AnnotationEngine.rebuildTerms failed:', e); }
    this._fetchPlayerLayout();
    this._generateOpeningScene();
    } catch(e) {
      console.error('startGame failed:', e);
      UIManager.toast('启动游戏失败：' + e.message, 'error');
      document.getElementById('setup-overlay').classList.add('hidden');
    }
  },

  async _fetchPlayerLayout() {
    const gs = this.state; const p = gs.player;
    try {
      const data = await AIBridge.generatePlayerLayout({
        genre: gs.genre, power_system: gs.powerSystem, ability: p.ability,
        player_name: p.name, personality: p.personality,
      });
      if (data && data.stats) {
        const layout = { stats: data.stats, layout: data.layout || 'horizontal', initialRank: data.initialRank };
        p.statsLayout = layout;
        if (layout.stats) {
          layout.stats.forEach(s => { p.stats[s.id] = s.value; });
        }
        if (layout.initialRank) {
          p.rank = layout.initialRank;
        }
        UIManager.updateAllStatus();
      }
    } catch(e) { console.warn('Layout fetch failed:', e.message); }
  },

  _saveSnapshot() {
    const gs = this.state;
    gs.lastSnapshot = JSON.parse(JSON.stringify(gs.player));
    gs.lastStoryHTML = document.getElementById('story-content').innerHTML;
    gs.lastSceneNum = gs.scene;
    document.getElementById('undo-btn').style.display = 'none';
  },

  undo() {
    const gs = this.state;
    if (!gs.lastSnapshot) { UIManager.toast('没有可反悔的操作', 'warning'); return; }

    // Restore player state
    const snap = gs.lastSnapshot;
    Object.assign(gs.player, snap);

    // Restore scene number (don't increment)
    gs.scene = gs.lastSceneNum;

    // Restore story DOM
    document.getElementById('story-content').innerHTML = gs.lastStoryHTML;

    // Capture the undone choice for retry context
    if (gs.player.history.length > 0) {
      gs.lastUndoneChoice = gs.player.history[gs.player.history.length - 1].choice;
      gs.player.history.pop();
    }

    // Roll back story log to before the AI content was added
    // The last entry in storyLog is the AI-generated content
    if (gs.storyLog.length > 0) {
      gs.storyLog.pop();
    }
    if (typeof PlotPlanManager !== 'undefined') {
      try { PlotPlanManager.syncProgressFromStoryLog({ emitTransition: false }); }
      catch(e) { console.warn('[Undo] plot plan sync failed:', e); }
    }

    // Clear snapshot (can't undo twice)
    gs.lastSnapshot = null;
    gs.lastStoryHTML = '';

    // Hide undo button
    document.getElementById('undo-btn').style.display = 'none';

    // Update UI labels (rolled-back chapter/scene)
    document.getElementById('chapter-label').textContent = `第${gs.chapter}章`;
    document.getElementById('scene-label').textContent = `第${gs.scene}节`;
    UIManager.updateAllStatus();

    // Trigger re-branch: let AI regenerate new direction + choices, not old ones
    this._reBranch();
  },

  /** After undo, call AI to regenerate story direction and fresh choices at this branch point */
  _reBranch() {
    const gs = this.state;
    gs.waitingForChoice = false;
    document.getElementById('choice-bar').style.display = 'none';

    // Add visual branch-point marker
    const storyDiv = document.getElementById('story-content');
    const marker = document.createElement('div');
    marker.innerHTML = '<hr class="separator" style="border-color:var(--accent);opacity:0.5;"><p style="color:var(--accent);font-size:12px;text-align:center;">⏪ 命运分支 — 正在编织新的可能性…</p>';
    storyDiv.appendChild(marker);
    storyDiv.scrollTop = storyDiv.scrollHeight;

    // Save snapshot so user can undo this re-branch too
    this._saveSnapshot();

    // Fetch: AI gets retry_context + special __REBRANCH__ prompt
    this._fetchStory('__REBRANCH__', false);
  },

  resetGame() {
    if (this.state.gameStarted && !confirm('确定要开始新游戏吗？当前进度将丢失。')) return;
    this._stopAutoSave();
    this._fetching = false;
    this.state.gameStarted = false; this.state.waitingForChoice = false;
    this.state.characterBios = []; // 新世界清空人物库
    this.state.worldBuilderData = null; // 新世界清空世界构建器数据
    document.getElementById('btn-world-builder').style.display = 'none';
    document.getElementById('setup-overlay').classList.remove('hidden');
    APIConfig._checkForSaveBanner();
    document.getElementById('story-content').innerHTML = '';
    document.getElementById('choice-bar').style.display = 'none';
    document.getElementById('topbar-subtitle').textContent = '· 准备启程';
    SetupWizard.switchTab(0);
  },

  _generateOpeningScene() {
    document.getElementById('chapter-label').textContent = '序章';
    document.getElementById('scene-label').textContent = '命运的起点';
    const hook = WritingRules.getOpeningHook(this.state.genre);
    this._fetchStory(hook, true);
  },

  _generateChoicesForOpening() {
    this._fetchStory('', true);
  },

  _stopAutoSave() {
    if (this._autoSaveTimer) { clearInterval(this._autoSaveTimer); this._autoSaveTimer = null; }
  },

  _handleChoice(index, isAuto = false) {
    if (!this.state.waitingForChoice) return;

    // v3.5 伏笔系统：仅在手动抉择时触发，自动续写不触发
    if (!isAuto && typeof Foreshadowing !== 'undefined' && Foreshadowing.isPending()) {
      this.state._foreshadowArmed = true;
      Foreshadowing.markRequested();
    }

    // Save snapshot for undo
    this._saveSnapshot();

    // Auto-save at slot 0 on every choice
    this.state.lastAutoSave = Date.now();
    SaveManager.quickSave();

    this.state.waitingForChoice = false;
    document.getElementById('choice-bar').style.display = 'none';
    const choice = this.state.currentChoices[index];
    const p = this.state.player;
    const gs = this.state;
    p.history.push({ chapter:gs.chapter, scene:gs.scene, choice:choice.text,
      timestamp:new Date().toISOString(),
      playerState:{ health:p.health, mood:p.mood, days:gs.days, choicesMade:gs.milestones.choicesMade }
    });

    // Use EffectsEngine for local stat processing
    const ev = EffectsEngine.evaluate(p, choice.type || 'neutral');
    // v3.1-hotfix: 合并 EffectsEngine 本地效果 + AI 选项效果（道具/技能/关系），不再覆盖
    const mergedEffects = { ...(choice.effects || {}), ...ev.effects };
    choice.effects = mergedEffects;
    this._applyEffects(mergedEffects);
    if (ev.health) { p.health = ev.health; }
    if (ev.mood) { p.mood = ev.mood; }

    // === v2.2 游戏化系统 ===
    // 天数推进（探索/战斗类+1天，休息+0.5天）
    const timeTypes = ['combat_win','combat_loss','combat_risk','exploration','exploration_risk','exploration_loot',
      'social_success','social_fail','social_negotiate','quest_progress','mystery','danger','escape'];
    if (timeTypes.includes(choice.type)) gs.days++;
    else if (choice.type === 'rest') gs.days += 0.5;
    gs.milestones.daysSurvived = Math.floor(gs.days);
    gs.milestones.choicesMade++;
    // 延迟后果：部分类型的选择（战斗、探索风险）3轮后触发
    if (['combat_risk','exploration_risk','danger'].includes(choice.type)) {
      gs.pendingConsequences.push({ text: choice.text, triggerScene: gs.scene + 3, applied: false });
    }
    // 软失败：健康归零 → 昏迷
    if (p.health === '濒危' || p.health === '濒死') {
      gs.days += 2; // 昏迷两天
      gs.milestones.timesNearDeath++;
      p.health = '重伤';
      p.mood = '恐惧';
    }
    // 章节感：每5个场景触发章节小结标记
    if (gs.scene % 5 === 0 && !gs.chapterTriggered) {
      gs.chapterTriggered = true;
    }
    const storyDiv = document.getElementById('story-content');
    const resultDiv = document.createElement('div');
    const riskIcon = this.RISK_EMOJI[choice.type] || '';
    resultDiv.innerHTML = `<p class="action fade-in">${riskIcon} ▸ ${choice.text}</p>`;
    storyDiv.appendChild(resultDiv);
    this._fetchStory(choice.text, false, choice);
  },

  handleCustomChoice() {
    const input = document.getElementById('custom-input').value.trim();
    if (!input) { UIManager.toast('请输入你的选择', 'warning'); return; }
    if (!this.state.waitingForChoice) return;

    // Save snapshot for undo
    this._saveSnapshot();

    const gs = this.state;
    const p = gs.player;

    // Evaluate impact before executing
    this._evaluateAndExecute(input);
  },

  async _evaluateAndExecute(input) {
    const gs = this.state; const p = gs.player;
    const storyLast = gs.storyLog.map(l=>l.content||'').join('\n').slice(-800);

    // Evaluate the impact of this custom choice
    let impact = 'moderate'; let reason = '';
    try {
      const data = await AIBridge.evaluateChoice({
        choice: input, genre: gs.genre, world_desc: gs.world,
        player_name: p.name, player_ability: p.ability,
        player_health: p.health, player_mood: p.mood,
      });
      impact = data.impact || 'moderate';
      reason = data.reason || '';
    } catch(e) {
      // If evaluation fails, default to moderate
      impact = 'moderate';
    }

    if (impact === 'major' || impact === 'moderate') {
      // Show confirmation dialog for both major and moderate impact
      const reasonText = reason || (impact === 'major' ? '此选择将重大影响剧情走向，建议先存档。' : '此选择可能影响剧情走向。');
      const warningText = impact === 'major' ? '⚠ 重大抉择' : '⚡ 请注意';
      const confirmLabel = impact === 'major' ? '确认执行并自动存档' : '确认并自动存档';
      document.getElementById('confirm-impact-reason').textContent = reasonText;
      document.getElementById('confirm-impact-title').textContent = warningText;
      document.getElementById('confirm-impact-text').textContent = `「${input}」`;
      document.getElementById('confirm-impact-yes').textContent = confirmLabel;
      document.getElementById('confirm-impact-overlay').classList.remove('hidden');

      const confirmed = await new Promise(resolve => {
        document.getElementById('confirm-impact-yes').onclick = () => { resolve(true); };
        document.getElementById('confirm-impact-cancel').onclick = () => { resolve(false); };
      });
      document.getElementById('confirm-impact-overlay').classList.add('hidden');
      if (!confirmed) {
        // User cancelled — restore state
        this.state.waitingForChoice = true;
        document.getElementById('choice-bar').style.display = '';
        return;
      }
      // Auto-save to slot 0 before proceeding
      SaveManager.quickSave();
    }

    // Proceed with custom choice
    this.state.waitingForChoice = false;
    document.getElementById('choice-bar').style.display = 'none';
    p.history.push({ chapter:gs.chapter, scene:gs.scene, choice:`[自定义] ${input}`, timestamp:new Date().toISOString(),
      playerState:{ health:p.health, mood:p.mood, days:gs.days, choicesMade:gs.milestones.choicesMade }
    });
    UIManager.updateAllStatus();
    // v3.5 伏笔系统：自定义抉择也触发伏笔
    if (typeof Foreshadowing !== 'undefined' && Foreshadowing.isPending()) {
      gs._foreshadowArmed = true;
      Foreshadowing.markRequested();
    }
    this._fetchStory(input, false, { text: input, type: (typeof AIBridge !== 'undefined' && AIBridge._inferChoiceType ? AIBridge._inferChoiceType(input) : 'neutral'), tag: 'custom' });
  },

  /** 根据剧情规划动态生成开场提示词 */
  _getOpeningPrompt() {
    const pp = this.state.plotPlan;
    let wordHint = '500-1500字';
    let phaseHint = '';
    if (pp && pp.enabled) {
      const phase = pp.phases[pp.currentPhaseIdx || 0];
      if (phase) {
        // 开端阶段字数偏向预算的 5-10%
        const chunk = Math.round(phase.wordBudget * 0.08);
        wordHint = `${Math.max(500, chunk - 300)}-${Math.max(800, chunk + 300)}字`;
        phaseHint = `\n当前处于「${phase.name}」阶段（${phase.desc}），请按照该阶段的节奏要求来创作开场。`;
      }
    }
    return `这是故事的开端。请根据世界观和角色设定，写一个精彩的开场（${wordHint}），引入主角、展示世界、埋下伏笔，随后给出第一次抉择。不要使用固定的"玉佩""传承""残魂"等元素，要根据实际的冒险类型和世界观来创作独特的开场。${phaseHint}`;
  },

  async _fetchStory(choiceText, isOpening = false, choiceMeta = null) {
    // Prevent concurrent fetch — if already generating, ignore
    if (this._fetching) { console.warn('_fetchStory blocked: already generating'); return; }
    this._fetching = true;
    if (!ContentGenerator.serverReady) {
      this._fallbackStory(choiceText, isOpening);
      this._fetching = false;
      return;
    }
    const gs = this.state; const p = gs.player;
    const storyDiv = document.getElementById('story-content');
    const loadDiv = document.createElement('div');
    loadDiv.id = 'story-loading';
    const msgs = [
      '命运之书正在翻动...',
      '世界线正在编织新的篇章...',
      '命运的丝线正在交错...',
      '故事的河流涌动不息...',
      '星辰在纸页间流转...',
      '时光之沙缓缓坠落...',
      '命运的齿轮悄然转动...',
      '一缕墨香晕开了新的章节...',
      '远方传来了不可知的风...',
      '万物的脉络正在重新排列...',
      '古老的笔尖轻轻划过虚空...',
      '因果之线在你指尖缠绕...',
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    // v3.1: 金色经纬仪加载动画
    const loadId = 'story-earth-' + Date.now();
    loadDiv.innerHTML = `<div style="text-align:center;padding:20px 16px;">
      <svg id="${loadId}-svg" viewBox="0 0 100 100" style="width:80px;height:80px;margin:0 auto 12px;filter:drop-shadow(0 0 20px rgba(201,168,76,.2));">
        <defs>
          <radialGradient id="${loadId}-globe" cx="35%" cy="30%">
            <stop offset="0%" stop-color="#1a1810"/>
            <stop offset="60%" stop-color="#0d0c08"/>
            <stop offset="100%" stop-color="#050504"/>
          </radialGradient>
          <filter id="${loadId}-glow"><feGaussianBlur stdDeviation="1"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="50" cy="50" r="40" fill="url(#${loadId}-globe)" stroke="rgba(201,168,76,.2)" stroke-width=".8"/>
        <g stroke="rgba(201,168,76,.1)" stroke-width=".4" fill="none">
          <ellipse cx="50" cy="50" rx="7" ry="40"/><ellipse cx="50" cy="50" rx="16" ry="40"/>
          <ellipse cx="50" cy="50" rx="25" ry="40"/><ellipse cx="50" cy="50" rx="34" ry="40"/>
          <ellipse cx="50" cy="50" rx="40" ry="7"/><ellipse cx="50" cy="50" rx="40" ry="16"/>
          <ellipse cx="50" cy="50" rx="40" ry="25"/><ellipse cx="50" cy="50" rx="40" ry="34"/>
          <ellipse cx="50" cy="50" rx="40" ry="1.5" stroke="rgba(201,168,76,.18)" stroke-width=".6"/>
        </g>
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(201,168,76,.06)" stroke-width="1.2"/>
        <path id="${loadId}-fill" d="M50,50 L50,10 A40,40 0 0,1 50,90 Z" fill="rgba(0,0,0,.6)"/>
        <text id="${loadId}-pct" x="50" y="47" text-anchor="middle" fill="#e2c97e" font-size="14" font-weight="700" style="text-shadow:0 0 8px rgba(201,168,76,.4);">0%</text>
        <text x="50" y="60" text-anchor="middle" fill="rgba(201,168,76,.4)" font-size="6" letter-spacing="1">生成中</text>
      </svg>
      <p class="system ai-loading" style="text-align:center;letter-spacing:2px;margin-bottom:2px;color:rgba(226,201,126,.6);">${msg}</p>
      <p class="ai-loading-timer" style="text-align:center;font-size:10px;color:var(--text-dim);"></p>
    </div>`;
    let msgIdx = 1;
    const startTime = Date.now();
    // 启动小经纬仪饼图（正确角度）
    this._startPieSmall(`${loadId}-fill`, `${loadId}-pct`, 40, 50, 50, 60000);
    const msgTimer = setInterval(() => {
      const el = document.getElementById('story-loading');
      if (!el) { clearInterval(msgTimer); return; }
      el.querySelector('p.system').textContent = msgs[msgIdx % msgs.length];
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const timerEl = el.querySelector('.ai-loading-timer');
      if (timerEl && elapsed > 8) timerEl.textContent = `AI正在思考中... (${elapsed}秒)`;
      msgIdx++;
    }, 3000);
    loadDiv._msgTimer = msgTimer;
    storyDiv.appendChild(loadDiv);
    storyDiv.scrollTop = storyDiv.scrollHeight;

    const sceneText = isOpening ? '' : (gs.storyLog.map(l => l.content || '').join('\n').slice(-500000));
    const payload = {
      genre: gs.genre, world_name: gs.worldName, world_desc: gs.world,
      era: gs.era, locations: gs.locations, factions: gs.factions, power_system: gs.powerSystem,
      player: {
        name: p.name, age: p.age, sex: p.sex, personality: p.personality,
        oneLine: p.oneLine, background: p.background, ability: p.ability, goal: p.goal,
        health: p.health, mood: p.mood,
        level: p.level || 1, rank: p.rank || '', exp: p.exp || 0, expToNext: p.expToNext || 100,
        strength: p.stats?.strength||0, agility: p.stats?.agility||0, constitution: p.stats?.constitution||0,
        intelligence: p.stats?.intelligence||0, spirit: p.stats?.spirit||0, perception: p.stats?.perception||0,
        stats: p.stats || {}, statsLayout: p.statsLayout,
        skills: p.skills, items: InventorySystem.getLegacyItems(p), inventory: InventorySystem.getPromptItems(p),
        relations: p.relations,
      },
      choice: isOpening ? this._getOpeningPrompt() : (choiceText === '__REBRANCH__' ? '这是命运的分支点。玩家撤销了之前的选项，请基于当前场景和故事状态，生成一个全新的发展方向（500-1000字）和3-4个不同的选项。不要重复之前撤销分支的叙事内容和选项方向，探索不同的可能性。' : choiceText),
      chapter: gs.chapter, scene: gs.scene,
      history: p.history,
      story_log: sceneText,
      character_bios: gs.characterBios || [],
      plot_plan: PlotPlanManager.getPacingContext(),  // v3.5: 剧情规划阶段数据（含字数统计）
      // v3.5: 实时节拍引擎——综合4系统状态计算的节奏指令
      live_context: LiveContext.generate(),
      retry_context: gs.lastUndoneChoice || null,
      style_memory: (typeof StyleMemory !== 'undefined' ? StyleMemory.getActiveStyle() : ''),
      style_strength: (typeof StyleMemory !== 'undefined' ? StyleMemory.getStrength() : 'strong'),
      writing_rules: WritingRules.getFullRules(),
      // 章节摘要（用于快速上下文回忆，替代全文 story_log）
      chapter_summaries: (gs.chapterSummaries || []).slice(-15).map(s =>
        `第${s.chapter}章第${s.scene}节：${s.summary}`
      ).join('\n'),
      // 世界观书（SillyTavern-style lorebook）：关键词触发上下文注入
      lorebook: gs.lorebook || [],
      // 世界构建器数据（人物/功法/地点设定，作为剧情发展的依据）
      world_builder_context: (typeof WorldBuilder !== 'undefined' ? WorldBuilder.getPromptContext() : ''),
      // 作者注（兼容傻酒馆 post_history_instructions 字段）
      authors_note: gs.authorsNote || '',
      post_history_instructions: gs.authorsNote || '',
      // v3.5: 剧本规则预设
      scenario_rules: (typeof ScenarioPresets !== 'undefined' ? ScenarioPresets.getPromptInjection() : ''),
      // v3.5: 伏笔系统
      foreshadowing_prompt: (typeof Foreshadowing !== 'undefined' ? ((gs._foreshadowArmed ? Foreshadowing.getPromptInjection() : '') + (gs._foreshadowResolveArmed ? Foreshadowing.getResolvePromptInjection() : '')) : ''),
      // v3.5: 剧情规划阶段转换提示（一次性消费）
      plot_transition: PlotPlanManager.getTransitionContext(),
      // v2.2: 游戏化上下文
      days: gs.days,
      pending_consequences: gs.pendingConsequences.filter(c => !c.applied && c.triggerScene <= gs.scene),
      // v4.1: AI助手创造的剧情建议（注入提示词，消费后标记已用）
      plot_suggestions: (function() {
        if (!gs.plotSuggestions || !gs.plotSuggestions.length) return [];
        var unused = gs.plotSuggestions.filter(function(s) { return !s.used; });
        // Mark as used so they're not repeated
        unused.forEach(function(s) { s.used = true; });
        // Keep only used ones but trim old ones
        if (gs.plotSuggestions.length > 10) gs.plotSuggestions = gs.plotSuggestions.slice(-10);
        return unused.map(function(s) { return s.type + ': ' + s.title + ' — ' + s.content; });
      })(),
    };

    // Clear retry context after sending (one-time use)
    if (gs.lastUndoneChoice) {
      delete gs.lastUndoneChoice;
    }

    // APK版: 使用 AIBridge 直连 DeepSeek API
    // 策略：先尝试流式，失败则非流式回退
    const loadEl = document.getElementById('story-loading');

    // === Stream path ===
    const streamGen = AIBridge.storyStream(payload);
    let finalData = null;

    // 隐藏的原始文本元素（stream 期间不展示）
    const streamPara = document.createElement('p');
    streamPara.style.display = 'none';
    storyDiv.appendChild(streamPara);

    try {
      // 手动消费异步迭代器（兼容不支持 for-await-of 的引擎）
      let iterResult;
      while (true) {
        try { iterResult = await streamGen.next(); } catch(e) { throw new Error(e.message || 'Stream iteration error'); }
        if (iterResult.done) break;
        const sseData = iterResult.value;
        if (sseData.type === 'chunk') {
          // accumulate silently during stream
        } else if (sseData.type === 'done') {
          finalData = sseData;
        } else if (sseData.type === 'error') {
          throw new Error(sseData.error || 'Stream error');
        }
      }
    } catch(streamErr) {
      console.warn('Stream failed, trying non-stream:', streamErr.message);
      streamPara.remove();
      if (loadEl) loadEl.remove();
    }

    streamPara.remove();

    if (finalData && finalData.story) {
      if (loadEl) loadEl.remove();
      this._fetching = false;
      this._renderStoryResponse(finalData, isOpening, false).catch(renderErr => {
        console.warn('Story render failed (stream):', renderErr?.message);
      });
      return;
    }

    // === Non-stream fallback ===
    try {
      if (loadEl) loadEl.querySelector('p').textContent = '命运之书翻到了备用篇章...';
      await new Promise(r => setTimeout(r, 2000));

      const data = await AIBridge.storyGenerate(payload);
      if (data && data.ok && data.story) {
        if (loadEl) loadEl.remove();
        this._fetching = false;
        this._renderStoryResponse(data, isOpening, true).catch(renderErr => {
          console.warn('Story render failed (non-stream):', renderErr?.message);
        });
        return;
      }

      throw new Error(data?.error || 'empty response');
    } catch(nonStreamErr) {
      console.warn('All story API attempts failed, using fallback:', nonStreamErr.message);
      const loadEl2 = document.getElementById('story-loading');
      if (loadEl2) loadEl2.remove();
      this._fallbackStory(choiceText, isOpening);
    }
    this._fetching = false;
  },

  /**
   * Fetch with a manual timeout using AbortController + Promise.race.
   * Does NOT rely on AbortSignal.timeout() — works in ALL browsers.
   */
  _fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Merge the manual abort signal with any existing signal
    const mergedOptions = { ...options, signal: controller.signal };

    return fetch(url, mergedOptions).finally(() => clearTimeout(timer));
  },

  /** Render a successful story response (shared by stream & non-stream paths) */
  async _renderStoryResponse(data, isOpening, isRetry) {
    const gs = this.state;
    const storyDiv = document.getElementById('story-content');

    if (!isOpening) gs.scene++;
    document.getElementById('chapter-label').textContent = isOpening ? '序章' : `第${gs.chapter}章`;
    document.getElementById('scene-label').textContent = `第${gs.scene}节`;
    gs.storyLog.push({ type: 'narrative', content: data.story });

    // 章节摘要: 每次生成后保存前200字摘要（用于快速上下文回忆）
    if (!gs.chapterSummaries) gs.chapterSummaries = [];
    const summary = (data.story || '').slice(0, 200).replace(/\s+/g, ' ').trim();
    gs.chapterSummaries.push({
      chapter: gs.chapter, scene: gs.scene,
      summary: summary,
      timestamp: Date.now()
    });
    // 最多保留50条摘要
    if (gs.chapterSummaries.length > 50) gs.chapterSummaries = gs.chapterSummaries.slice(-50);

    if (isRetry) {
      // Non-streaming retry: render as plain HTML paragraphs
      const contDiv = document.createElement('div');
      contDiv.className = 'fade-in';
      const annotated = AnnotationEngine.annotate(data.story);
      const paras = annotated.split('\n\n').filter(p => p.trim() !== '');
      contDiv.innerHTML = `<hr class="separator">${paras.map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('')}`;
      storyDiv.appendChild(contDiv);
    } else {
      // Streaming path: typewriter animation on the existing streamPara
      const annotated = AnnotationEngine.annotate(data.story);
      await Typewriter.animate(storyDiv, data.story, 6, annotated);
    }

    // Track words for plot plan
    const trackResult = PlotPlanManager.trackWords(data.story);
    if (trackResult && trackResult.phaseChanged) {
      const nextPhase = trackResult.newPhase;
      UIManager.toast(`📖 进入新阶段：${nextPhase.name}`, 'success');
      document.getElementById('topbar-subtitle').textContent = `· ${this.state.player.name} · ${nextPhase.name}`;
    }
    PlotPlanManager._updateButtonBadge();

    // Show undo button
    document.getElementById('undo-btn').style.display = 'inline-block';

    // Apply status updates
    if (data.status_updates) {
      this._applyStatusUpdates(data.status_updates);
    }

    // Auto-create/update character bios from AI-extracted characters
    const aiCharacters = (data.new_characters && data.new_characters.length) ? data.new_characters : (data.characters || []);
    if (aiCharacters && aiCharacters.length > 0) {
      if (!gs.characterBios) gs.characterBios = [];
      aiCharacters.forEach(char => {
        const name = (char.name || '').trim();
        if (!name) return;
      });
      // Update character bios via unified method (includes canvas position)
      CharacterBioManager._updateFromAI(aiCharacters);
      // Update status panel relations if needed
      UIManager.updateAllStatus();
      // v3.5: 旅途日记自动刷新（如果面板打开的话）
      if (typeof JourneyDiary !== 'undefined' && JourneyDiary._open) JourneyDiary.renderContent();
    }

    // v3.5/v4.4 fix: 伏笔完成不能依赖“本段是否出现新人物”。
    // 只要本次生成成功且此前已经发射伏笔，就必须落库并刷新伏笔栏。
    if (gs._foreshadowArmed && typeof Foreshadowing !== 'undefined') {
      // 状态字段优先；若 AI 使用 Markdown 或将状态混进正文，则从正文兜底提取。
      const fsDesc = Foreshadowing.extractDescription(data);
      Foreshadowing.markCompleted(fsDesc || '本段已埋设伏笔（AI未提供摘要，请结合正文查看）');
      gs._foreshadowArmed = false;
      gs._foreshadowActive = false;
    }
    // 用户主动选择“回收”后，只要本段成功生成就完成回收状态。
    if (gs._foreshadowResolveArmed && typeof Foreshadowing !== 'undefined') {
      Foreshadowing.markResolvedByAI();
    }
    // 每次生成结束都刷新右侧伏笔栏，避免 UI 与 state 不同步。
    if (typeof Foreshadowing !== 'undefined') Foreshadowing.renderPanel();
    // v2.3: 意外事件 — 每8轮触发一次
    gs.randomEventCounter++;
    if (gs.randomEventCounter >= 8) {
      gs.randomEventCounter = 0;
      this._triggerRandomEvent();
    }

    // Present choices — 附加 EffectsEngine 本地效果
    const choices = data.choices || [];
    if (choices.length >= 3) {
      const enhanced = EffectsEngine.attachEffects(choices);
      // 合并AI提供的额外效果（物品/技能/关系）
      const merged = enhanced.map((c, i) => {
        const orig = choices[i];
        if (orig && orig.effects) {
          if (orig.effects.items) c.effects.items = orig.effects.items;
          if (orig.effects.skills) c.effects.skills = orig.effects.skills;
          if (orig.effects.relations) c.effects.relations = orig.effects.relations;
        }
        return c;
      });
      this._presentChoices('剧情推进——做出你的选择', merged);
    } else {
      this._fallbackChoices();
    }
  },

  /** 触发意外事件 — 插入一条命运提示 */
  _triggerRandomEvent() {
    const gs = this.state;
    const pool = this.FATE_EVENTS;
    const event = pool[Math.floor(Math.random() * pool.length)];
    const storyDiv = document.getElementById('story-content');
    const fateDiv = document.createElement('div');
    fateDiv.className = 'fate-event fade-in';
    fateDiv.innerHTML = `<p style="color:var(--accent);font-style:italic;text-align:center;padding:12px;margin:8px 0;border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);font-size:13px;letter-spacing:1px;">命运的低语：${event}</p>`;
    storyDiv.appendChild(fateDiv);
    storyDiv.scrollTop = storyDiv.scrollHeight;
  },

  toggleAutoContinue() {
    const gs = this.state;
    if (gs.autoContinue) {
      // Stop auto-continue
      gs.autoContinue = false;
      document.getElementById('btn-auto-continue').textContent = '自动续写';
      document.getElementById('btn-auto-continue').classList.remove('danger');
      UIManager.toast('自动续写已停止', 'info');
      return;
    }
    if (!gs.gameStarted) {
      UIManager.toast('请先开始游戏', 'warning');
      return;
    }
    // Start auto-continue
    gs.autoContinue = true;
    gs.autoContinueCount = 0;
    document.getElementById('btn-auto-continue').textContent = '停止';
    document.getElementById('btn-auto-continue').classList.add('danger');
    UIManager.toast(`开始自动续写（最多${gs.autoContinueMax}节）`, 'success');
    this._autoContinueLoop();
  },

  async _autoContinueLoop() {
    const gs = this.state;
    if (!gs.autoContinue) return;
    if (gs.autoContinueCount >= gs.autoContinueMax) {
      gs.autoContinue = false;
      document.getElementById('btn-auto-continue').textContent = '自动续写';
      document.getElementById('btn-auto-continue').classList.remove('danger');
      UIManager.toast('自动续写完成', 'success');
      return;
    }

    // If waiting for user choice, auto-pick the recommended one
    if (gs.waitingForChoice) {
      const choices = gs.currentChoices;
      const recommended = choices.find(c => c.tag === 'recommended');
      const pick = recommended || choices[0];
      if (pick) {
        const idx = choices.indexOf(pick);
        this._handleChoice(idx, true);
      }
      // Wait a moment for the story to update, then continue
      await new Promise(r => setTimeout(r, 2000));
      // After handling choice, wait for the new story & choices
      let waitCount = 0;
      while (!gs.waitingForChoice && gs.autoContinue && waitCount < 120) {
        await new Promise(r => setTimeout(r, 1000));
        waitCount++;
      }
    } else {
      // Not waiting for choice yet (story is being fetched), just wait
      let waitCount = 0;
      while (!gs.waitingForChoice && gs.autoContinue && waitCount < 180) {
        await new Promise(r => setTimeout(r, 1000));
        waitCount++;
      }
      if (waitCount >= 180) {
        UIManager.toast('等待超时，自动续写暂停', 'warning');
        gs.autoContinue = false;
        document.getElementById('btn-auto-continue').textContent = '自动续写';
        document.getElementById('btn-auto-continue').classList.remove('danger');
        return;
      }
    }

    if (!gs.autoContinue) return;

    // Check if plot plan is complete - stop auto-continue if all phases done
    const pp = gs.plotPlan;
    if (pp && pp.enabled && pp.phases && pp.phases.length > 0) {
      const lastPhase = pp.phases[pp.phases.length - 1];
      if (pp.currentPhaseIdx >= pp.phases.length - 1 &&
          lastPhase.wordBudget > 0 &&
          lastPhase.wordsWritten >= lastPhase.wordBudget * 0.95) {
        gs.autoContinue = false;
        document.getElementById('btn-auto-continue').textContent = '自动续写';
        document.getElementById('btn-auto-continue').classList.remove('danger');
        UIManager.toast('🎉 剧情规划目标已达成！故事完结', 'success');
        return;
      }
    }

    gs.autoContinueCount++;
    this._autoContinueLoop(); // Next iteration
  },

  _fallbackStory(choiceText, isOpening) {
    // Legacy template fallback
    this.state.scene++;
    document.getElementById('chapter-label').textContent = isOpening ? '序章' : `第${this.state.chapter}章`;
    document.getElementById('scene-label').textContent = `第${this.state.scene}节`;
    const storyDiv = document.getElementById('story-content');
    const div = document.createElement('div');
    div.className = 'fade-in';
    const gs = this.state;
    const playerName = gs.player?.name || '主角';
    const genre = gs.genre || '';
    let fallbackText = '';
    if (genre.includes('仙侠') || genre.includes('修真')) {
      fallbackText = `${playerName}在短暂的休整后，感受到体内魂力缓缓流转。四周的雾气时聚时散，远处的天际泛起一抹微光。一些被忽略的细节渐渐浮现——地上的足迹、空气中残留的气息、魂铃若有若无的震颤。`;
    } else if (genre.includes('科幻') || genre.includes('末世')) {
      fallbackText = `${playerName}稍作喘息，检查了装备状态。周围的废墟在暮色中投出长长的阴影，隐约能听到远处传来的异响。现在需要做出一个决定——继续深入，还是先确保退路的安全。`;
    } else {
      fallbackText = `${playerName}环顾四周，风吹过树梢发出沙沙的声响。空气中的气息、地面的痕迹、远处的动静——一切都指向着下一步的选择。冒险还在继续，前方的道路等待被探索。`;
    }
    div.innerHTML = `<hr class="separator"><p style="color:var(--accent);font-size:12px;">AI生成超时，转入备用剧情 —</p><p>${fallbackText}</p>`;
    storyDiv.appendChild(div);
    storyDiv.scrollTop = storyDiv.scrollHeight;
    document.getElementById('undo-btn').style.display = 'inline-block';
    this._fallbackChoices();
  },

  _fallbackChoices() {
    const gs = this.state;
    const genre = gs.genre || '';
    const bios = gs.characterBios || [];

    // Build options from known characters + basic actions
    let choices = [];

    // Option 1: Use the last AI-generated option if it had recommended tag
    const lastChoices = gs.currentChoices || [];
    if (lastChoices.length >= 3) {
      // Use the previous AI options (they're valid, just from a prior retry)
      choices = lastChoices.map(c => ({...c}));
    }

    if (choices.length < 3) {
      // Build contextual options from character bios
      const allies = bios.filter(c => c.role === 'ally' || c.role === 'mentor');
      const neutrals = bios.filter(c => c.role === 'neutral');
      const rivals = bios.filter(c => c.role === 'rival');

      const playerName = gs.player?.name || '主角';

      // Try to build options from genre + known characters
      if (genre.includes('仙侠') || genre.includes('修真')) {
        choices = [
          { text: `运功调息，恢复魂力`, tag:'recommended', effects:{ spirit:1, exp:20 } },
          { text: `探查周围是否有残魂或怨灵的踪迹`, effects:{ perception:1, exp:20 } },
          { text: `前往最近的仙城打听消息`, effects:{ intelligence:1, exp:15 } },
          { text: `寻找一处安静之地参悟当前的线索`, effects:{ exp:25 } },
        ];
        if (allies.length) {
          choices[0] = { text: `去找${allies[0].name}商议对策`, tag:'recommended', effects:{ exp:20 } };
        }
        if (neutrals.length) {
          choices[2] = { text: `试着找到${neutrals[0].name}询问线索`, effects:{ perception:1, exp:25 } };
        }
      } else if (genre.includes('玄幻') || genre.includes('奇幻')) {
        choices = [
          { text: `观察四周，寻找安全的落脚点`, tag:'recommended', effects:{ perception:2, exp:20 } },
          { text: `尝试感应周围的灵力波动`, effects:{ spirit:2, exp:20 } },
          { text: `向附近的居民打听这片区域的情报`, effects:{ exp:25 } },
          { text: `检查随身携带的道具和装备`, effects:{ exp:15 } },
        ];
      } else if (genre.includes('科幻') || genre.includes('末世') || genre.includes('克苏鲁')) {
        choices = [
          { text: `检查装备和补给状态`, tag:'recommended', effects:{ perception:1, exp:20 } },
          { text: `利用环境寻找掩护，评估当前威胁`, effects:{ agility:1, exp:20 } },
          { text: `尝试联络可用的通讯渠道`, effects:{ intelligence:1, exp:25 } },
          { text: `沿着线索继续深入调查`, effects:{ exp:25 } },
        ];
      } else {
        choices = [
          { text: `继续前进，探索前方`, tag:'recommended', effects:{ perception:1, exp:20 } },
          { text: `仔细调查周围环境寻找线索`, effects:{ intelligence:1, exp:20 } },
          { text: `回忆当前掌握的所有信息，梳理思路`, effects:{ exp:25 } },
          { text: `修整片刻，为下一步行动做准备`, effects:{ spirit:1, exp:15 } },
        ];
      }
    }

    // Always add at least one default option referencing the player's current goal
    if (choices.length < 3) {
      choices.push({ text: '继续当前行动', effects:{ exp:20 } });
      choices.push({ text: '谨慎观察后再行动', effects:{ perception:1, exp:15 } });
    }

    this._presentChoices('抉择时刻 — 剧情推进', choices);
    console.log('[v3.0] fallback choices loaded, genre:', gs.genre);
  },

  _presentChoices(prompt, choices) {
    const p = this.state.player;
    // v2.2: 健康/心情过滤
    const dangerHealth = ['重伤', '濒危', '濒死'];
    const dangerMood = ['绝望', '恐惧'];
    let filtered = (choices || []).filter(c => c.text && c.text.trim().length >= 3);
    if (dangerHealth.includes(p.health)) {
      filtered = filtered.filter(c => !['combat_win','combat_risk','combat_loss'].includes(c.type));
    }
    if (dangerMood.includes(p.mood)) {
      filtered = filtered.filter(c => !['social_success','social_negotiate'].includes(c.type));
    }
    if (filtered.length < 2) {
      return this._fallbackChoices();
    }
    this.state.currentChoices = filtered; this.state.choicePrompt = prompt; this.state.waitingForChoice = true; this.state.choiceCount++;
    document.getElementById('choice-bar').style.display = 'block';
    const container = document.getElementById('choices-container');
    container.innerHTML = '';

    // v2.2: 状态提示 — 让玩家看得到自己的筹码
    const statSummary = this._buildStatSummary();
    if (statSummary) {
      const hint = document.createElement('div');
      hint.className = 'choice-hint fade-in';
      hint.innerHTML = `<span style="color:var(--text-dim);font-size:11px;">${statSummary}</span>`;
      container.appendChild(hint);
    }

    const labels = 'ABCDEFGH'.split('');
    filtered.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = `choice-btn ${c.tag==='recommended'?'recommended':''} fade-in`;
      btn.style.animationDelay = `${i*0.1}s`;
      const icon = this.RISK_EMOJI[c.type] || '';
      // 清理选项文本中可能残留的内部代码（tag/type/方括号标签等）
      let cleanText = c.text || '';
      cleanText = cleanText
        .replace(/\[type:[^\]]*\]/gi, '')      // [type:combat_win]
        .replace(/\[tag:[^\]]*\]/gi, '')        // [tag:recommended]
        .replace(/【type:[^】]*】/g, '')          // 【type:combat_win】
        .replace(/【tag:[^】]*】/g, '')            // 【tag:recommended】
        .replace(/^\[推荐\]\s*/i, '')
        .replace(/^\[高风险\]\s*/i, '')
        .replace(/^\【推荐\】\s*/g, '')
        .replace(/^\【高风险\】\s*/g, '')
        .replace(/\s*\[recommended\]/gi, '')
        .replace(/\s*\[high_risk\]/gi, '')
        .trim();
      btn.innerHTML = `<span class="choice-num">${icon} ${labels[i]}</span>${cleanText}`;
      btn.onclick = () => this._handleChoice(i);
      container.appendChild(btn);
    });
    document.getElementById('custom-input').value = '';
    const storyDiv = document.getElementById('story-content');
    if (storyDiv) storyDiv.scrollTop = storyDiv.scrollHeight;
  },

  /** 构建当前状态摘要，显示在选项上方 */
  _buildStatSummary() {
    const p = this.state.player;
    const parts = [`❤${p.health}`];
    if (p.mood && p.mood !== '平淡') parts.push(`${p.mood}`);
    // Show top 3 highest stats
    const stats = p.stats || {};
    const entries = Object.entries(stats).filter(([k,v]) => typeof v === 'number' && v > 0);
    if (entries.length) {
      entries.sort((a,b) => b[1] - a[1]);
      const tops = entries.slice(0,2).map(([k,v]) => {
        const name = (p.statsLayout?.stats?.find(s => s.id === k)?.name) || k;
        const star = v >= 8 ? '★' : v <= 2 ? '↓' : '';
        return `${star}${name}:${Math.floor(v)}`;
      });
      parts.push(tops.join(' '));
    }
    return parts.join(' · ');
  },

  /** 故事生成时的小地球饼图动画 */
  /** 通用小饼图（正确角度→百分比对应） */
  _startPieSmall(fillId, pctId, r, cx, cy, totalMs) {
    const startTime = Date.now();
    const fillEl = document.getElementById(fillId);
    const textEl = document.getElementById(pctId);
    if (!fillEl || !textEl) return;

    const tick = () => {
      if (!document.getElementById('story-loading') && !document.getElementById('import-loading')) return;
      const elapsed = Date.now() - startTime;
      let pct = Math.min(elapsed / totalMs, 1) * 90;
      pct = Math.floor(pct);
      textEl.textContent = pct + '%';

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

  _applyEffects(effects) {
    if (!effects) return;
    const p = this.state.player; const msg = [];
    const add = (txt) => msg.push(txt);
    // Health & mood changes
    if (effects.health) { p.health = effects.health; add(`健康: ${effects.health}`); }
    if (effects.mood) { p.mood = effects.mood; add(`心情: ${effects.mood}`); }
    // Dynamic stats from AI-generated layout
    if (p.statsLayout && p.statsLayout.stats) {
      p.statsLayout.stats.forEach(s => {
        if (effects[s.id]) {
          p.stats[s.id] = (p.stats[s.id] || s.value) + effects[s.id];
          add(`${s.name} ${effects[s.id]>0?'+'+effects[s.id]:effects[s.id]}`);
        }
      });
    }
    // Legacy stat names still supported
    const legacyMap = {'strength':'力量','agility':'敏捷','constitution':'体质','intelligence':'智力','spirit':'精神','perception':'感知'};
    Object.entries(legacyMap).forEach(([k,v]) => {
      if (effects[k]) { p.stats[k] = (p.stats[k]||15) + effects[k]; add(`${v} ${effects[k]>0?'+'+effects[k]:effects[k]}`); }
    });
    if (effects.skills) { effects.skills.forEach(s => { if (!p.skills.find(x=>x.name===s.name)) p.skills.push(s); }); add(`习得: ${effects.skills.map(s=>s.name).join(', ')}`); }
    if (effects.items) { effects.items.forEach(it => { const e = p.items.find(x=>x.name===it.name); if(e) e.qty+=it.qty; else p.items.push({...it}); }); add(`获得: ${effects.items.map(i=>`${i.name} x${i.qty}`).join(', ')}`); // v2.0: 同步到 InventorySystem
      // v3.1-hotfix: 记录指纹供 _applyStatusUpdates 去重，防止AI在选项和状态块中重复报告同一批道具
      const fp = effects.items.map(it => `${it.name}=${it.qty || 1}`).sort().join('|');
      this._lastItemsFingerprint = fp;
      effects.items.forEach(it => InventorySystem.addItem(p, it.name, it.qty || 1, it.desc || '')); }
    if (effects.relations) {
      Object.entries(effects.relations).forEach(([k,v]) => { p.relations[k] = (p.relations[k]||0)+v; });
      // 同步到人物关系图画布
      if (typeof CharacterBioManager !== 'undefined') CharacterBioManager._syncFromPlayerRelations();
    }
    // New character introductions from story
    if (effects.new_characters) {
      effects.new_characters.forEach(c => {
        if (!p.relations[c.name]) { p.relations[c.name] = c.intimacy || 0; }
        add(`结识: ${c.name}`);
      });
      // Store character details for richer display
      if (!p._charDetails) p._charDetails = {};
      effects.new_characters.forEach(c => {
        if (!p._charDetails[c.name] || c.background) {
          p._charDetails[c.name] = { intimacy: c.intimacy||0, relation: c.relation||'路人', background: c.background||'' };
        }
      });
      // 同步新人物到画布
      if (typeof CharacterBioManager !== 'undefined') CharacterBioManager._syncFromPlayerRelations();
    }
    if (msg.length > 0) {
      // Effects shown via toast + status panel only, not in story body
      UIManager.toast('📊 ' + msg.join(' | '), 'info');
    }
    UIManager.updateAllStatus();
  },

  _applyStatusUpdates(updates) {
    // Apply narrative-driven status changes from server
    const p = this.state.player;
    if (updates.health) p.health = updates.health;
    if (updates.mood) p.mood = updates.mood;
    // 等级/品阶/经验更新
    if (updates.level) p.level = updates.level;
    if (updates.rank) p.rank = updates.rank;
    if (updates.exp !== undefined) p.exp = updates.exp;
    if (updates.expToNext) p.expToNext = updates.expToNext;
    // New characters found in story
    if (updates.new_characters) {
      if (!p._charDetails) p._charDetails = {};
      updates.new_characters.forEach(c => {
        if (!p.relations[c.name]) p.relations[c.name] = c.intimacy || 0;
        if (!p._charDetails[c.name] || c.background) {
          p._charDetails[c.name] = {
            intimacy: c.intimacy || 0,
            relation: c.relation || '路人',
            background: c.background || ''
          };
        }
      });
      // 同步到画布
      if (typeof CharacterBioManager !== 'undefined') CharacterBioManager._syncFromPlayerRelations();
    }
    // Relationship changes from story
    if (updates.relation_changes) {
      Object.entries(updates.relation_changes).forEach(([name, val]) => {
        p.relations[name] = (p.relations[name] || 0) + val;
      });
      // 同步到画布
      if (typeof CharacterBioManager !== 'undefined') CharacterBioManager._syncFromPlayerRelations();
    }
    // New skills/abilities discovered in story
    if (updates.new_skills) {
      updates.new_skills.forEach(s => {
        if (!p.skills.find(x => x.name === s.name)) p.skills.push(s);
      });
    }
    // Skill upgrades (proficiency / level increase)
    if (updates.skill_upgrades) {
      updates.skill_upgrades.forEach(up => {
        const existing = p.skills.find(x => x.name === up.name);
        if (existing) {
          if (up.level) existing.level = up.level;
          if (up.proficiency) existing.proficiency = up.proficiency;
        }
      });
    }
    // New items found
    if (updates.new_items) {
      // v3.1-hotfix: 去重机制 - 如果AI连续两轮报告完全相同的物品批次，跳过
      const itemsFingerprint = updates.new_items.map(it => `${it.name}=${it.qty || 1}`).sort().join('|');
      const skipDuplicate = (this._lastItemsFingerprint === itemsFingerprint);
      if (skipDuplicate) {
        console.warn('_applyStatusUpdates: 跳过重复物品批次（AI可能重复报告当前物品）:', itemsFingerprint);
      } else {
        this._lastItemsFingerprint = itemsFingerprint;
        updates.new_items.forEach(it => {
          const existing = p.items.find(x => x.name === it.name);
          if (existing) existing.qty += (it.qty || 1);
          else p.items.push({ name: it.name, qty: it.qty || 1, desc: it.desc || '' });
          // v2.0: 同步到 InventorySystem
          InventorySystem.addItem(p, it.name, it.qty || 1, it.desc || '');
        });
      }
    }
    // v4.0.1: 新地点自动同步到世界构建器
    if (updates.new_locations) {
      var wbData = WorldBuilder.getData();
      var existingLocNames = (wbData.locations || []).map(function(l) { return l.name; });
      updates.new_locations.forEach(function(loc) {
        if (!loc.name || existingLocNames.indexOf(loc.name) >= 0) return;
        wbData.locations.push({
          id: wbData._nextId++,
          name: loc.name,
          type: '',
          description: loc.description || '',
          significance: '剧情中首次出现',
          atmosphere: ''
        });
        existingLocNames.push(loc.name);
      });
      this.state.worldBuilderData = wbData;
    }
    // v4.0.1: 新功法/能力自动同步到世界构建器
    if (updates.new_abilities) {
      var wbData2 = WorldBuilder.getData();
      var existingAbNames = (wbData2.abilities || []).map(function(a) { return a.name; });
      updates.new_abilities.forEach(function(ab) {
        if (!ab.name || existingAbNames.indexOf(ab.name) >= 0) return;
        wbData2.abilities.push({
          id: wbData2._nextId++,
          name: ab.name,
          type: '',
          description: ab.description || '',
          effects: '',
          requirements: ''
        });
        existingAbNames.push(ab.name);
      });
      this.state.worldBuilderData = wbData2;
    }
    UIManager.updateAllStatus();
    AnnotationEngine.rebuildTerms();
  },

  _checkLevelUp() {
    // Level-up removed — advancement is now narrative-driven, not numeric
    // Stats change via AI-generated effects based on story context
  },

  applyAIContent() {
    const content = document.getElementById('ai-content-in').value.trim();
    const choicesRaw = document.getElementById('ai-choices-in').value.trim();
    if (!content) { UIManager.toast('请粘贴AI生成的剧情', 'warning'); return; }
    const storyDiv = document.getElementById('story-content');
    const div = document.createElement('div');
    div.className = 'fade-in';
    div.innerHTML = `<hr class="separator"><p style="color:var(--accent);font-size:12px;">AI剧情 —</p>${content.replace(/\n/g,'<br>')}`;
    storyDiv.appendChild(div);
    this.state.storyLog.push({ type:'ai-content', content });
    if (choicesRaw) {
      const lines = choicesRaw.split('\n').filter(l=>l.trim());
      const choices = lines.map(line => { const isRec=line.startsWith('*'); return { text:isRec?line.substring(1).trim():line.trim(), tag:isRec?'recommended':'', effects:{ exp:20 } }; });
      if (choices.length) setTimeout(() => this._presentChoices('AI生成的抉择…', choices), 800);
    } else this._fallbackChoices();
    UIManager.hideModal('ai-modal');
    UIManager.toast('AI剧情已注入！', 'success');
    storyDiv.scrollTop = storyDiv.scrollHeight;
  },

  // ========== 导出功能 ==========

  /** 导出可读的冒险记录为 .txt 文件 — 弹窗保存 */
  async exportStory() {
    const gs = this.state;
    if (!gs.gameStarted) { UIManager.toast('请先开始游戏', 'warning'); return; }
    const p = gs.player;

    let content = '';
    content += `${gs.worldName || '未知世界'}　冒险记录\n`;
    content += `${'═'.repeat(50)}\n\n`;
    content += `主角：${p.name}　${p.age}岁　${p.sex}\n`;
    if (p.personality) content += `性格：${p.personality}\n`;
    if (p.oneLine) content += `概要：${p.oneLine}\n`;
    if (p.background) content += `背景：${p.background}\n`;
    if (p.ability) content += `能力：${p.ability}\n`;
    if (p.goal) content += `目标：${p.goal}\n`;
    content += '\n';

    content += `${'═'.repeat(50)}\n`;
    content += '冒险日志\n';
    content += `${'═'.repeat(50)}\n\n`;

    let currentChapter = 0;
    gs.storyLog.forEach(entry => {
      if (entry.type === 'narrative' || entry.type === 'ai-content') {
        const chapterMatch = entry.content?.match(/第(\d+)章/);
        if (chapterMatch && parseInt(chapterMatch[1]) !== currentChapter) {
          currentChapter = parseInt(chapterMatch[1]);
          content += `\n── 第${currentChapter}章 ──\n\n`;
        }
        content += (entry.content || '') + '\n\n';
      }
    });

    if (p.history.length > 0) {
      content += `${'═'.repeat(50)}\n`;
      content += '抉择记录\n';
      content += `${'═'.repeat(50)}\n\n`;
      p.history.forEach(h => {
        content += `第${h.chapter}章 第${h.scene}节 — ${h.choice}\n`;
      });
      content += '\n';
    }

    content += `${'═'.repeat(50)}\n`;
    content += '终局状态\n';
    content += `${'═'.repeat(50)}\n\n`;
    content += `进度：第${gs.chapter}章 第${gs.scene}节\n`;
    content += `健康：${p.health}　|　心情：${p.mood}\n`;

    if (p.statsLayout && p.statsLayout.stats) {
      content += '\n属性：\n';
      p.statsLayout.stats.forEach(s => {
        content += `  ${s.name}：${p.stats[s.id] ?? 0}\n`;
      });
    }
    if (p.skills.length > 0) {
      content += `\n技能：${p.skills.map(s => s.name).join('、')}\n`;
    }
    if (p.items.length > 0) {
      content += `\n物品：${p.items.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('、')}\n`;
    }
    const relKeys = Object.keys(p.relations).filter(k => k !== '_charDetails');
    if (relKeys.length > 0) {
      content += '\n人际关系：\n';
      relKeys.forEach(name => {
        content += `  ${name}：好感度 ${p.relations[name]}\n`;
      });
    }
    const now = new Date();
    content += `\n\n── 导出时间：${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} ──\n`;

    // 弹窗另存为
    this._showExportDialog(content, `${p.name}_冒险记录_第${gs.chapter}章`);
  },

  /** 导出弹窗 — 预览+另存为 */
  _showExportDialog(content, defaultName) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-card" style="width:700px;max-height:85vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 0 12px;border-bottom:1px solid var(--border);">
        <h3 style="margin:0;">另存为 TXT</h3>
        <button class="btn sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
      <div style="padding:12px 0;">
        <label style="color:var(--gold);font-size:12px;display:block;margin-bottom:4px;">文件名</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="export-filename" value="${defaultName}.txt" style="flex:1;padding:8px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px;font-family:var(--font-main);">
        </div>
      </div>
      <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;">
        <label style="color:var(--text-dim);font-size:11px;display:block;margin-bottom:4px;">内容预览</label>
        <textarea readonly style="flex:1;width:100%;padding:10px;background:var(--code-bg);border:1px solid var(--border);border-radius:4px;color:var(--text-dim);font-size:12px;font-family:var(--font-mono);resize:none;line-height:1.5;">${content.slice(0, 5000)}${content.length > 5000 ? '\n\n... (以下略，导出文件包含完整内容)' : ''}</textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <button class="btn primary" onclick="GameEngine._doExport(this)" style="flex:1;padding:10px;font-size:13px;">保存文件</button>
        <button class="btn" onclick="this.closest('.modal-overlay').remove()" style="padding:10px 20px;">取消</button>
      </div>
    </div>`;
    overlay._exportContent = content;
    document.body.appendChild(overlay);
  },

  /** 编辑作者注（SillyTavern-style, 固定在prompt底部的强制指令） */
  editAuthorsNote() {
    const gs = this.state;
    const current = gs.authorsNote || '';
    const note = prompt('编辑作者注（此文本固定在每轮生成提示词的末尾）：', current);
    if (note === null) return; // cancelled
    gs.authorsNote = note;
    const preview = document.getElementById('authors-note-preview');
    if (preview) preview.textContent = note || '（空）';
    UIManager.toast(note ? '作者注已更新' : '作者注已清除', 'success');
  },

  _doExport(btn) {
    const overlay = btn.closest('.modal-overlay');
    const content = overlay._exportContent || '';
    const filename = document.getElementById('export-filename').value.trim() || '冒险记录.txt';
    overlay.remove();
    this._downloadFile(content, filename, 'text/plain;charset=utf-8');
    UIManager.toast('冒险记录已导出！', 'success');
  },

  /** 导出完整存档为 .json 文件（可用于备份或迁移） */
  async exportSave() {
    const gs = this.state;
    if (!gs.gameStarted) { UIManager.toast('请先开始游戏', 'warning'); return; }

    // 深拷贝，剔除瞬态/UI 相关字段
    const saveData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      genre: gs.genre,
      worldName: gs.worldName,
      world: gs.world,
      era: gs.era,
      locations: gs.locations,
      factions: gs.factions,
      powerSystem: gs.powerSystem,
      player: (function() {
        var p = JSON.parse(JSON.stringify(gs.player));
        // 导出保留最近 1000 条历史
        if (p.history && p.history.length > 1000) p.history = p.history.slice(-1000);
        return p;
      })(),
      chapter: gs.chapter,
      scene: gs.scene,
      storyLog: (function() {
        var log = gs.storyLog || [];
        // 导出保留最近 300 条，超出部分截断到 200 字
        if (log.length <= 300) return JSON.parse(JSON.stringify(log));
        return log.slice(-300).map(function(entry, i, arr) {
          var isRecent = i >= arr.length - 80;
          if (isRecent || (entry.content || '').length <= 200) return JSON.parse(JSON.stringify(entry));
          return Object.assign(JSON.parse(JSON.stringify(entry)), { content: (entry.content || '').slice(0, 200) + '...[已截断]' });
        });
      })(),
      choiceCount: gs.choiceCount,
      characterBios: JSON.parse(JSON.stringify(gs.characterBios || [])),
      plotPlan: gs.plotPlan ? JSON.parse(JSON.stringify(gs.plotPlan)) : null,
    };

    const json = JSON.stringify(saveData, null, 2);
    const p = gs.player;
    await this._downloadFile(json, `${p.name}_存档_第${gs.chapter}章.json`, 'application/json;charset=utf-8');
    UIManager.toast('存档已导出！', 'success');
  },

  /** 底层的文件保存触发器 — 优先弹系统"另存为"对话框，兜底用浏览器下载 */
  async _downloadFile(content, filename, mimeType) {
    // Fix Windows line endings for Notepad compatibility
    const fixed = content.replace(/\r?\n/g, '\r\n');

    // Try File System Access API first — user picks save location
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: filename.endsWith('.json') ? 'JSON File' : 'Text File',
            accept: { [mimeType]: ['.' + filename.split('.').pop()] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(fixed);
        await writable.close();
        return;
      } catch (e) {
        // User cancelled or API failed — fall through to Blob approach
        console.warn('showSaveFilePicker failed, falling back to blob download:', e.message);
      }
    }

    // Fallback: Blob URL + <a> click
    const bom = '\uFEFF';
    const blob = new Blob([bom + fixed], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }
};
} catch(geInitErr) {
  GameEngine = { _initError: geInitErr.message, state: {} };
  console.error('[GameEngine INIT ERROR]', geInitErr);
  if (typeof _sendLog === 'function') _sendLog('error', 'GameEngine INIT ERROR: ' + geInitErr.message, 'game-engine.js', geInitErr.lineNumber || '', geInitErr.stack || '');
}

// ── 确保 GameEngine 在 onclick 中可访问（兼容 pywebview/IE 内核）──
window.GameEngine = GameEngine;


