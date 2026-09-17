// ============================
// STORY ASSISTANT — 游戏操控台
// v4.0.1: 从问答聊天升级为可执行游戏操作
// 支持 12 种操控：帮我选/继续写/加人物/改人物/删人物/加地点/加功法/加道具/改关系/改状态/改设定/自定义行动
// ============================
var StoryAssistant = {
  _open: false,
  _history: [],
  _maxHistory: 20,

  // 14 种操作类型
  ACTIONS: {
    choose:            { label: '帮我选',     icon: '🎯', needConfirm: false },
    continue:          { label: '继续写',     icon: '▶️', needConfirm: false },
    add_character:     { label: '+人物',      icon: '👤', needConfirm: false },
    modify_character:  { label: '改人物',     icon: '📝', needConfirm: true  },
    delete_character:  { label: '删人物',     icon: '🗑️', needConfirm: true  },
    add_location:      { label: '+地点',      icon: '📍', needConfirm: false },
    add_ability:       { label: '+功法',      icon: '⚔️', needConfirm: false },
    add_item:          { label: '+道具',      icon: '🎒', needConfirm: false },
    change_relation:   { label: '改关系',     icon: '🔗', needConfirm: false },
    set_status:        { label: '改状态',     icon: '💚', needConfirm: true  },
    edit_world:        { label: '改设定',     icon: '🌍', needConfirm: true  },
    use_item:          { label: '用道具',     icon: '🗑️', needConfirm: false },
    create_plot:       { label: '创剧情',     icon: '📜', needConfirm: false },
    custom_action:     { label: '自定义',     icon: '✍️', needConfirm: false }
  },

  init() {
    var fab = document.getElementById('sa-fab');
    if (fab) fab.onclick = function() { StoryAssistant.toggle(); };
    var input = document.getElementById('sa-input');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          StoryAssistant.send();
        }
      });
    }
  },

  toggle() {
    this._open = !this._open;
    var panel = document.getElementById('sa-panel');
    var fab = document.getElementById('sa-fab');
    if (!panel) return;
    if (this._open) {
      panel.classList.remove('hidden');
      if (fab) fab.classList.add('sa-fab-active');
      setTimeout(function() {
        var input = document.getElementById('sa-input');
        if (input) input.focus();
      }, 100);
    } else {
      panel.classList.add('hidden');
      if (fab) fab.classList.remove('sa-fab-active');
    }
  },

  close() {
    this._open = false;
    var panel = document.getElementById('sa-panel');
    var fab = document.getElementById('sa-fab');
    if (panel) panel.classList.add('hidden');
    if (fab) fab.classList.remove('sa-fab-active');
  },

  // === 快捷操作入口 ===
  quickAction(type) {
    if (!GameEngine.state.gameStarted && type !== 'add_character' && type !== 'add_location' && type !== 'add_ability') {
      this._appendMessage('system', '⚠️ 请先开始游戏才能使用此功能。');
      return;
    }
    var prompts = {
      choose: '帮我分析当前选项，选一个最适合角色的',
      continue: '帮我续写下一步剧情',
      add_character: '帮我新增一个人物，根据当前世界观设定',
      modify_character: '帮我修改一个已有人物的设定',
      delete_character: '帮我删除一个不重要的角色',
      add_location: '帮我新增一个地点，根据当前世界观设定',
      add_ability: '帮我新增一个功法/能力，根据当前世界观设定',
      add_item: '帮主角获得一个新道具',
      change_relation: '帮我改变两个角色的关系',
      set_status: '帮我修改主角的状态',
      edit_world: '帮我修改世界观设定',
      use_item: '帮主角消耗一个道具来推进剧情',
      create_plot: '帮我设计接下来的剧情走向',
      custom_action: ''
    };
    if (type === 'custom_action') {
      var input = document.getElementById('sa-input');
      if (input) input.focus();
      return;
    }
    var userMsg = prompts[type] || '';
    if (!userMsg) return;
    this._appendMessage('user', this.ACTIONS[type].icon + ' ' + userMsg);
    this._sendWithAction(userMsg, type);
  },

  // === 自由输入入口 ===
  async send() {
    var input = document.getElementById('sa-input');
    if (!input || !input.value.trim()) return;
    var userMsg = input.value.trim();
    input.value = '';
    this._appendMessage('user', userMsg);
    var intent = this._detectIntent(userMsg);
    this._sendWithAction(userMsg, intent);
  },

  // === 意图检测（扩展版） ===
  _detectIntent(msg) {
    var lower = msg.toLowerCase();
    if (/帮我选|选一个|帮.*选|选哪个|pick/.test(lower)) return 'choose';
    if (/继续|续写|下一步|continue|auto/.test(lower)) return 'continue';
    if (/加.*人物|新增.*人物|add.*char|新角色/.test(lower)) return 'add_character';
    if (/改.*人物|修改.*角色|编辑.*人物|edit.*char|改.*角色/.test(lower)) return 'modify_character';
    if (/删.*人物|删除.*角色|remove.*char|去掉.*角色/.test(lower)) return 'delete_character';
    if (/加.*地点|新增.*地点|add.*loc|新地方/.test(lower)) return 'add_location';
    if (/加.*功法|新增.*功法|加.*能力|add.*ability|新技能/.test(lower)) return 'add_ability';
    if (/加.*道具|新增.*道具|获得.*道具|add.*item|给.*道具/.test(lower)) return 'add_item';
    if (/改.*关系|变化.*关系|change.*rel|关系.*变/.test(lower)) return 'change_relation';
    if (/改.*状态|修改.*健康|改.*心情|改.*等级|set.*status|改.*血量/.test(lower)) return 'set_status';
    if (/改.*世界观|改.*设定|修改.*世界|edit.*world|改背景/.test(lower)) return 'edit_world';
    if (/消耗.*道具|用.*道具|使用.*道具|吃掉|服下|喝下|破坏.*道具|扔掉.*道具|use.*item|consume/.test(lower)) return 'use_item';
    if (/创造.*剧情|设计.*剧情|怎么.*发展|接下来.*剧情|帮我.*想.*剧情|create.*plot|剧情.*走向/.test(lower)) return 'create_plot';
    return 'chat';
  },

  // === 核心调用 ===
  async _sendWithAction(userMsg, intent) {
    var context = this._buildContext(intent);
    this._showTyping();
    try {
      var messages = [
        { role: 'system', content: context },
        ...this._history.slice(-this._maxHistory),
        { role: 'user', content: userMsg }
      ];
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: (typeof AIBridge !== 'undefined' && AIBridge._apiModel) ? AIBridge._apiModel : 'deepseek-chat',
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      var data = await response.json();
      this._hideTyping();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        var reply = data.choices[0].message.content;
        var parsed = this._parseActionReply(reply);
        if (parsed.action) {
          this._appendMessage('assistant', parsed.text);
          this._showActionConfirm(parsed.action, parsed.text);
        } else {
          this._appendMessage('assistant', parsed.text);
        }
        this._history.push({ role: 'user', content: userMsg });
        this._history.push({ role: 'assistant', content: reply });
        if (this._history.length > this._maxHistory * 2) {
          this._history = this._history.slice(-this._maxHistory * 2);
        }
      } else {
        this._appendMessage('system', 'AI 回复异常，请检查 API 配置。');
      }
    } catch (err) {
      this._hideTyping();
      this._appendMessage('system', '请求失败：' + err.message);
    }
  },

  // === 解析AI动作JSON ===
  _parseActionReply(reply) {
    // [\s\S] 代替 . 以匹配跨行 JSON（DeepSeek 经常输出多行格式）
    var actionMatch = reply.match(/\[ACTION\]([\s\S]+?)\[\/ACTION\]/);
    var text = reply;
    var action = null;
    if (actionMatch) {
      text = reply.replace(/\[ACTION\][\s\S]+?\[\/ACTION\]/, '').trim();
      var raw = actionMatch[1].trim();
      // 去除 AI 可能包裹的 markdown 代码块
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      try {
        action = JSON.parse(raw);
        console.log('[StoryAssistant] 解析到动作:', action.type, action.params);
      } catch (e) {
        console.warn('[StoryAssistant] 动作JSON解析失败，原始内容:', raw);
        // 尝试修复常见问题：尾部多余逗号
        var fixed = raw.replace(/,(\s*[}\]])/g, '$1');
        try {
          action = JSON.parse(fixed);
          console.log('[StoryAssistant] 修复尾部逗号后解析成功:', action.type);
        } catch (e2) {
          console.warn('[StoryAssistant] 修复后仍失败:', e2.message);
        }
      }
    }
    return { text: text, action: action };
  },

  // === 确认/取消按钮 ===
  _showActionConfirm(action, explanation) {
    var chatBox = document.getElementById('sa-chat');
    if (!chatBox) return;
    var needConfirm = this.ACTIONS[action.type] && this.ACTIONS[action.type].needConfirm;
    if (!needConfirm) {
      this._executeAction(action);
      this._appendMessage('system', '✅ 已执行：' + (this.ACTIONS[action.type]?.label || action.type));
      return;
    }
    var confirmDiv = document.createElement('div');
    confirmDiv.className = 'sa-action-confirm-row';
    confirmDiv.style.cssText = 'padding:4px 0;text-align:center;';
    confirmDiv.innerHTML = '<button class="sa-action-confirm" onclick="StoryAssistant._confirmAction(this)" ' +
      'data-action=\'' + JSON.stringify(action).replace(/'/g, '&#39;') + '\'>' +
      '✅ 确认执行' + (this.ACTIONS[action.type]?.label || action.type) + '</button>' +
      '<button class="sa-action-btn" style="margin-left:6px;" onclick="StoryAssistant._cancelAction(this)">❌ 取消</button>';
    chatBox.appendChild(confirmDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  },

  _confirmAction(btn) {
    var actionStr = btn.getAttribute('data-action');
    try {
      var action = JSON.parse(actionStr);
      this._executeAction(action);
      this._appendMessage('system', '✅ 已执行：' + (this.ACTIONS[action.type]?.label || action.type));
    } catch(e) {
      this._appendMessage('system', '❌ 执行失败：' + e.message);
    }
    var row = btn.parentElement;
    if (row) row.remove();
  },

  _cancelAction(btn) {
    var row = btn.parentElement;
    if (row) row.remove();
    this._appendMessage('system', '已取消操作。');
  },

  // === 执行动作 ===
  _executeAction(action) {
    var type = action.type;
    var params = action.params || {};
    try {
      switch (type) {
        case 'choose':            this._actionChoose(params); break;
        case 'continue':          this._actionContinue(); break;
        case 'add_character':     this._actionAddCharacter(params); break;
        case 'modify_character':  this._actionModifyCharacter(params); break;
        case 'delete_character':  this._actionDeleteCharacter(params); break;
        case 'add_location':      this._actionAddLocation(params); break;
        case 'add_ability':       this._actionAddAbility(params); break;
        case 'add_item':          this._actionAddItem(params); break;
        case 'change_relation':   this._actionChangeRelation(params); break;
        case 'set_status':        this._actionSetStatus(params); break;
        case 'edit_world':        this._actionEditWorld(params); break;
        case 'use_item':          this._actionUseItem(params); break;
        case 'create_plot':       this._actionCreatePlot(params); break;
        default:                  console.warn('[StoryAssistant] 未知操作类型:', type);
      }
    } catch (e) {
      console.error('[StoryAssistant] 执行动作失败:', e);
      this._appendMessage('system', '❌ 执行失败：' + e.message);
    }
  },

  // ============================
  // 12 个动作实现
  // ============================

  // --- 帮我选 ---
  _actionChoose(params) {
    var choiceLabel = params.choice || params.index || params.label || '';
    if (!choiceLabel) {
      this._appendMessage('system', '⚠️ AI没有给出明确选择。');
      return;
    }
    var btns = document.querySelectorAll('.choice-btn');
    if (!btns.length) {
      this._appendMessage('system', '⚠️ 当前没有可选选项。');
      return;
    }
    var labels = 'ABCDEFGH'.split('');
    var targetIdx = -1;
    for (var i = 0; i < btns.length; i++) {
      if (labels[i] === choiceLabel.toUpperCase()) { targetIdx = i; break; }
    }
    if (targetIdx < 0) {
      for (var i = 0; i < btns.length; i++) {
        var btnText = btns[i].textContent || '';
        if (btnText.toLowerCase().includes(choiceLabel.toLowerCase())) { targetIdx = i; break; }
      }
    }
    if (targetIdx < 0 && !isNaN(parseInt(choiceLabel))) {
      targetIdx = parseInt(choiceLabel) - 1;
    }
    if (targetIdx >= 0 && targetIdx < btns.length) {
      btns[targetIdx].click();
      this._appendMessage('system', '✅ 已选择：' + btns[targetIdx].textContent.trim().slice(0, 40));
    } else {
      this._appendMessage('system', '⚠️ 无法匹配到选项 "' + choiceLabel + '"，请手动选择。');
    }
  },

  // --- 继续写 ---
  _actionContinue() {
    var gs = GameEngine.state;  // fix: 必须各自取 gs
    if (!gs.waitingForChoice) {
      this._appendMessage('system', '⚠️ 当前没有等待抉择，无法续写。');
      return;
    }
    var btns = document.querySelectorAll('.choice-btn');
    if (btns.length) {
      var recBtn = document.querySelector('.choice-btn.recommended');
      if (recBtn) { recBtn.click(); this._appendMessage('system', '✅ 已自动选择推荐选项续写。'); }
      else { btns[0].click(); this._appendMessage('system', '✅ 已自动选择第一个选项续写。'); }
    } else {
      this._appendMessage('system', '⚠️ 没有可选项。');
    }
  },

  // --- 新增人物 ---
  _actionAddCharacter(params) {
    var gs = GameEngine.state;
    if (!gs.characterBios) gs.characterBios = [];
    var wbData = WorldBuilder.getData();
    var name = params.name || '未命名角色';
    var bio = {
      id: 'cb_' + Date.now(),
      name: name,
      role: params.role || '',
      appearance: params.appearance || '',
      personality: params.personality || '',
      bg: params.background || params.bg || '',
      ability: params.ability || '',
      goal: params.goal || '',
      notes: params.notes || '',
      portrait: '',
      x: Math.random() * 600 + 50,
      y: Math.random() * 400 + 50
    };
    gs.characterBios.push(bio);
    wbData.characters.push({
      id: wbData._nextId++,
      name: name,
      role: params.role || '',
      appearance: params.appearance || '',
      personality: params.personality || '',
      background: params.background || params.bg || '',
      abilities: params.ability || '',
      level: params.level || ''
    });
    if (typeof CharacterBioManager !== 'undefined') {
      CharacterBioManager._syncFromPlayerRelations();
    }
    UIManager.updateAllStatus();
    this._appendMessage('system', '✅ 已新增人物：' + name + '（' + (params.role || '未设身份') + '）');
  },

  // --- 修改人物 ---
  _actionModifyCharacter(params) {
    var gs = GameEngine.state;
    var charName = params.name || params.target || '';
    if (!charName) {
      this._appendMessage('system', '⚠️ 未指定要修改的人物名。');
      return;
    }
    // 在 characterBios 中找
    var bio = null;
    for (var i = 0; i < (gs.characterBios || []).length; i++) {
      if (gs.characterBios[i].name === charName) { bio = gs.characterBios[i]; break; }
    }
    // 在世界构建器中也找
    var wbData = WorldBuilder.getData();
    var wbChar = null;
    for (var i = 0; i < (wbData.characters || []).length; i++) {
      if (wbData.characters[i].name === charName) { wbChar = wbData.characters[i]; break; }
    }
    if (!bio && !wbChar) {
      this._appendMessage('system', '⚠️ 找不到人物 "' + charName + '"。');
      return;
    }
    // 逐字段更新（只更新 params 中有的字段）
    var fields = { role: 'role', appearance: 'appearance', personality: 'personality', background: 'bg', ability: 'ability', goal: 'goal', notes: 'notes' };
    var changedList = [];
    for (var key in fields) {
      if (params[key]) {
        var targetField = fields[key];
        if (bio) bio[targetField] = params[key];
        // 世界构建器字段名可能不同
        if (wbChar) {
          var wbField = (key === 'background') ? 'background' : (key === 'ability') ? 'abilities' : key;
          wbChar[wbField] = params[key];
        }
        changedList.push(key + '→' + params[key].slice(0, 20));
      }
    }
    if (params.new_name) {
      if (bio) bio.name = params.new_name;
      if (wbChar) wbChar.name = params.new_name;
      changedList.push('name→' + params.new_name);
    }
    UIManager.updateAllStatus();
    this._appendMessage('system', '✅ 已修改人物 "' + charName + '"：' + changedList.join('、'));
  },

  // --- 删除人物 ---
  _actionDeleteCharacter(params) {
    var gs = GameEngine.state;
    var charName = params.name || params.target || '';
    if (!charName) {
      this._appendMessage('system', '⚠️ 未指定要删除的人物名。');
      return;
    }
    var found = false;
    gs.characterBios = (gs.characterBios || []).filter(function(b) {
      if (b.name === charName) { found = true; return false; }
      return true;
    });
    var wbData = WorldBuilder.getData();
    wbData.characters = (wbData.characters || []).filter(function(c) { return c.name !== charName; });
    // 也清除与该人物的关系
    gs.characterRelations = (gs.characterRelations || []).filter(function(r) {
      return r.from !== charName && r.to !== charName;
    });
    if (found) {
      UIManager.updateAllStatus();
      this._appendMessage('system', '✅ 已删除人物 "' + charName + '" 及其相关关系。');
    } else {
      this._appendMessage('system', '⚠️ 找不到人物 "' + charName + '"。');
    }
  },

  // --- 新增地点 ---
  _actionAddLocation(params) {
    var gs = GameEngine.state;
    var wbData = WorldBuilder.getData();
    var locName = params.name || '未命名地点';
    wbData.locations.push({
      id: wbData._nextId++,
      name: locName,
      type: params.type || '',
      description: params.description || params.desc || '',
      significance: params.significance || '',
      atmosphere: params.atmosphere || ''
    });
    if (gs.worldBuilderData) gs.worldBuilderData = wbData;
    this._appendMessage('system', '✅ 已新增地点：' + locName);
  },

  // --- 新增功法 ---
  _actionAddAbility(params) {
    var gs = GameEngine.state;
    var wbData = WorldBuilder.getData();
    var abName = params.name || '未命名功法';
    wbData.abilities.push({
      id: wbData._nextId++,
      name: abName,
      type: params.type || '',
      description: params.description || params.desc || '',
      effects: params.effects || '',
      requirements: params.requirements || ''
    });
    if (gs.worldBuilderData) gs.worldBuilderData = wbData;
    this._appendMessage('system', '✅ 已新增功法：' + abName);
  },

  // --- 加道具 ---
  _actionAddItem(params) {
    var gs = GameEngine.state;
    var p = gs.player;
    var itemName = params.name || '未命名道具';
    var qty = parseInt(params.qty || params.count || '1') || 1;
    var desc = params.description || params.desc || '';
    var result = InventorySystem.addItem(p, itemName, qty, desc);
    if (result.added) {
      if (result.stacked) {
        this._appendMessage('system', '✅ 道具 "' + result.item.name + '" 数量 +' + qty + '，现有 ' + result.item.qty);
      } else {
        this._appendMessage('system', '✅ 已获得道具：' + result.item.name + 'x' + qty);
      }
    } else {
      this._appendMessage('system', '⚠️ 添加道具失败：' + (result.reason || '未知错误'));
    }
    UIManager.updateAllStatus();
  },

  // --- 改关系 ---
  _actionChangeRelation(params) {
    var gs = GameEngine.state;
    if (!gs.characterRelations) gs.characterRelations = [];
    var from = params.from || params.char1 || '';
    var to = params.to || params.char2 || '';
    var change = parseInt(params.change || params.delta || '0') || 0;
    var desc = params.description || params.desc || '';
    if (!from || !to) {
      this._appendMessage('system', '⚠️ 需要指定两个角色名。');
      return;
    }
    // 查找已有关系
    var rel = null;
    for (var i = 0; i < gs.characterRelations.length; i++) {
      var r = gs.characterRelations[i];
      if ((r.from === from && r.to === to) || (r.from === to && r.to === from)) { rel = r; break; }
    }
    if (rel) {
      rel.value = (rel.value || 0) + change;
      if (desc) rel.desc = desc;
      this._appendMessage('system', '✅ ' + from + ' ↔ ' + to + ' 关系变化 ' + change + '，现为 ' + rel.value);
    } else {
      gs.characterRelations.push({ from: from, to: to, type: desc || '关系', value: change, desc: desc });
      this._appendMessage('system', '✅ 新建关系：' + from + ' ↔ ' + to + '（' + (desc || '关系') + '，值 ' + change + '）');
    }
    UIManager.updateAllStatus();
  },

  // --- 改状态 ---
  _actionSetStatus(params) {
    var gs = GameEngine.state;
    var p = gs.player;
    var changedList = [];
    if (params.health)  { p.health = params.health;  changedList.push('健康→' + params.health); }
    if (params.mood)    { p.mood = params.mood;      changedList.push('心情→' + params.mood); }
    if (params.level)   { var lv = parseInt(params.level); if (lv > 0) { p.level = lv; changedList.push('等级→' + lv); } }
    if (params.exp)     { p.exp = params.exp;         changedList.push('经验→' + params.exp); }
    if (params.rank)    { gs.rank = params.rank;     changedList.push('品阶→' + params.rank); }
    if (!changedList.length) {
      this._appendMessage('system', '⚠️ 未指定要修改的状态字段。');
      return;
    }
    UIManager.updateAllStatus();
    this._appendMessage('system', '✅ 已修改主角状态：' + changedList.join('、'));
  },

  // --- 消耗/使用道具 ---
  _actionUseItem(params) {
    var gs = GameEngine.state;
    var p = gs.player;
    if (!p.inventory || !p.inventory.bag || !p.inventory.bag.length) {
      this._appendMessage('system', '⚠️ 背包中没有道具。');
      return;
    }
    var itemName = params.name || params.item || '';
    var qty = parseInt(params.qty || params.count || '1') || 1;
    if (!itemName) {
      // 列出可用道具
      var itemList = p.inventory.bag.filter(function(i) { return i.qty > 0; }).map(function(i) { return i.name + 'x' + i.qty; }).join('、');
      this._appendMessage('system', '⚠️ 未指定道具名。当前背包：' + (itemList || '空'));
      return;
    }
    var result = InventorySystem.removeItem(p, itemName, qty);
    if (!result.removed) {
      this._appendMessage('system', '⚠️ 背包中没有道具 "' + itemName + '"。');
      return;
    }
    var remaining = result.consumed ? 0 : result.item.qty;
    this._appendMessage('system', '✅ 已消耗道具：' + itemName + ' x' + qty + '（剩余 ' + remaining + '）');
    UIManager.updateAllStatus();
  },

  // --- 创造/设计剧情 ---
  _actionCreatePlot(params) {
    var gs = GameEngine.state;
    var plotTitle = params.title || params.topic || params.plot || '';
    var plotContent = params.content || params.description || params.detail || '';
    var plotType = params.type || params.plot_type || '';

    if (!plotContent && !plotTitle) {
      this._appendMessage('system', '⚠️ AI未能生成具体的剧情内容。请更具体地描述你的需求。');
      return;
    }

    // 将设计的剧情摘要存入状态，以便注入到下一个 prompt
    if (!gs.plotSuggestions) gs.plotSuggestions = [];
    gs.plotSuggestions.push({
      time: new Date().toISOString(),
      title: plotTitle || 'AI建议剧情',
      content: plotContent,
      type: plotType,
      used: false
    });

    // 保留最近 5 条
    if (gs.plotSuggestions.length > 5) {
      gs.plotSuggestions = gs.plotSuggestions.slice(-5);
    }

    this._appendMessage('system', '✅ 已生成剧情建议！系统将在下一段叙事中参考此方向。\n' +
      (plotTitle ? '【' + plotTitle + '】\n' : '') + (plotContent ? plotContent.slice(0, 100) + '...' : ''));
  },

  // --- 改世界观 ---
  _actionEditWorld(params) {
    var gs = GameEngine.state;
    var changedList = [];
    if (params.world_desc)    { gs.worldDesc = params.world_desc;       changedList.push('世界观概述'); }
    if (params.era)           { gs.era = params.era;                    changedList.push('时代→' + params.era); }
    if (params.genre)         { gs.genre = params.genre;               changedList.push('题材→' + params.genre); }
    if (params.factions)      { gs.factions = params.factions;          changedList.push('势力'); }
    if (params.power_system)  { gs.powerSystem = params.power_system;   changedList.push('能力体系'); }
    // 同步到 localStorage setup-data
    var setupData = JSON.parse(localStorage.getItem('setup-data') || '{}');
    if (params.world_desc)    setupData.world_desc = params.world_desc;
    if (params.era)           setupData.era = params.era;
    if (params.genre)         setupData.genre = params.genre;
    if (params.factions)      setupData.factions = params.factions;
    if (params.power_system)  setupData.power_system = params.power_system;
    localStorage.setItem('setup-data', JSON.stringify(setupData));
    UIManager.updateAllStatus();
    this._appendMessage('system', '✅ 已更新世界观：' + changedList.join('、'));
  },

  // ============================
  // AI 上下文构建（含 12 种操控指令）
  // ============================
  _buildContext(intent) {
    var gs = GameEngine.state;
    var p = gs.player;
    var ctx = '你是命运之书游戏的AI助手，兼具"回答问题"和"操控游戏"的能力。\n你可以通过 [ACTION]{JSON}[/ACTION] 标签执行游戏操作。\n\n';

    ctx += '【当前游戏状态】\n';
    ctx += '世界：' + (gs.worldName || '未知') + ' | 类型：' + (gs.genre || '未知') + '\n';
    ctx += '主角：' + (p.name || '未知') + '，' + (p.sex || '') + '，' + (p.age || '?') + '岁\n';
    ctx += '章节：第' + (gs.chapter || 1) + '章·第' + (gs.scene || 1) + '节 | 天数：第' + (gs.days || 1) + '天\n';
    ctx += '健康：' + (p.health || '未知') + ' | 心情：' + (p.mood || '未知') + ' | 等级：' + (p.level || 1) + '\n';
    if (p.skills && p.skills.length) ctx += '技能：' + p.skills.map(function(s){ return s.name; }).join('、') + '\n';
    if (p.items && p.items.length) {
      var itemNames = p.items.filter(function(i){ return i.qty > 0; }).map(function(i){ return i.name + 'x' + i.qty; }).join('、');
      if (itemNames) ctx += '物品：' + itemNames + '\n';
    }

    // 当前选项
    var btns = document.querySelectorAll('.choice-btn');
    if (btns.length && gs.waitingForChoice) {
      ctx += '\n【当前可选选项】\n';
      var labels = 'ABCDEFGH'.split('');
      for (var i = 0; i < btns.length; i++) {
        var text = btns[i].textContent || '';
        text = text.replace(/^[🎯⚠️🔥💀💡❓✨]/, '').trim();
        ctx += labels[i] + '. ' + text.trim() + '\n';
      }
    }

    // 世界观
    if (gs.worldDesc) ctx += '\n【世界观】\n' + gs.worldDesc.slice(0, 500) + '\n';
    if (gs.era) ctx += '时代：' + gs.era + '\n';
    var wbData = WorldBuilder.getData();
    if (wbData.locations && wbData.locations.length) {
      ctx += '\n【已知地点】\n';
      wbData.locations.forEach(function(loc) { ctx += loc.name + '：' + (loc.description || '').slice(0, 80) + '\n'; });
    }
    if (wbData.abilities && wbData.abilities.length) {
      ctx += '\n【已知功法】\n';
      wbData.abilities.forEach(function(ab) { ctx += ab.name + '：' + (ab.description || '').slice(0, 80) + '\n'; });
    }
    if (wbData.characters && wbData.characters.length) {
      ctx += '\n【已知人物】\n';
      wbData.characters.forEach(function(ch) { ctx += ch.name + '（' + (ch.role || '未知') + '）\n'; });
    }

    // 人物关系
    if (gs.characterRelations && gs.characterRelations.length) {
      ctx += '\n【人物关系】\n';
      gs.characterRelations.forEach(function(r) { ctx += r.from + ' ↔ ' + r.to + '（' + (r.type || r.desc || '') + '，值 ' + (r.value || 0) + '）\n'; });
    }

    // 最近剧情
    var summaries = gs.chapterSummaries || [];
    if (summaries.length) {
      ctx += '\n【最近剧情】\n';
      summaries.slice(-3).forEach(function(s) { ctx += '第' + s.chapter + '章：' + (s.summary || '') + '\n'; });
    }
    var storyLog = gs.storyLog || '';
    if (storyLog.length) ctx += '\n【最近文本】\n' + storyLog.slice(-1500) + '\n';

    // 根据意图给出操控指令
    ctx += '\n【你的操控能力——选择对应的指令格式】\n';
    var actionFormats = {
      choose: [
        '帮我选：分析主角性格和当前处境，选最合理的选项。',
        '格式：[ACTION]{"type":"choose","params":{"choice":"A"}}[/ACTION]',
        'choice 用选项字母 A/B/C/D。示例：{"type":"choose","params":{"choice":"B"}}'
      ],
      continue: [
        '续写：自动推进剧情。',
        '格式：[ACTION]{"type":"continue","params":{}}[/ACTION]'
      ],
      add_character: [
        '加人物：设计新角色并加入世界。',
        '格式：[ACTION]{"type":"add_character","params":{"name":"林婉清","role":"药师","appearance":"青衣素袍","personality":"温柔","background":"医术世家"}}[/ACTION]',
        '至少包含 name 和 role。'
      ],
      modify_character: [
        '改人物：修改已有角色的设定。',
        '格式：[ACTION]{"type":"modify_character","params":{"name":"林婉清","role":"药王谷主","personality":"表面温柔实则腹黑"}}[/ACTION]',
        '只写需要修改的字段。'
      ],
      delete_character: [
        '删人物：删除角色。',
        '格式：[ACTION]{"type":"delete_character","params":{"name":"张三"}}[/ACTION]'
      ],
      add_location: [
        '加地点：新增一个地点。',
        '格式：[ACTION]{"type":"add_location","params":{"name":"幽冥谷","type":"秘境","description":"终年雾霭弥漫"}}[/ACTION]'
      ],
      add_ability: [
        '加功法：设计新功法。',
        '格式：[ACTION]{"type":"add_ability","params":{"name":"太虚剑诀","type":"剑法","description":"以意御剑"}}[/ACTION]'
      ],
      add_item: [
        '加道具：给主角新道具。',
        '格式：[ACTION]{"type":"add_item","params":{"name":"回春丹","qty":3,"description":"恢复伤势"}}[/ACTION]'
      ],
      change_relation: [
        '改关系：改变两个角色的关系。',
        '格式：[ACTION]{"type":"change_relation","params":{"from":"陈墨","to":"林婉清","change":10,"description":"救命之恩"}}[/ACTION]'
      ],
      set_status: [
        '改状态：修改主角属性。',
        '格式：[ACTION]{"type":"set_status","params":{"health":"轻伤","mood":"愤怒"}}[/ACTION]',
        '只写需要修改的字段。'
      ],
      edit_world: [
        '改设定：修改世界观。',
        '格式：[ACTION]{"type":"edit_world","params":{"era":"战国末期","genre":"仙侠"}}[/ACTION]'
      ],
      use_item: [
        '消耗道具：使用背包中的道具。必须核对【物品】列表中的真实道具名和数量。',
        '格式：[ACTION]{"type":"use_item","params":{"name":"回春丹","qty":1}}[/ACTION]',
        'qty 默认1。减少后数量不能为负。如果背包没有该道具则改为 add_item 或 chat。'
      ],
      create_plot: [
        '创剧情：设计剧情走向。',
        '格式：[ACTION]{"type":"create_plot","params":{"title":"暗流涌动","content":"林婉清暗中勾结外敌，陈墨面临信任危机——需要在三天内找出证据阻止阴谋","type":"转折"}}[/ACTION]',
        'type 可选：转折/冲突/发展/高潮/铺垫。'
      ],
      chat: [
        '纯问答：不执行操作，只回答问题。',
        '回答简洁，基于已有剧情推断，不要编造。不要输出 ACTION 标签。'
      ]
    };
    var guide = actionFormats[intent] || actionFormats.chat;
    ctx += guide.join('\n') + '\n';

    ctx += '\n【通用规则——必须严格遵守】\n';
    ctx += '1. 你的回复分两部分：先说一句话（简洁、沉浸），然后单独一行输出 [ACTION] 标签\n';
    ctx += '2. [ACTION] 标签里的 JSON 必须在一行内，不要换行。示例格式：\n';
    ctx += '   [ACTION]{"type":"use_item","params":{"name":"丹药","qty":1}}[/ACTION]\n';
    ctx += '3. 参数值必须填写具体内容，禁止保留占位符（如"角色名""道具名"）\n';
    ctx += '4. 如果是纯问答（intent=chat），不要输出 [ACTION] 标签\n';
    ctx += '5. 如果意图是操控游戏（intent 不是 chat），必须在回复末尾输出 [ACTION] 标签\n';

    return ctx;
  },

  // ============================
  // UI 辅助
  // ============================
  _appendMessage(role, content) {
    var chatBox = document.getElementById('sa-chat');
    if (!chatBox) return;
    var msg = document.createElement('div');
    msg.className = 'sa-msg sa-msg-' + role;
    if (role === 'user') {
      msg.innerHTML = '<div class="sa-msg-bubble">' + this._escapeHTML(content) + '</div>';
    } else if (role === 'assistant') {
      msg.innerHTML = '<div class="sa-msg-avatar">AI</div><div class="sa-msg-bubble">' + this._escapeHTML(content) + '</div>';
    } else {
      msg.innerHTML = '<div class="sa-msg-system">' + this._escapeHTML(content) + '</div>';
    }
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  },

  _showTyping() {
    var chatBox = document.getElementById('sa-chat');
    if (!chatBox) return;
    var typing = document.createElement('div');
    typing.className = 'sa-msg sa-msg-assistant sa-typing';
    typing.id = 'sa-typing-indicator';
    typing.innerHTML = '<div class="sa-msg-avatar">AI</div><div class="sa-msg-bubble sa-bubble-typing">思考中…</div>';
    chatBox.appendChild(typing);
    chatBox.scrollTop = chatBox.scrollHeight;
  },

  _hideTyping() {
    var typing = document.getElementById('sa-typing-indicator');
    if (typing) typing.remove();
  },

  _escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  clearHistory() {
    this._history = [];
    var chatBox = document.getElementById('sa-chat');
    if (chatBox) {
      chatBox.innerHTML = '<div class="sa-welcome">可以提问，也可以操控游戏。<br>点击上方按钮快速执行，或直接输入指令。<br><small>支持：帮我选/续写/+人物/+地点/+功法/+道具/改关系/改状态/改设定</small></div>';
    }
  },

  restore(data) {
    // 助手对话不存档
  }
};
window.StoryAssistant = StoryAssistant;

