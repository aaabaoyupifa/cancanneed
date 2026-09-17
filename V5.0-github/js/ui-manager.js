// ============================
// UI MANAGER
// ============================
var UIManager = {
  updateAllStatus() {
    const p = GameEngine.state.player;
    if (!GameEngine.state.gameStarted) return;
    document.getElementById('s-name').textContent = p.name;
    document.getElementById('s-sex').textContent = p.sex;
    document.getElementById('s-age').textContent = `${p.age}岁`;
    const levelEl = document.getElementById('s-level');
    if (levelEl) levelEl.textContent = `Lv.${p.level || 1}` + (p.rank ? `（${p.rank}）` : '');
    document.getElementById('s-health').textContent = p.health || '健康';
    document.getElementById('s-mood').textContent = p.mood || '平淡';
    document.getElementById('s-days').textContent = `第${Math.floor(GameEngine.state.days||1)}天`;
    document.getElementById('s-chapter').textContent = `第${GameEngine.state.chapter}章`;
    // v2.2: 里程碑统计
    const ms = GameEngine.state.milestones;
    if (ms && GameEngine.state.gameStarted) {
      const msSection = document.getElementById('s-milestones-section');
      const msDiv = document.getElementById('s-milestones');
      msSection.style.display = '';
      msDiv.innerHTML = [
        `📝 ${ms.totalWords || 0}字`,
        `🎯 ${ms.choicesMade || 0}次选择`,
        `📅 ${ms.daysSurvived || 1}天`,
      ].map(t => `<div class="stat-row"><span class="stat-value" style="font-size:11px;">${t}</span></div>`).join('');
    }
    // Health color coding
    const healthEl = document.getElementById('s-health');
    const healthColors = {'健康':'var(--success)','轻伤':'#d4a040','重伤':'var(--danger)','中毒':'#c080ff','濒死':'#ff4444'};
    healthEl.style.color = healthColors[p.health] || 'var(--text)';
    const moodEl = document.getElementById('s-mood');
    const moodColors = {'开心':'var(--success)','平淡':'var(--text)','冷漠':'var(--text-dim)','愤怒':'var(--danger)','悲伤':'#5b8def','抑郁':'#8080c0'};
    moodEl.style.color = moodColors[p.mood] || 'var(--text)';

    // Dynamic attributes from AI-generated layout
    const layout = p.statsLayout;
    const attrSection = document.getElementById('s-attributes-section');
    const attrDiv = document.getElementById('s-attributes');
    if (layout && layout.stats && layout.stats.length > 0) {
      attrSection.style.display = '';
      attrDiv.innerHTML = layout.stats.map(s => {
        const val = p.stats[s.id] !== undefined ? p.stats[s.id] : s.value;
        const max = s.max || 100;
        const desc = s.desc || '';
        const title = desc ? `title="${desc.replace(/"/g,'&quot;')}"` : '';
        if (s.display === 'bar') {
          const pct = Math.min(100, (val/max*100));
          return `<div class="stat-row" ${title}><span class="stat-label">${s.name}</span><span class="stat-value">${Math.floor(val)}/${max}</span></div>
            <div class="bar-wrap" ${title}><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#2a4060,var(--accent));"></div></div>`;
        }
        return `<div class="stat-row" ${title}><span class="stat-label">${s.name}</span><span class="stat-value">${Math.floor(val)}</span></div>`;
      }).join('');
    } else {
      attrSection.style.display = 'none';
    }

    document.getElementById('s-skills').innerHTML = p.skills.map(s => {
      const prof = s.proficiency ? ` ${s.proficiency}` : '';
      const lv = s.level ? ` Lv.${s.level}` : '';
      const tip = s.desc || `${s.name}（${s.type||'技能'}）`;
      return `<span class="skill-tag" title="${tip}">${s.name}${lv}${prof}</span>`;
    }).join('') || '<span style="color:var(--text-dim);font-size:12px;">暂无技能</span>';
    document.getElementById('s-items').innerHTML = this._renderInventory(p);

    // Rich relationship display — 只显示 characterBios 中 showInPanel=true 的人物
    const charBios = GameEngine.state.characterBios || [];
    const charBiosMap = {};
    charBios.forEach(c => { charBiosMap[c.name] = c; });
    const rels = Object.entries(p.relations).filter(([name]) => {
      // 跳过 _charDetails
      if (name === '_charDetails') return false;
      const bio = charBiosMap[name];
      // 如果有 bio 且 showInPanel 明确为 false，则不显示；默认显示（兼容旧数据）
      if (bio && bio.showInPanel === false) return false;
      return true;
    });
    const charDetails = p._charDetails || {};
    document.getElementById('s-relations').innerHTML = rels.map(([name,val]) => {
      const detail = charDetails[name] || {};
      const cls = val>=30?'positive':val<=-10?'negative':'neutral';
      const w = Math.min(100, Math.abs(val)*2);
      const relLabel = detail.relation || (val>=30?'友好':val<=-10?'敌意':'路人');
      const bg = detail.background || '';
      const bio = charBiosMap[name];
      const portrait = bio?.portrait || '';
      const titleParts = [`${name}：${relLabel}（亲密度${val}）`, bg].filter(Boolean);
      const portraitHtml = portrait ? `<div style="width:24px;height:24px;border-radius:50%;overflow:hidden;flex-shrink:0;">${portrait}</div>` : '';
      return `<div class="relation-row" title="${titleParts.join('\n').replace(/"/g,'&quot;')}" style="${portraitHtml?'gap:6px;':''}">
        ${portraitHtml}<span>${name}</span><span style="font-size:10px;color:var(--text-dim);">${relLabel}</span>
        <div class="rel-bar"><div class="rel-fill ${cls}" style="width:${w}%"></div></div>
        <span style="font-size:11px;color:${val>=0?'var(--success)':'var(--danger)'}">${val>0?'+'+val:val}</span>
      </div>`;
    }).join('') || '<span style="color:var(--text-dim);font-size:12px;">暂无关系（在人物关系图中勾选"显示在右侧关系面板"）</span>';

    document.getElementById('s-quests').innerHTML = p.quests.map(q => `<div class="quest-item ${q.status==='complete'?'complete':''}"><div class="q-title">${q.title}</div><div class="q-desc">${q.desc}</div></div>`).join('') || '<span style="color:var(--text-dim);font-size:12px;">暂无任务</span>';

    // v4.0: 同步 player.relations → 画布节点（确保画布始终与右侧列表一致）
    if (typeof CharacterBioManager !== 'undefined' && CharacterBioManager._syncFromPlayerRelations) {
      try { CharacterBioManager._syncFromPlayerRelations(); } catch(e) {}
    }
    // 如果右侧迷你画布已展开，刷新渲染
    if (typeof CharGraphPanel !== 'undefined' && CharGraphPanel._expanded && !CharGraphPanel._loopId) {
      try { CharGraphPanel._resize(); CharGraphPanel._startLoop(); } catch(e) {}
    }
  },

  toggleAIModal() {
    const modal = document.getElementById('ai-modal');
    if (modal.classList.contains('hidden')) {
      document.getElementById('ai-context-out').value = this._buildAIContext();
      document.getElementById('ai-content-in').value = '';
      document.getElementById('ai-choices-in').value = '';
      modal.classList.remove('hidden');
    } else modal.classList.add('hidden');
  },

  _buildAIContext() {
    const gs = GameEngine.state; const p = gs.player;
    return `【冒险类型】${gs.genre||'未设定'}
【世界观】
名称: ${gs.worldName||'未命名'}
概述: ${gs.world}
时代: ${gs.era||'未设定'}
地点: ${gs.locations||'未设定'}
势力: ${gs.factions||'未设定'}
能力体系: ${gs.powerSystem||'未设定'}

【主角信息】
姓名: ${p.name} | 年龄: ${p.age} | 性别: ${p.sex}
性格: ${p.personality||'未设定'}
定位: ${p.oneLine||'未设定'}
背景: ${p.background||'未设定'}
能力: ${p.ability||'未设定'}
目标: ${p.goal||'未设定'}
健康: ${p.health||'健康'} | 心情: ${p.mood||'平淡'}
属性: ${Object.entries(p.stats||{}).map(([k,v])=>`${k}:${v}`).join(' ')}
技能: ${p.skills.map(s=>`${s.name}${s.level?' Lv'+s.level:''}`).join(', ')||'无'}
物品: ${p.items.map(i=>`${i.name}x${i.qty}`).join(', ')||'无'}
关系: ${Object.entries(p.relations).map(([k,v])=>`${k}(${v>0?'+'+v:v})`).join(', ')||'无'}
任务: ${p.quests.filter(q=>q.status==='active').map(q=>q.title).join(', ')||'无'}

【当前进度】第${gs.chapter}章 第${gs.scene}节 | 选择次数: ${gs.choiceCount}
【最近历史】${p.history.slice(-5).map((h,i)=>`\n${i+1}. ${h.choice}`).join('')}

请根据以上完整设定，生成下一段剧情内容（300-500字），并给出3-5个选项供主角选择。
选项格式：每行一个，推荐的选项前加*号。
剧情应综合考虑主角属性、技能、物品、关系和当前目标。`;
  },

  copyAIContext() { const ctx=document.getElementById('ai-context-out'); ctx.select(); document.execCommand('copy'); this.toast('上下文已复制！', 'success'); },
  showModal(id) { document.getElementById(id).classList.remove('hidden'); },
  showModal(id) { document.getElementById(id).classList.remove('hidden'); },
  hideModal(id) { document.getElementById(id).classList.add('hidden'); },
  toast(msg,type,durationMs) { const t=document.getElementById('toast'); t.textContent=msg; t.className=type+' show'; clearTimeout(t._toastTimer); t._toastTimer=setTimeout(()=>{t.className='';},durationMs||2500); },
  changeFontSize(delta) {
    const el = document.getElementById('story-content');
    const current = parseFloat(getComputedStyle(el).fontSize) || 15;
    const next = Math.max(12, Math.min(22, current + delta));
    el.style.fontSize = next + 'px';
    localStorage.setItem('if-font-size', next);
  },

  // v3.1: 可交互的物品面板（点击使用/装备/卸下/丢弃）
  _renderInventory(p) {
    const isGarbageName = name => !name || name === '无' || name === '没有' || name === '暂无';
    const bag = InventorySystem.getBagItems(p).filter(it => it.qty > 0 && !isGarbageName(it.name));
    const equipped = InventorySystem.getEquipped(p);

    if (bag.length === 0 && Object.keys(equipped).length === 0) {
      return '<span style="color:var(--text-dim);font-size:12px;">暂无物品</span>';
    }

    const slotNames = { weapon:'⚔️武器', armor:'🛡️防具', accessory:'💍饰品' };
    const catLabels = { consumable:'消耗品', weapon:'武器', armor:'防具', accessory:'饰品', key:'关键道具', misc:'杂物' };
    const rarityColors = { common:'var(--text-dim)', uncommon:'var(--success)', rare:'var(--accent)', epic:'#c080ff', legendary:'var(--gold-light)', key:'var(--gold)' };

    const esc = s => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const lines = [];

    // 装备区
    for (const [slot, item] of Object.entries(equipped)) {
      if (item) {
        const label = slotNames[slot] || slot;
        const title = esc((item.desc||item.name)+'（已装备·点击卸下）');
        lines.push(`<div class="item-row equipped" data-slot="${slot}" title="${title}" style="border-left:2px solid var(--gold);padding-left:6px;cursor:pointer;">
          <span>${item.emoji||'📦'} ${item.name}</span>
          <span class="item-actions"><button class="item-btn btn-unequip" data-action="unequip" data-slot="${slot}">卸</button></span>
        </div>`);
      }
    }

    // 装备分隔线
    const bagCount = bag.reduce((sum, it) => sum + it.qty, 0);
    if (Object.keys(equipped).length > 0 && bagCount > 0) {
      lines.push('<div style="border-top:1px dashed var(--border);margin:4px 0;opacity:0.5;"></div>');
    }

    // 背包物品（按类别分组）
    const cats = ['consumable', 'weapon', 'armor', 'accessory', 'key', 'misc'];
    for (const cat of cats) {
      const items = bag.filter(it => it.category === cat && it.qty > 0);
      if (items.length === 0) continue;
      lines.push(`<div style="font-size:10px;color:var(--text-dim);margin:2px 0;letter-spacing:1px;">${catLabels[cat]||cat}</div>`);
      for (const it of items) {
        const color = rarityColors[it.rarity] || 'var(--text-dim)';
        const title = esc((it.desc||it.name)+(it.category==='key'?' 【关键道具】':''));
        const isEquippable = ['weapon','armor','accessory'].includes(it.category);
        lines.push(`<div class="item-row" data-item-id="${it.id}" data-item-name="${esc(it.name)}" title="${title}">
          <span style="color:${color};">${it.emoji||'📦'} ${it.name}</span><span class="qty">x${it.qty}</span>
          <span class="item-actions">
            <button class="item-btn btn-use" data-action="use" data-item-id="${it.id}">用</button>
            ${isEquippable?`<button class="item-btn btn-equip" data-action="equip" data-item-id="${it.id}">装</button>`:''}
            <button class="item-btn btn-drop" data-action="drop" data-item-id="${it.id}">弃</button>
          </span>
        </div>`);
      }
    }

    return lines.join('');
  },

  // 道具操作事件初始化（在 app.js 中调用一次）
  initInventoryActions() {
    const panel = document.getElementById('s-items');
    if (!panel || panel.dataset.inventoryInit) return;
    panel.dataset.inventoryInit = '1';

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('.item-btn');
      if (!btn) return;
      e.stopPropagation();
      this._handleItemAction(btn);
    });
  },

  _handleItemAction(btn) {
    const action = btn.dataset.action;
    const p = GameEngine.state.player;
    let result;

    switch (action) {
      case 'use':
        result = InventorySystem.useItem(p, btn.dataset.itemId);
        if (result.used) {
          this._miniToast(`${result.item.name} 已使用${result.consumed?'（已耗尽）':''}`, 'success');
        } else if (result.info) {
          this._miniToast(result.reason || result.item.name, 'info');
        } else {
          this._miniToast(result.reason || '无法使用', 'warning');
        }
        break;

      case 'equip':
        result = InventorySystem.equipItem(p, btn.dataset.itemId);
        if (result.equipped) {
          this._miniToast(`已装备 ${result.item.name}`, 'success');
        } else {
          this._miniToast(result.reason || '无法装备', 'warning');
        }
        break;

      case 'unequip':
        result = InventorySystem.unequipSlot(p, btn.dataset.slot);
        if (result.unequipped) {
          this._miniToast(`已卸下装备`, 'success');
        } else {
          this._miniToast(result.reason || '无法卸下', 'warning');
        }
        break;

      case 'drop':
        const dropName = InventorySystem.getBagItems(p).find(it => it.id === btn.dataset.itemId)?.name || '物品';
        if (confirm(`确定要丢弃「${dropName}」吗？此操作不可撤销。`)) {
          result = InventorySystem.dropItem(p, btn.dataset.itemId);
          if (result.dropped) {
            this._miniToast(`已丢弃 ${result.item.name}${result.destroyed?'（已销毁）':''}`, 'warning');
          }
        } else {
          return; // 用户取消，不刷新
        }
        break;
    }

    this.updateAllStatus();
  },

  _miniToast(msg, type) {
    const exist = document.querySelector('.toast-mini');
    if (exist) exist.remove();
    const el = document.createElement('div');
    el.className = 'toast-mini';
    if (type === 'success') el.style.borderColor = 'var(--success)';
    else if (type === 'warning') el.style.borderColor = 'var(--gold)';
    else if (type === 'info') el.style.borderColor = 'var(--accent)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  },
};
// ── 确保 UIManager 在 onclick 中可访问（const 不挂 window）──
window.UIManager = UIManager;
