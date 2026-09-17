// ============================
// INVENTORY SYSTEM — 独立物品道具底层
// v2.0 新增，与 GameEngine 通过 state.player.inventory 双向绑定
// ============================

/**
 * 物品模板库 — 定义所有可存在的物品类型及其默认属性
 * 当 AI 新增物品时，按名称模糊匹配；匹配不到则归入 misc
 */
var ItemRegistry = {
  /** 内置模板（可动态扩展） */
  _templates: {
    // ===== 消耗品 =====
    healing_potion:   { id:'healing_potion',   name:'治疗药水',   category:'consumable', desc:'恢复生命的药水',         effect:{health:'恢复'}, stackable:true, maxStack:99, rarity:'common', emoji:'🧪' },
    mana_potion:      { id:'mana_potion',      name:'魔力药水',   category:'consumable', desc:'恢复魔力的药水',         effect:{}, stackable:true, maxStack:99, rarity:'common', emoji:'💧' },
    antidote:         { id:'antidote',         name:'解毒剂',     category:'consumable', desc:'解除中毒状态',            effect:{health:'解毒'}, stackable:true, maxStack:20, rarity:'uncommon', emoji:'💊' },
    bandage:          { id:'bandage',          name:'绷带',       category:'consumable', desc:'包扎伤口，恢复少量生命',   effect:{health:'恢复'}, stackable:true, maxStack:30, rarity:'common', emoji:'🩹' },
    food_ration:      { id:'food_ration',      name:'干粮',       category:'consumable', desc:'补充体力',                effect:{}, stackable:true, maxStack:50, rarity:'common', emoji:'🍞' },

    // ===== 武器 =====
    iron_sword:       { id:'iron_sword',       name:'铁剑',       category:'weapon',   desc:'一把普通的铁剑',          effect:{atk:5},   stackable:false, rarity:'common', emoji:'⚔️' },
    steel_blade:      { id:'steel_blade',      name:'钢刃',       category:'weapon',   desc:'精钢打造的利刃',          effect:{atk:12},  stackable:false, rarity:'uncommon', emoji:'🗡️' },
    enchanted_bow:    { id:'enchanted_bow',    name:'附魔长弓',   category:'weapon',   desc:'带有魔法加持的长弓',       effect:{atk:18},  stackable:false, rarity:'rare', emoji:'🏹' },
    starter_weapon:   { id:'starter_weapon',   name:'初始武器',   category:'weapon',   desc:'冒险开始时的随身武器',      effect:{atk:3},   stackable:false, rarity:'common', emoji:'⚔️' },

    // ===== 防具 =====
    leather_armor:    { id:'leather_armor',    name:'皮甲',       category:'armor',    desc:'轻便的皮革护甲',          effect:{def:5},   stackable:false, rarity:'common', emoji:'🛡️' },
    chainmail:        { id:'chainmail',        name:'锁子甲',     category:'armor',    desc:'金属编织的链甲',          effect:{def:12},  stackable:false, rarity:'uncommon', emoji:'🛡️' },
    enchanted_robe:   { id:'enchanted_robe',   name:'附魔法袍',   category:'armor',    desc:'注入魔力的长袍',          effect:{def:8, mp:20}, stackable:false, rarity:'rare', emoji:'👘' },

    // ===== 饰品 =====
    luck_charm:       { id:'luck_charm',       name:'幸运护符',   category:'accessory',desc:'据说能带来好运的小护符',    effect:{luck:5},  stackable:false, rarity:'uncommon', emoji:'🔮' },
    ring_of_power:    { id:'ring_of_power',    name:'力量之戒',   category:'accessory',desc:'增幅佩戴者力量的戒指',      effect:{atk:8},   stackable:false, rarity:'rare', emoji:'💍' },
    amulet_of_ward:   { id:'amulet_of_ward',   name:'守护项链',   category:'accessory',desc:'提供魔法防护的项链',        effect:{def:6},   stackable:false, rarity:'rare', emoji:'📿' },

    // ===== 关键道具 =====
    ancient_key:      { id:'ancient_key',      name:'古老钥匙',   category:'key',      desc:'一把锈迹斑斑但依然能用的钥匙', effect:{},     stackable:false, rarity:'key', emoji:'🗝️' },
    mysterious_map:   { id:'mysterious_map',   name:'神秘地图',   category:'key',      desc:'标记着未知地点的古老地图',  effect:{},     stackable:false, rarity:'key', emoji:'🗺️' },
    quest_letter:     { id:'quest_letter',     name:'委托信',     category:'key',      desc:'一封重要的委托信函',        effect:{},     stackable:false, rarity:'key', emoji:'📜' },

    // ===== 杂物 =====
    gold_coin:        { id:'gold_coin',        name:'金币',       category:'misc',     desc:'闪闪发光的金币',           effect:{}, stackable:true, maxStack:9999, rarity:'common', emoji:'🪙' },
    beast_pelt:       { id:'beast_pelt',       name:'兽皮',       category:'misc',     desc:'从野兽身上剥下的皮毛',      effect:{}, stackable:true, maxStack:50,  rarity:'common', emoji:'🐺' },
    strange_stone:    { id:'strange_stone',    name:'奇异石头',   category:'misc',     desc:'一块散发着微弱光芒的石头',   effect:{}, stackable:false, rarity:'uncommon', emoji:'💎' },
  },

  /** 按名称模糊查找模板（用于 AI 新增物品时自动匹配） */
  find(name) {
    const cleanName = name.trim();

    // 精确 ID 匹配
    const byId = this._templates[cleanName];
    if (byId) return byId;

    // 精确名称匹配
    for (const t of Object.values(this._templates)) {
      if (t.name === cleanName) return t;
    }

    // 模糊匹配（包含关系）
    for (const t of Object.values(this._templates)) {
      if (t.name.includes(cleanName) || cleanName.includes(t.name)) return t;
    }

    return null; // 未匹配到，视为自定义物品
  },

  /** 按类别列出模板 */
  listByCategory(category) {
    return Object.values(this._templates).filter(t => t.category === category);
  },

  /** 获取物品的默认 emoji */
  getEmoji(category) {
    const map = { consumable:'🧪', weapon:'⚔️', armor:'🛡️', accessory:'🔮', key:'🗝️', misc:'📦' };
    return map[category] || '📦';
  },

  /** 动态注册自定义模板 */
  register(template) {
    this._templates[template.id] = template;
  },
};

// ============================
// InventorySystem — 玩家背包 + 穿戴
// ============================
var InventorySystem = {
  /**
   * 初始化玩家背包（在 startGame 或 loadSave 时调用）
   * @param {object} playerState — GameEngine.state.player 的引用
   */
  init(playerState) {
    // 如果已有 inventory（从存档恢复），直接复用
    if (playerState.inventory) return;

    // 迁移旧格式 items → inventory
    playerState.inventory = this._migrateItems(playerState.items || []);
    // 保留旧字段以兼容存档（之后可以删）
    // playerState.items = undefined;  // 暂时保留
  },

  /** 旧格式迁移：{name,qty,desc}[] → {bag:[],equipped:{}} */
  _migrateItems(oldItems) {
    const bag = [];
    for (const it of oldItems) {
      const tpl = ItemRegistry.find(it.name);
      bag.push({
        id: this._uid(),
        name: it.name,
        qty: it.qty || 1,
        desc: it.desc || (tpl ? tpl.desc : ''),
        category: tpl ? tpl.category : 'misc',
        stackable: tpl ? tpl.stackable : true,
        maxStack: tpl ? tpl.maxStack : 99,
        rarity: tpl ? tpl.rarity : 'common',
        emoji: tpl ? tpl.emoji : ItemRegistry.getEmoji(tpl ? tpl.category : 'misc'),
        effect: tpl ? { ...tpl.effect } : {},
        ref: tpl ? tpl.id : null,
      });
    }
    return { bag, equipped: {} };
  },

  _uid() { return 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); },

  // ========== 核心操作 ==========

  /** 添加物品 */
  addItem(playerState, rawName, qty = 1, desc = '', category = null, effect = null) {
    if (!playerState.inventory) this.init(playerState);
    const inv = playerState.inventory;
    const name = rawName.trim();

    // 过滤 AI 返回的空物品标记（含"无""无（xxx）"等变体）
    if (!name || name.startsWith('无') || name === '没有' || name === '暂无' || name === '没有新物品') {
      return { added: false, reason: '空物品标记，已忽略' };
    }

    // 尝试匹配模板
    const tpl = ItemRegistry.find(name);
    // 有模板时使用模板的规范名（消除AI导致的空格/大小写差异）
    const canonicalName = tpl ? tpl.name : name;
    const finalCategory = category || (tpl ? tpl.category : 'misc');
    const finalDesc = desc || (tpl ? tpl.desc : '');
    const finalEmoji = tpl ? tpl.emoji : ItemRegistry.getEmoji(finalCategory);
    const finalEffect = effect || (tpl ? { ...tpl.effect } : {});
    const finalStackable = tpl ? tpl.stackable : true;
    const finalMaxStack = tpl ? tpl.maxStack : 99;
    const finalRarity = tpl ? tpl.rarity : 'common';

    // 可堆叠物品：先找同名（规范化比较）
    if (finalStackable) {
      const existing = inv.bag.find(it => it.name.trim().toLowerCase() === canonicalName.toLowerCase() && it.stackable);
      if (existing) {
        existing.qty += qty;
        return { added: true, stacked: true, item: existing };
      }
    }

    // 新物品实例（使用规范名）
    const newItem = {
      id: this._uid(),
      name: canonicalName,
      qty,
      desc: finalDesc,
      category: finalCategory,
      stackable: finalStackable,
      maxStack: finalMaxStack,
      rarity: finalRarity,
      emoji: finalEmoji,
      effect: finalEffect,
      ref: tpl ? tpl.id : null,
    };
    inv.bag.push(newItem);
    return { added: true, stacked: false, item: newItem };
  },

  /** 移除物品（按 ID 或按名称+数量） */
  removeItem(playerState, idOrName, qty = 1) {
    if (!playerState.inventory) return { removed: false, reason: '没有背包' };
    const inv = playerState.inventory;

    // 按 ID 查找
    let idx = inv.bag.findIndex(it => it.id === idOrName);
    if (idx === -1) {
      // 按名称查找
      idx = inv.bag.findIndex(it => it.name === idOrName);
    }
    if (idx === -1) return { removed: false, reason: `没有找到物品: ${idOrName}` };

    const item = inv.bag[idx];
    if (item.qty <= qty) {
      inv.bag.splice(idx, 1);
      return { removed: true, consumed: true, item };
    } else {
      item.qty -= qty;
      return { removed: true, consumed: false, item: { ...item, qty: item.qty } };
    }
  },

  /** 使用物品（仅消耗品扣除数量，其余仅查看描述）*/
  useItem(playerState, idOrName) {
    if (!playerState.inventory) return { used: false, reason: '没有背包' };
    const inv = playerState.inventory;

    // 按 ID 精确查找
    let idx = inv.bag.findIndex(it => it.id === idOrName);
    if (idx === -1) {
      idx = inv.bag.findIndex(it => it.name === idOrName);
    }
    if (idx === -1) return { used: false, reason: `没有物品: ${idOrName}` };

    const item = inv.bag[idx];

    // 非消耗品：仅返回描述供前端展示
    if (item.category !== 'consumable') {
      const canEquip = ['weapon', 'armor', 'accessory'].includes(item.category);
      return { used: false, info: true, item, reason: item.desc || `${item.name}（${item.category}）`, canEquip };
    }

    // 消耗品：应用效果并扣减数量
    if (item.effect && Object.keys(item.effect).length > 0) {
      this._applyItemEffect(playerState, item.effect);
    }

    item.qty -= 1;
    const consumed = item.qty <= 0;
    if (consumed) inv.bag.splice(idx, 1);

    return { used: true, consumed, item };
  },

  /** 装备物品 */
  equipItem(playerState, idOrName, slot = null) {
    if (!playerState.inventory) return { equipped: false, reason: '没有背包' };
    const inv = playerState.inventory;

    // 查找物品
    let idx = inv.bag.findIndex(it => it.id === idOrName);
    if (idx === -1) {
      idx = inv.bag.findIndex(it => it.name === idOrName);
    }
    if (idx === -1) return { equipped: false, reason: `没有物品: ${idOrName}` };

    const item = inv.bag[idx];
    if (!['weapon', 'armor', 'accessory'].includes(item.category)) {
      return { equipped: false, reason: `${item.name} 不能装备` };
    }

    // 自动确定槽位
    const targetSlot = slot || item.category;
    if (!['weapon', 'armor', 'accessory'].includes(targetSlot)) {
      return { equipped: false, reason: `无效的装备槽: ${targetSlot}` };
    }

    // 如果已有装备，卸下旧装备
    if (inv.equipped[targetSlot]) {
      const oldItem = inv.equipped[targetSlot];
      this.addItem(playerState, oldItem.name, oldItem.qty, oldItem.desc, oldItem.category, oldItem.effect);
    }

    // 从背包移除并装备
    inv.bag.splice(idx, 1);
    inv.equipped[targetSlot] = { ...item, qty: 1 };
    return { equipped: true, slot: targetSlot, item: inv.equipped[targetSlot] };
  },

  /** 卸下装备 */
  unequipSlot(playerState, slot) {
    if (!playerState.inventory) return { unequipped: false, reason: '没有背包' };
    const inv = playerState.inventory;

    const item = inv.equipped[slot];
    if (!item) return { unequipped: false, reason: `${slot} 槽位没有装备` };

    // 放回背包
    this.addItem(playerState, item.name, item.qty, item.desc, item.category, item.effect);
    delete inv.equipped[slot];
    return { unequipped: true, slot };
  },

  /** 丢弃物品（不可撤销，销毁） */
  dropItem(playerState, idOrName, qty = 1) {
    if (!playerState.inventory) return { dropped: false, reason: '没有背包' };
    const inv = playerState.inventory;

    let idx = inv.bag.findIndex(it => it.id === idOrName);
    if (idx === -1) idx = inv.bag.findIndex(it => it.name === idOrName);
    if (idx === -1) return { dropped: false, reason: `没有物品: ${idOrName}` };

    const item = inv.bag[idx];
    const actualDrop = Math.min(qty, item.qty);
    item.qty -= actualDrop;
    const destroyed = item.qty <= 0;
    if (destroyed) inv.bag.splice(idx, 1);

    return { dropped: true, destroyed, item: { ...item, qty: actualDrop } };
  },

  /** 给予物品（给 NPC/其他角色） */
  giveItem(playerState, idOrName, recipient, qty = 1) {
    if (!playerState.inventory) return { given: false, reason: '没有背包' };
    const inv = playerState.inventory;

    let idx = inv.bag.findIndex(it => it.id === idOrName);
    if (idx === -1) idx = inv.bag.findIndex(it => it.name === idOrName);
    if (idx === -1) return { given: false, reason: `没有物品: ${idOrName}` };

    const item = inv.bag[idx];
    const actualGive = Math.min(qty, item.qty);
    item.qty -= actualGive;
    const consumed = item.qty <= 0;
    if (consumed) inv.bag.splice(idx, 1);

    // 记录给予历史（推进剧情用）
    if (!playerState._giveHistory) playerState._giveHistory = [];
    playerState._giveHistory.push({
      itemName: item.name,
      qty: actualGive,
      recipient,
      time: new Date().toISOString(),
    });

    return { given: true, consumed, item: { ...item, qty: actualGive }, recipient };
  },

  // ========== 效果应用 ==========

  _applyItemEffect(playerState, effect) {
    // 注意：playerState 是 playerState 对象，其中的 stats/health 字段因世界观不同而变化
    // 这里只做通用处理
    if (effect.health === '恢复' && playerState.health && playerState.health !== '健康') {
      playerState.health = '健康';
    }
    // 通用数值类效果（如 atk+5, def+3）
    for (const [key, val] of Object.entries(effect)) {
      if (typeof val === 'number') {
        if (playerState.stats && playerState.stats[key] !== undefined) {
          playerState.stats[key] += val;
        }
      }
    }
  },

  // ========== 查询与格式化 ==========

  /** 获取给 AI prompt 的物品列表字符串 */
  getPromptItems(playerState) {
    if (!playerState.inventory) return '无';
    const inv = playerState.inventory;

    const parts = [];

    // 装备
    if (inv.equipped && Object.keys(inv.equipped).length > 0) {
      const eq = [];
      for (const [slot, item] of Object.entries(inv.equipped)) {
        if (item) eq.push(`${slot}:${item.name}`);
      }
      if (eq.length > 0) parts.push('【装备】' + eq.join(' '));
    }

    // 背包物品（按类别分组）
    const groups = { consumable:'消耗品', weapon:'武器', armor:'防具', accessory:'饰品', key:'关键道具', misc:'杂物' };
    const byCat = {};
    for (const it of inv.bag) {
      const cat = it.category || 'misc';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(`${it.name}${it.qty > 1 ? 'x' + it.qty : ''}`);
    }

    for (const [cat, label] of Object.entries(groups)) {
      if (byCat[cat] && byCat[cat].length > 0) {
        parts.push(`【${label}】${byCat[cat].join(' ')}`);
      }
    }

    return parts.length > 0 ? parts.join(' ') : '无';
  },

  /** 获取背包所有物品（用于 UI 渲染） */
  getBagItems(playerState) {
    if (!playerState.inventory) return [];
    return playerState.inventory.bag || [];
  },

  /** 获取装备映射 */
  getEquipped(playerState) {
    if (!playerState.inventory) return {};
    return playerState.inventory.equipped || {};
  },

  /** 获取旧格式兼容的 items 数组（用于向后兼容） */
  getLegacyItems(playerState) {
    if (!playerState.inventory) return [];
    const inv = playerState.inventory;
    const result = [];

    // 背包物品
    for (const it of inv.bag) {
      result.push({ name: it.name, qty: it.qty, desc: it.desc });
    }

    // 装备物品
    for (const item of Object.values(inv.equipped || {})) {
      if (item) result.push({ name: `[装备]${item.name}`, qty: 1, desc: item.desc });
    }

    return result;
  },
};
// ── 确保 InventorySystem 在 onclick 中可访问（const 不挂 window）──
window.InventorySystem = InventorySystem;
