// ============================
// LIVE CONTEXT ENGINE
// 实时节奏引擎：每次抉择时综合读取 4 大系统状态，
// 动态计算出当前故事节拍，输出一段 AI 可直接执行的节奏指令。
// ============================

var LiveContext = {

  /**
   * 主入口：生成完整的实时上下文指令
   * 在 game-engine._fetchStory 的 payload 中调用
   * @returns {string} 格式化的实时上下文文本
   */
  generate() {
    const gs = GameEngine.state;
    const p = gs.player || {};

    // ---- 1. 读取四大系统 ----
    const chars  = this._readCharacters(gs);
    const items  = this._readInventory(p);
    const plot   = this._readPlotPlan(gs);
    const foresh = this._readForeshadowing();

    // ---- 2. 计算节拍 ----
    const beat = this._computeBeat(chars, items, plot, foresh, gs);

    // ---- 3. 组装输出 ----
    return this._format(beat, chars, items, plot, foresh);
  },

  // ========================================================
  //  系统读取器
  // ========================================================

  _readCharacters(gs) {
    const bios = gs.characterBios || [];
    const rels = gs.characterRelations || [];
    const appeared = bios.filter(c => c.hasAppeared);
    const protagonist = bios.find(c => c.role === 'protagonist');
    const antagonists = bios.filter(c => c.role === 'antagonist' && c.hasAppeared);
    const allies = bios.filter(c => c.role === 'ally' && c.hasAppeared);
    const activeRels = rels.filter(r => {
      const f = bios.find(c => c.id === r.from);
      const t = bios.find(c => c.id === r.to);
      return f && t && (f.hasAppeared || t.hasAppeared);
    });

    return {
      total: bios.length,
      appeared: appeared.length,
      hasProtagonist: !!protagonist,
      antagonistCount: antagonists.length,
      allyCount: allies.length,
      relationCount: activeRels.length,
      // 变化感知：最近出场的人物
      recentAppeared: appeared.filter(c => c.notes && c.notes.includes('AI新增')),
      // 关系紧张度（对手关系越多越紧张）
      tensionRels: activeRels.filter(r => /敌|仇|对手|对抗|暗算|怀疑/.test(r.type || '')),
      // 关系支持度（盟友关系）
      supportRels: activeRels.filter(r => /友|盟|师|亲|恋|信/.test(r.type || '')),
    };
  },

  _readInventory(playerState) {
    const inv = playerState.inventory;
    if (!inv) return { totalItems: 0, categories: {}, keyItems: [], hasWeapon: false, consumableCount: 0 };

    const bag = inv.bag || [];
    const equipped = inv.equipped || {};
    const categories = {};
    const keyItems = [];
    let consumableCount = 0;
    let hasWeapon = false;

    for (const it of bag) {
      const cat = it.category || 'misc';
      if (!categories[cat]) categories[cat] = 0;
      categories[cat]++;
      if (cat === 'key') keyItems.push(it.name);
      if (cat === 'consumable') consumableCount += it.qty || 1;
      if (cat === 'weapon') hasWeapon = true;
    }
    for (const item of Object.values(equipped)) {
      if (item && item.category === 'weapon') hasWeapon = true;
    }

    return {
      totalItems: bag.length,
      categories,
      keyItems,           // 关键道具名列表
      hasWeapon,
      consumableCount,
      equippedCount: Object.keys(equipped).length,
    };
  },

  _readPlotPlan(gs) {
    const pp = gs.plotPlan;
    if (!pp || !pp.enabled || !pp.phases || !pp.phases.length) {
      return { enabled: false };
    }

    const currentIdx = pp.currentPhaseIdx || 0;
    const phase = pp.phases[currentIdx];
    const totalWords = pp.totalWords || 0;
    const totalWritten = pp.totalWordsWritten || 0;
    const totalPct = totalWords > 0 ? Math.round(totalWritten / totalWords * 100) : 0;
    const phaseBudget = phase ? phase.wordBudget : 0;
    const phaseWritten = phase ? phase.wordsWritten : 0;
    const phasePct = phaseBudget > 0 ? Math.round(phaseWritten / phaseBudget * 100) : 0;
    const phaseRemaining = Math.max(0, phaseBudget - phaseWritten);
    const wordsPerResponse = Math.max(300, Math.min(1500, Math.round(phaseRemaining * 0.15)));

    // 判断阶段位置
    const isEarly = currentIdx === 0;
    const isMiddle = currentIdx > 0 && currentIdx < pp.phases.length - 1;
    const isFinal = currentIdx === pp.phases.length - 1;
    const isNearEnd = phasePct >= 70;
    const isAlmostDone = phasePct >= 90;

    return {
      enabled: true,
      phaseName: phase ? phase.name : '未设定',
      phaseDesc: phase ? phase.desc : '',
      phaseIdx: currentIdx,
      totalPhases: pp.phases.length,
      phasePct,
      totalPct,
      wordsPerResponse,
      isEarly,
      isMiddle,
      isFinal,
      isNearEnd,
      isAlmostDone,
      phaseRemaining,
      // 下一个阶段信息（用于过渡）
      nextPhase: (currentIdx < pp.phases.length - 1) ? pp.phases[currentIdx + 1] : null,
    };
  },

  _readForeshadowing() {
    const gs = (typeof GameEngine !== 'undefined' && GameEngine.state) ? GameEngine.state : {};
    const list = gs.foreshadows || [];
    const unresolvedCount = list.filter(f => f.status === 'pending').length;
    if (typeof Foreshadowing === 'undefined') {
      return {
        active: !!gs._foreshadowActive,
        pending: !!gs._foreshadowActive && !gs._foreshadowArmed,
        firing: !!gs._foreshadowArmed,
        historyCount: list.length,
        unresolvedCount: unresolvedCount,
      };
    }
    return {
      active: Foreshadowing._active || !!gs._foreshadowActive,
      pending: (Foreshadowing._active && !Foreshadowing._used) || (!!gs._foreshadowActive && !gs._foreshadowArmed),
      firing: (Foreshadowing._active && Foreshadowing._used) || !!gs._foreshadowArmed,
      historyCount: list.length,
      unresolvedCount: unresolvedCount,
    };
  },

  // ========================================================
  //  节拍计算器 —— 核心逻辑
  // ========================================================

  _computeBeat(chars, items, plot, foresh, gs) {
    const beat = {
      // 节拍类型：exposition | rising | tension | climax | cooldown | resolution
      type: 'rising',
      // 叙事密度：1-5（1=舒缓描写 5=高密动作）
      density: 3,
      // 建议字数范围
      wordRange: [500, 1000],
      // 节奏指令（给 AI 的具体指导）
      directives: [],
      // 内容约束
      constraints: [],
    };

    // --- 根据剧情阶段确定基础节拍 ---
    if (plot.enabled) {
      if (plot.isEarly) {
        beat.type = 'exposition';
        beat.density = 2;
        beat.wordRange = [500, 1000];
        beat.directives.push('节奏舒缓：重在描绘环境、人物性格和世界观细节');
      } else if (plot.isMiddle && !plot.isNearEnd) {
        beat.type = 'rising';
        beat.density = 3;
        beat.wordRange = [500, 1200];
        beat.directives.push('节奏递进：逐步揭示矛盾，让冲突层层升级');
      } else if (plot.isMiddle && plot.isNearEnd) {
        beat.type = 'tension';
        beat.density = 4;
        beat.wordRange = [600, 1300];
        beat.directives.push('节奏加速：矛盾即将爆发，减少过渡描写，增加冲突场景');
      } else if (plot.isFinal && !plot.isAlmostDone) {
        beat.type = 'climax';
        beat.density = 5;
        beat.wordRange = [800, 1500];
        beat.directives.push('高潮节拍：矛盾全面爆发，动作和冲突为主，不给读者喘息空间');
      } else if (plot.isFinal && plot.isAlmostDone) {
        beat.type = 'resolution';
        beat.density = 2;
        beat.wordRange = [300, 800];
        beat.directives.push('收束节拍：逐步解决主线冲突，留余韵和留白，不急收尾');
      }

      // 字数建议根据剩余量调整
      beat.wordRange[1] = Math.min(beat.wordRange[1], plot.wordsPerResponse + 300);
      beat.wordRange[0] = Math.max(300, plot.wordsPerResponse - 200);
    }

    // --- 人物关系修正 ---
    if (chars.tensionRels.length > chars.supportRels.length) {
      // 敌对关系 > 盟友关系 → 提升紧张度
      beat.density = Math.min(5, beat.density + 1);
      beat.directives.push('人际张力：当前敌对关系多于盟友，剧情应体现这种压力和危机感');
    } else if (chars.supportRels.length > 2 && chars.tensionRels.length === 0) {
      // 太安逸了 → 需要引入冲突
      beat.directives.push('安逸警告：人际关系过于和谐，考虑引入新的矛盾或意外来打破平衡');
    }

    if (chars.antagonistCount > 0 && beat.density < 4 && plot.enabled && !plot.isEarly) {
      beat.density = Math.min(5, beat.density + 1);
      beat.directives.push('反派已现身：对手/反派已经登场，提高叙事紧迫感');
    }

    // 新人物刚出场 → 需要花笔墨介绍
    if (chars.recentAppeared.length > 0) {
      beat.directives.push(`新面孔：${chars.recentAppeared.map(c => c.name).join('、')}刚出场，需要用交互和描写来丰满形象`);
      beat.wordRange[1] += 200; // 多给点字数写人物
    }

    // --- 道具修正 ---
    if (items.keyItems.length > 0) {
      beat.constraints.push(`关键道具提醒：${items.keyItems.join('、')}是重要剧情元素，适时在叙事中体现它们的存在和影响`);
    }

    if (!items.hasWeapon && chars.antagonistCount > 0) {
      beat.constraints.push('生存压力：主角没有武器但面对威胁，剧情应体现这种无力感或求生本能');
    }

    if (items.consumableCount <= 1 && beat.density >= 4) {
      beat.constraints.push('资源紧张：消耗品匮乏，在高强度叙事中注意体现资源的珍贵');
    }

    // --- 伏笔修正 ---
    if (foresh.firing) {
      // 伏笔正在生成 → 不额外加指令（Foreshadowing.getPromptInjection 已处理）
      beat.directives.push('伏笔生成中：本段需要自然地埋设伏笔');
    } else if (foresh.unresolvedCount >= 3) {
      // 积累了 3+ 未回收伏笔 → 建议回收
      beat.directives.push(`伏笔回收：已有${foresh.unresolvedCount}条未回收伏笔，考虑在适当时机揭示一条，但不要强行回收`);
      beat.density = Math.max(beat.density - 1, 2); // 回收伏笔需要空间，稍微降密
    }

    // --- 综合安全网 ---
    beat.wordRange[0] = Math.max(300, beat.wordRange[0]);
    beat.wordRange[1] = Math.min(1500, beat.wordRange[1]);

    return beat;
  },

  // ========================================================
  //  格式化输出
  // ========================================================

  _format(beat, chars, items, plot, foresh) {
    const lines = [];

    // --- 主指令块 ---
    const typeNames = {
      exposition: '铺陈', rising: '升温', tension: '紧绷',
      climax: '高潮', cooldown: '喘息', resolution: '收束',
    };
    const densityNames = { 1: '极缓', 2: '舒缓', 3: '适中', 4: '紧张', 5: '极紧' };

    lines.push(`【实时节拍——${typeNames[beat.type] || beat.type}】`);
    lines.push(`叙事密度：${'■'.repeat(beat.density)}${'□'.repeat(5 - beat.density)} ${densityNames[beat.density] || '适中'}`);
    lines.push(`建议字数：${beat.wordRange[0]}-${beat.wordRange[1]}字`);

    // 剧情阶段信息
    if (plot.enabled) {
      lines.push(``);
      lines.push(`阶段进度：${plot.phaseName}（${plot.phasePct}%完成）| 总进度 ${plot.totalPct}%`);
      if (plot.isNearEnd && plot.nextPhase) {
        lines.push(`即将过渡 →「${plot.nextPhase.name}」：请在1-2段内自然过渡，不要突兀跳转`);
      }
    }

    // 节奏指令
    if (beat.directives.length) {
      lines.push(``);
      lines.push(`节奏指令：`);
      beat.directives.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
    }

    // 内容约束
    if (beat.constraints.length) {
      lines.push(``);
      lines.push(`叙事约束：`);
      beat.constraints.forEach((c, i) => lines.push(`  • ${c}`));
    }

    // 人物态势
    if (chars.appeared > 0) {
      lines.push(``);
      lines.push(`人物态势：${chars.appeared}人已登场 | 敌对${chars.tensionRels.length}条 / 盟友${chars.supportRels.length}条`);
    }

    // 道具态势
    if (items.totalItems > 0) {
      lines.push(`道具态势：${items.totalItems}件物品 | 装备${items.equippedCount}件 | 消耗品${items.consumableCount}个`);
    }

    // 伏笔态势
    if (foresh.active || foresh.unresolvedCount > 0) {
      lines.push(`伏笔态势：${foresh.unresolvedCount}条待回收`);
    }

    lines.push(``);
    lines.push(`⚠ 以上节拍由系统实时计算，请据此调整本段的叙事节奏、篇幅和内容侧重。`);

    return lines.join('\n');
  },
};
// ── 确保 LiveContext 在 onclick 中可访问（const 不挂 window）──
window.LiveContext = LiveContext;
