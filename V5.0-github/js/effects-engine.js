// ============================
// EFFECTS ENGINE - 本地效果规则引擎
// 取代AI生成属性增减的复杂格式，由本地规则管理
// ============================
var EffectsEngine = {
  // ========== 效果模板 ==========
  // key: 标签名（AI在选项后附加的type字段）
  // value: 标准化效果集
  TEMPLATES: {
    // --- 战斗类 ---
    combat_win: {
      exp: 30, mood: '兴奋',
      stats: { strength: 1, constitution: 1, agility: 0 },
      label: '战斗胜利，属性略有提升'
    },
    combat_draw: {
      exp: 20, mood: '专注',
      stats: { strength: 0, constitution: 0 },
      label: '势均力敌，略有感悟'
    },
    combat_loss: {
      exp: 10, health: '轻伤', mood: '不甘',
      stats: { strength: -1, constitution: -1, agility: 0 },
      label: '战斗受挫'
    },
    combat_retreat: {
      exp: 5, health: '轻伤', mood: '警惕',
      stats: { agility: -1 },
      label: '仓促撤退'
    },
    combat_risk: {
      exp: 25, health: '受伤', mood: '紧张',
      stats: { strength: 0, constitution: -1 },
      label: '险象环生'
    },

    // --- 探索类 ---
    exploration: {
      exp: 20, mood: '好奇',
      stats: { perception: 1, intelligence: 0 },
      label: '探索未知'
    },
    exploration_risk: {
      exp: 25, mood: '紧张',
      stats: { perception: 1, agility: -1 },
      label: '铤而走险'
    },
    exploration_loot: {
      exp: 15, mood: '愉悦',
      stats: { perception: 0 },
      label: '有所发现'
    },

    // --- 社交类 ---
    social_success: {
      exp: 20, mood: '愉悦',
      stats: { intelligence: 1, spirit: 1 },
      label: '社交顺利'
    },
    social_fail: {
      exp: 5, mood: '尴尬',
      stats: { intelligence: -1 },
      label: '社交受挫'
    },
    social_negotiate: {
      exp: 15, mood: '平和',
      stats: { intelligence: 1 },
      label: '谈判周旋'
    },
    social_deceive: {
      exp: 20, mood: '紧张',
      stats: { intelligence: 1, spirit: -1 },
      label: '谎言试探'
    },

    // --- 休息/恢复类 ---
    rest: {
      exp: 5, health: '健康', mood: '放松',
      stats: {},
      label: '休整恢复'
    },
    rest_partial: {
      exp: 3, health: '恢复中', mood: '平淡',
      stats: {},
      label: '短暂歇息'
    },
    train: {
      exp: 30, mood: '充实',
      stats: { strength: 1, agility: 1, constitution: 1 },
      label: '勤加修炼'
    },

    // --- 冒险/事件类 ---
    quest_progress: {
      exp: 40, mood: '坚定',
      stats: {},
      label: '任务推进'
    },
    quest_complete: {
      exp: 80, mood: '满足',
      stats: { spirit: 1 },
      label: '任务完成'
    },
    danger: {
      exp: 15, health: '受伤', mood: '警惕',
      stats: { agility: -1 },
      label: '遭遇危险'
    },
    escape: {
      exp: 20, mood: '庆幸',
      stats: { agility: 1 },
      label: '惊险逃脱'
    },
    mystery: {
      exp: 25, mood: '疑惑',
      stats: { intelligence: 1, perception: 1 },
      label: '发现谜团'
    },

    // --- 通用/兜底 ---
    neutral: {
      exp: 10, mood: '平淡',
      stats: {},
      label: '平稳推进'
    },
    recommended: {
      exp: 15, mood: '平淡',
      stats: {},
      label: '命运指引'
    },
  },

  // ========== 工具方法 ==========

  /** 根据type标签获取标准化效果 */
  getEffects(type) {
    return this.TEMPLATES[type] || this.TEMPLATES.neutral;
  },

  /** 给选项列表自动附加效果 */
  attachEffects(choices) {
    return choices.map(c => {
      const type = c.type || 'neutral';
      const template = this.getEffects(type);
      return {
        text: c.text,
        tag: c.tag || '',
        type: type,
        effects: { ...template.stats, exp: template.exp },
        // 健康/心情由当前状态和类型标签决定最终值
        _status: {
          health: template.health || null,
          mood: template.mood || null,
        },
        // 角色关系变化：社交类选项根据成功率附加
        _relations: null,
        _items: null,
        _skills: null,
      };
    });
  },

  /** 从story文本和选项类型推断获得的物品 */
  inferItems(storyText, type) {
    // 简单匹配常见物品模式
    const patterns = [
      { regex: /获得[了]?[了]?(.*?)[,，。！\n]/, item: null },  // placeholder
    ];
    return null; // 暂不自动推断，由AI的status_updates提供
  },

  // ========== 应用效果（替代原_applyEffects的核心逻辑） ==========

  /**
   * 应用标准化效果到玩家状态
   * @param {object} player - 玩家状态对象
   * @param {object} effects - 效果对象
   * @param {object} status - 健康/心情变化 {health, mood}
   * @returns {string[]} 变化描述列表
   */
  apply(player, effects, status) {
    const msg = [];

    // 1. 健康变化
    if (status && status.health) {
      player.health = status.health;
      msg.push(`健康: ${status.health}`);
    }

    // 2. 心情变化
    if (status && status.mood) {
      player.mood = status.mood;
      msg.push(`心情: ${status.mood}`);
    }

    // 3. 经验值
    const exp = effects.exp || 0;
    if (exp) {
      msg.push(`经验 ${exp > 0 ? '+' + exp : exp}`);
    }

    // 4. 属性变化
    if (effects && player.statsLayout && player.statsLayout.stats) {
      player.statsLayout.stats.forEach(s => {
        if (effects[s.id] !== undefined) {
          player.stats[s.id] = (player.stats[s.id] || s.value) + effects[s.id];
          msg.push(`${s.name} ${effects[s.id] > 0 ? '+' + effects[s.id] : effects[s.id]}`);
        }
      });
    }

    // 5. 兼容旧版属性名
    const legacyMap = {'strength':'力量','agility':'敏捷','constitution':'体质','intelligence':'智力','spirit':'精神','perception':'感知'};
    Object.entries(legacyMap).forEach(([k, v]) => {
      if (effects && effects[k] !== undefined) {
        player.stats[k] = (player.stats[k] || 15) + effects[k];
        msg.push(`${v} ${effects[k] > 0 ? '+' + effects[k] : effects[k]}`);
      }
    });

    return msg;
  },

  /**
   * 根据选项类型和当前玩家状态，判断完整效果（含健康/心情的最终值）
   */
  evaluate(player, choiceType) {
    const template = this.getEffects(choiceType);
    const effects = { ...template.stats, exp: template.exp };

    // 健康：如果已有更严重的伤，保留
    let health = template.health || null;
    if (health && player.health === '重伤' && health !== '健康') {
      // 重伤基础上再加伤 → 恶化
      if (health === '受伤') health = '重伤';
    }

    // 心情：叠加而非覆盖（如果剧烈冲突则覆盖）
    let mood = template.mood || null;

    return { effects, health, mood, label: template.label };
  }
};
// ── 确保 EffectsEngine 在 onclick 中可访问（const 不挂 window）──
window.EffectsEngine = EffectsEngine;
