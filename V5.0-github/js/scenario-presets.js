// ============================
// SCENARIO PRESETS — 剧本规则预设
// v3.5 新增，开局可选世界观模板，注入 AI 提示词
// ============================
var ScenarioPresets = {
  // 预设模板库
  _presets: [
    {
      id: 'hardcore-cultivation',
      name: '残酷修仙',
      icon: '⚔️',
      desc: '修真界弱肉强食，杀人夺宝是常态。主角从底层蝼蚁开始，在阴谋与杀机中求生存。资源匮乏，天劫无情，每个境界都可能葬送性命。',
      tags: ['修仙', '残酷', '成长'],
      rules: [
        '修仙界遵循弱肉强食法则，杀人与被杀都是常态',
        '突破境界有极高失败率，失败者轻则重伤重则走火入魔',
        '修炼资源极度稀缺，为了一株灵草可以引发宗门大战',
        '天道无情，天劫降临时不分善恶',
        '势力倾轧，师徒反目、同门相残时有发生',
        '主角从最底层开始，没有任何金手指或逆天背景'
      ]
    },
    {
      id: 'academy-magic',
      name: '学院魔法',
      icon: '🎓',
      desc: '魔法学院体系完善，学生从初级开始学习。有考试、社团、竞赛，隐藏着古老的秘密和阴谋。偏轻松但暗流涌动。',
      tags: ['魔法', '学院', '冒险'],
      rules: [
        '魔法学院有完整的分班、升级、考试体系',
        '每个学生都有独特的魔法天赋或属性亲和',
        '学院隐藏着千年前的秘密，表面平静实则暗流涌动',
        '有社团、竞赛、学院杯等校园活动',
        '教授们各怀心事，有人守护秘密，有人觊觎宝藏',
        '主角在学习和冒险中逐渐揭开学院真相'
      ]
    },
    {
      id: 'apocalypse-survival',
      name: '末日求生',
      icon: '☠️',
      desc: '文明崩塌后的世界。丧尸/变异体横行，资源枯竭，幸存者为了一瓶水和子弹拼命。信任是奢侈品，背叛是常态。',
      tags: ['末日', '生存', '废土'],
      rules: [
        '文明已经崩塌，政府/军队/警察系统完全失效',
        '丧尸/变异体无处不在，夜晚尤其危险',
        '食物、水、药品、弹药是最珍贵的硬通货',
        '幸存者营地内部也存在背叛和权力斗争',
        '主角需要在生存压力下做出道德困境的抉择',
        '每章/节推进时，天气、季节会变化，影响生存难度'
      ]
    },
    {
      id: 'thriller-detective',
      name: '悬疑探案',
      icon: '🔍',
      desc: '都市背景下的悬疑故事。每个案件背后都有更深层的秘密，线索环环相扣，真相往往出人意料。注重逻辑推理。',
      tags: ['悬疑', '推理', '都市'],
      rules: [
        '每个案件至少有3层真相：表面线索→隐藏动机→终极秘密',
        '所有关键线索必须在早期铺垫，不允许突然出现',
        '人物关系复杂，每个人都有秘密和说谎的理由',
        '注重逻辑推理，不允许超自然力量作为解谜手段',
        '每个选择都可能影响证据走向和嫌疑人的可信度',
        '主角作为侦探/调查者，有专业技能但也会犯错'
      ]
    },
    {
      id: 'ancient-politics',
      name: '权谋天下',
      icon: '🏯',
      desc: '古代宫廷/朝廷的权谋博弈。没有绝对的善恶，只有利益和生存。一步走错满盘皆输，胜者为王。',
      tags: ['权谋', '历史', '宫廷'],
      rules: [
        '朝廷中派系林立，每个官员都有背后的势力支撑',
        '皇帝的信任是最珍贵的资源，也是最危险的陷阱',
        '联姻、结盟、背叛是日常政治手段',
        '军事力量是政治博弈的最终底牌',
        '文人以笔为刀，一首诗可能改变朝堂格局',
        '主角需要在忠诚与生存之间不断做出艰难抉择'
      ]
    },
    {
      id: 'urban-romance',
      name: '都市情缘',
      icon: '💕',
      desc: '现代都市中的爱情故事。注重人物关系的细腻刻画，误会与和解交替，在平凡生活中寻找温暖。',
      tags: ['都市', '恋爱', '日常'],
      rules: [
        '故事发生在现代都市，人物有真实的职业和生活',
        '感情发展自然渐进，禁止突然表白或一见钟情',
        '每个角色都有独立的性格、职业、社交圈',
        '注重日常细节：咖啡、天气、通勤、加班',
        '误会不是靠"第三天就解释清楚了"，需要真实的时间成本',
        '配角有自己的感情线和成长轨迹'
      ]
    },
    {
      id: 'gaming-isekai',
      name: '游戏异界',
      icon: '🎮',
      desc: '穿越到游戏世界，有等级系统、副本、技能树。主角利用游戏知识，但这个世界不完全遵循游戏规则。',
      tags: ['穿越', '游戏', '冒险'],
      rules: [
        '世界有明确的等级系统、技能树、装备品质划分',
        'NPC有自己的意识和情感，不是简单的任务发布器',
        '某些游戏机制在这个世界不完全成立，存在"bug"',
        '副本/迷宫/BOSS需要策略而非纯数值碾压',
        '有玩家和NPC两个群体，社会矛盾由此产生',
        '主角有前世游戏经验，但实战经验从零开始'
      ]
    },
    {
      id: 'custom',
      name: '自定义规则',
      icon: '✏️',
      desc: '不使用预设规则，手动输入你想要的剧情规则。完全自由定制。',
      tags: ['自定义', '自由'],
      rules: []
    }
  ],

  _selected: null,
  _customRules: [],

  // 获取所有预设
  getAll() {
    return this._presets;
  },

  // 获取选中的预设
  getSelected() {
    return this._selected ? this._presets.find(p => p.id === this._selected) : null;
  },

  // 获取当前规则列表（含自定义）
  getRules() {
    const preset = this.getSelected();
    if (!preset) return [];
    if (preset.id === 'custom') return this._customRules;
    return preset.rules;
  },

  // 获取规则提示词（用于注入 AI）
  getPromptInjection() {
    const rules = this.getRules();
    if (rules.length === 0) return '';
    const preset = this.getSelected();
    let prompt = `\n\n【剧本规则预设：${preset ? preset.name : '自定义'}】\n`;
    prompt += `以下规则在整个故事中必须严格遵守，不可违背：\n`;
    rules.forEach((r, i) => {
      prompt += `${i + 1}. ${r}\n`;
    });
    prompt += `\n以上规则是此故事的底层逻辑，即使主角的处境发生变化，规则本身也不可改变。\n`;
    return prompt;
  },

  // 选择预设
  select(id) {
    this._selected = id;
    // 更新UI
    document.querySelectorAll('.sp-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.id === id);
    });
    // 如果选了自定义，显示自定义输入区
    const customArea = document.getElementById('sp-custom-area');
    if (customArea) {
      customArea.style.display = id === 'custom' ? 'block' : 'none';
    }
    // 更新预览
    this._updatePreview();
  },

  // 添加自定义规则
  addCustomRule(rule) {
    if (!rule.trim()) return;
    this._customRules.push(rule.trim());
    this._renderCustomRules();
    this._updatePreview();
  },

  // 删除自定义规则
  removeCustomRule(index) {
    this._customRules.splice(index, 1);
    this._renderCustomRules();
    this._updatePreview();
  },

  // 渲染自定义规则列表
  _renderCustomRules() {
    const container = document.getElementById('sp-custom-rules');
    if (!container) return;
    container.innerHTML = this._customRules.map((r, i) => `
      <div class="sp-custom-rule">
        <span>${this._escapeHTML(r)}</span>
        <button class="sp-rule-del" onclick="ScenarioPresets.removeCustomRule(${i})" title="删除">×</button>
      </div>
    `).join('');
  },

  // 更新规则预览
  _updatePreview() {
    const preview = document.getElementById('sp-preview');
    if (!preview) return;
    const rules = this.getRules();
    if (rules.length === 0) {
      preview.innerHTML = '<span style="color:var(--text-dim);">选择预设或自定义规则后，这里会显示预览</span>';
      return;
    }
    preview.innerHTML = rules.map((r, i) =>
      `<div class="sp-preview-rule"><span class="sp-rule-num">${i + 1}</span>${this._escapeHTML(r)}</div>`
    ).join('');
  },

  // 渲染预设选择面板
  renderGrid() {
    const grid = document.getElementById('sp-grid');
    if (!grid) return;
    grid.innerHTML = this._presets.map(p => `
      <div class="sp-card" data-id="${p.id}" onclick="ScenarioPresets.select('${p.id}')">
        <div class="sp-card-icon">${p.icon}</div>
        <div class="sp-card-name">${p.name}</div>
        <div class="sp-card-tags">${p.tags.map(t => `<span class="sp-tag">${t}</span>`).join('')}</div>
        <div class="sp-card-desc">${this._escapeHTML(p.desc)}</div>
      </div>
    `).join('');
  },

  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  // 从存档恢复
  restore(data) {
    if (data && data.scenarioPreset) {
      this._selected = data.scenarioPreset.id || null;
      this._customRules = data.scenarioPreset.customRules || [];
    }
  },

  // 序列化保存
  serialize() {
    if (!this._selected) return null;
    return {
      id: this._selected,
      customRules: this._selected === 'custom' ? this._customRules : []
    };
  },

  // 确认并关闭
  confirm() {
    const preset = this.getSelected();
    if (!preset) {
      // 没选也可以，只是没有额外规则
      return;
    }
  }
};
window.ScenarioPresets = ScenarioPresets;
