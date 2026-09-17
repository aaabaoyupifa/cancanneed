// ============================
// CHARACTER BIO MANAGER + CANVAS RELATION GRAPH
// v3.5 — 集成无限画布人物关系图
// ============================

var REL_TYPES = ['师徒','恋人','亲人','朋友','仇敌','同门','同盟','暗恋','利用','敌对','主仆','自定义'];
var REL_COLORS = {
  '师徒':'#c9a84c','恋人':'#d4787c','亲人':'#7cac60','朋友':'#6898c8',
  '仇敌':'#c0392b','同门':'#9a88c0','同盟':'#60aca8','暗恋':'#d490a0',
  '利用':'#c87830','敌对':'#c04040','主仆':'#a09060','自定义':'#888'
};

var PortraitImageCache = {
  _items: {},
  get(src) {
    if (!src) return null;
    if (this._items[src]) return this._items[src];
    const img = new Image();
    img.src = src;
    this._items[src] = img;
    return img;
  }
};

// =============================================
// CharGraph — 画布引擎（内嵌在人物小传 modal 里）
// =============================================
var CharGraph = {
  cv: null, ctx: null, wrap: null,
  camX: 0, camY: 0, scale: 1,
  drag: null, hoverNode: null, hoverEdge: null, selNode: null,
  connMode: false, connFrom: null, connLine: null,
  _editingId: null,
  vw: 0, vh: 0,

  // ===== INIT =====
  init() {
    this.cv = document.getElementById('char-canvas');
    this.ctx = this.cv.getContext('2d');
    this.wrap = document.getElementById('char-canvas-wrap');
    const cv = this.cv;
    cv.addEventListener('mousedown', e => this._down(e));
    cv.addEventListener('mousemove', e => this._move(e));
    cv.addEventListener('mouseup', () => { this.drag = null; cv.style.cursor = 'default'; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this._zoom(e); }, {passive:false});
    cv.addEventListener('dblclick', e => this._dbl(e));
    cv.addEventListener('contextmenu', e => { e.preventDefault(); this._rclick(e); });
    cv.addEventListener('touchstart', e => this._tStart(e), {passive:false});
    cv.addEventListener('touchmove', e => this._tMove(e), {passive:false});
    cv.addEventListener('touchend', () => { this.drag = null; });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.connMode = false; this.connFrom = null; this.connLine = null; this.closeEdit(); }
      if (e.key === 'Delete' && this.selNode) this.deleteCharacter();
    });
  },

  // Called when modal opens
  show() {
    this._resize();
    // 全屏打开时也自动缩放使所有节点可见
    if (this.chars.length > 0) {
      this._autoFitView();
    }
    this._startLoop();
  },

  /** 自动缩放使所有节点可见（全屏画布用） */
  _autoFitView() {
    if (!this.chars.length || !this.wrap) return;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (const c of this.chars) {
      if (c.x == null || c.y == null) continue;
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
    if (!isFinite(minX)) return;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const r = this.wrap.getBoundingClientRect();
    const w = r.width || 800, h = r.height || 600;
    const contentW = Math.max(1, maxX - minX + 200);
    const contentH = Math.max(1, maxY - minY + 100);
    const scaleX = w / contentW;
    const scaleY = h / contentH;
    this.scale = Math.max(0.1, Math.min(2, Math.min(scaleX, scaleY)));
    this.camX = w / 2 - cx * this.scale;
    this.camY = h / 2 - cy * this.scale;
  },

  // Called when modal closes
  hide() {
    this._stopLoop();
    this.closeEdit();
    this.connMode = false; this.connFrom = null; this.connLine = null;
  },

  _loopId: null,
  _startLoop() { if (!this._loopId) this._loopId = requestAnimationFrame(() => this._loop()); },
  _stopLoop() { if (this._loopId) { cancelAnimationFrame(this._loopId); this._loopId = null; } },

  _resize() {
    if (!this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const w = r.width || 600, h = r.height || 400;
    this.vw = w; this.vh = h;
    this.cv.width = w * 2; this.cv.height = h * 2;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(2, 2);
    const zl = document.getElementById('char-zoom-label');
    if (zl) zl.textContent = Math.round(this.scale * 100) + '%';
  },

  // ===== COORD TRANSFORM =====
  _s2w(sx, sy) { return {x: (sx - this.camX) / this.scale, y: (sy - this.camY) / this.scale}; }
,
  _w2s(wx, wy) { return {x: wx * this.scale + this.camX, y: wy * this.scale + this.camY}; },

  // ===== DATA ACCESS (bridge to GameEngine.state) =====
  get chars() { const gs = GameEngine.state; if (!gs.characterBios) gs.characterBios = []; return gs.characterBios; },
  get rels() { const gs = GameEngine.state; if (!gs.characterRelations) gs.characterRelations = []; return gs.characterRelations; },
  set rels(v) { GameEngine.state.characterRelations = v; },

  _nextCharId() {
    const ids = this.chars.map(c => parseInt(c.id.replace('c','')) || 0);
    return 'c' + ((ids.length ? Math.max(...ids) : 0) + 1);
  },
  _nextRelId() {
    const ids = this.rels.map(r => parseInt(r.id.replace('r','')) || 0);
    return 'r' + ((ids.length ? Math.max(...ids) : 0) + 1);
  },

  // ===== HIT TEST =====
  _hitNode(wx, wy) {
    for (let i = this.chars.length - 1; i >= 0; i--) {
      const c = this.chars[i];
      if (c.x == null || c.y == null) continue;
      if (Math.abs(wx - c.x) < 75 && Math.abs(wy - c.y) < 35) return c;
    }
    return null;
  },

  _hitEdge(wx, wy) {
    // 判定点到贝塞尔曲线的距离——简化为点到线段中点+整条线段的距离
    const th = 18 / this.scale; // 放大判定区域（原12）
    for (const r of this.rels) {
      const f = this.chars.find(c => c.id === r.from);
      const t = this.chars.find(c => c.id === r.to);
      if (!f || !t || f.x == null || t.x == null) continue;
      // 检查点到整条线段（from→to）的距离，而非只检查中点
      const dist = this._pointToSegDist(wx, wy, f.x, f.y, t.x, t.y);
      if (dist < th) return r;
    }
    return null;
  },

  /** 点到线段的距离 */
  _pointToSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  },

  // ===== RENDER LOOP =====
  _loop() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.scale, this.scale);
    this._drawGrid(ctx);
    this._drawEdges(ctx);
    this._drawNodes(ctx);
    if (this.connLine) {
      ctx.strokeStyle = 'rgba(201,168,76,0.6)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([6,4]); ctx.beginPath();
      ctx.moveTo(this.connLine.x1, this.connLine.y1);
      ctx.lineTo(this.connLine.x2, this.connLine.y2);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    this._loopId = requestAnimationFrame(() => this._loop());
  },

  _drawGrid(ctx) {
    const gs = 40;
    const tl = this._s2w(0, 0), br = this._s2w(this.vw, this.vh);
    ctx.strokeStyle = 'rgba(201,168,76,0.06)'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = Math.floor(tl.x/gs)*gs; x <= br.x; x += gs) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
    for (let y = Math.floor(tl.y/gs)*gs; y <= br.y; y += gs) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
    ctx.stroke();
  },

  _drawNodes(ctx) {
    for (const c of this.chars) {
      if (c.x == null || c.y == null) continue;
      const sel = c.id === this.selNode, hov = c.id === this.hoverNode;
      const x = c.x - 90, y = c.y - 34;
      ctx.shadowColor = sel ? 'rgba(201,168,76,0.4)' : 'transparent';
      ctx.shadowBlur = sel ? 16 : 0;
      ctx.fillStyle = hov ? '#242418' : '#1a1a15';
      ctx.strokeStyle = sel ? '#c9a84c' : (hov ? '#a09050' : '#2a2818');
      ctx.lineWidth = sel ? 2 : 1;
      this._rr(ctx, x, y, 180, 68, 10);
      ctx.fill(); ctx.stroke();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      this._drawNodePortrait(ctx, c, x + 10, y + 10, 48);
      // Name
      ctx.fillStyle = '#c9a84c'; ctx.font = 'bold 14px "Microsoft YaHei"'; ctx.textAlign = 'left';
      ctx.fillText(this._fitText(ctx, c.name || '?', 104), x + 68, c.y - 9);
      // Role label
      const roleLabels = { protagonist:'主角', ally:'盟友', antagonist:'对手', neutral:'中立', other:'其他' };
      const roleText = roleLabels[c.role] || c.role || '未设定';
      const appeared = c.hasAppeared;
      ctx.fillStyle = appeared ? '#7cac60' : '#7a7060'; ctx.font = '11px "Microsoft YaHei"';
      ctx.fillText(roleText + (appeared ? '  已登场' : '  未登场'), x + 68, c.y + 13);
    }
  },

  _drawNodePortrait(ctx, c, x, y, size) {
    const roleColors = { protagonist:'#c9a84c', ally:'#6898c8', antagonist:'#c0392b', neutral:'#7cac60', other:'#888' };
    ctx.save();
    this._rr(ctx, x, y, size, size, 8);
    ctx.clip();
    const img = c.portraitUrl ? PortraitImageCache.get(c.portraitUrl) : null;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y, size, size);
    } else {
      const color = roleColors[c.role] || roleColors.other;
      ctx.fillStyle = '#10100e';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f3ead7';
      ctx.font = 'bold 20px "Microsoft YaHei"';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((c.name || '?').charAt(0), x + size / 2, y + size / 2 + 1);
    }
    ctx.restore();
    ctx.strokeStyle = roleColors[c.role] || roleColors.other;
    ctx.lineWidth = 1;
    this._rr(ctx, x, y, size, size, 8);
    ctx.stroke();
  },

  _fitText(ctx, text, maxWidth) {
    text = String(text || '');
    if (ctx.measureText(text).width <= maxWidth) return text;
    while (text.length > 1 && ctx.measureText(text + '...').width > maxWidth) {
      text = text.slice(0, -1);
    }
    return text + '...';
  },

  _drawEdges(ctx) {
    for (const r of this.rels) {
      const f = this.chars.find(c => c.id === r.from);
      const t = this.chars.find(c => c.id === r.to);
      if (!f || !t || f.x == null || t.x == null) continue;
      const color = REL_COLORS[r.type] || '#888';
      const hov = r.id === this.hoverEdge;
      const mid = this._bezMid(f, t, r);
      ctx.strokeStyle = hov ? '#e0c878' : color;
      ctx.lineWidth = hov ? 2.5 : 1.2;
      ctx.setLineDash(r.type === '暗恋' ? [4,4] : r.type === '利用' ? [2,3] : []);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(mid.x, mid.y, t.x, t.y); ctx.stroke();
      ctx.setLineDash([]);
      // Label
      const lx = (f.x + t.x) / 2 + (mid.x - (f.x+t.x)/2) * 0.3;
      const ly = (f.y + t.y) / 2 + (mid.y - (f.y+t.y)/2) * 0.3;
      ctx.font = '10px "Microsoft YaHei"';
      const tw = ctx.measureText(r.type).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      this._rr(ctx, lx - tw/2, ly - 7, tw, 14, 3); ctx.fill();
      ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.fillText(r.type, lx, ly + 1);
    }
  },

  _bezMid(f, t, r) {
    const dx = t.x - f.x, dy = t.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const idx = this.rels.filter(rr => (rr.from===r.from&&rr.to===r.to)||(rr.from===r.to&&rr.to===r.from)).indexOf(r);
    const off = (idx * 2 - 1) * 55;
    return {x: (f.x+t.x)/2 - dy/d*off, y: (f.y+t.y)/2 + dx/d*off};
  },

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  },

  // ===== INTERACTION =====
  _down(e) {
    const rect = this.cv.getBoundingClientRect();
    const ox = (e.clientX !== undefined ? e.clientX : e.offsetX) - rect.left;
    const oy = (e.clientY !== undefined ? e.clientY : e.offsetY) - rect.top;
    const w = this._s2w(ox, oy);
    const n = this._hitNode(w.x, w.y);
    if (this.connMode && n) {
      if (!this.connFrom) { this.connFrom = n.id; this.connLine = {x1:n.x,y1:n.y,x2:w.x,y2:w.y}; }
      else if (n.id !== this.connFrom) { this._addRel(this.connFrom, n.id); this.connFrom = null; this.connLine = null; }
      return;
    }
    if (n) { this.drag = {t:'n',id:n.id,ox:w.x-n.x,oy:w.y-n.y}; this.selNode = n.id; this.cv.style.cursor = 'grabbing'; return; }
    this.drag = {t:'p',sx:e.clientX,sy:e.clientY,cx:this.camX,cy:this.camY};
    this.cv.style.cursor = 'move';
  },

  _move(e) {
    const rect = this.cv.getBoundingClientRect();
    const ox = (e.clientX !== undefined ? e.clientX : e.offsetX) - rect.left;
    const oy = (e.clientY !== undefined ? e.clientY : e.offsetY) - rect.top;
    const w = this._s2w(ox, oy);
    if (!this.drag) {
      this.hoverNode = null; this.hoverEdge = null;
      const n = this._hitNode(w.x, w.y);
      if (n) { this.hoverNode = n.id; this.cv.style.cursor = 'grab'; return; }
      const e2 = this._hitEdge(w.x, w.y);
      if (e2) { this.hoverEdge = e2.id; this.cv.style.cursor = 'pointer'; return; }
      this.cv.style.cursor = this.connMode ? 'crosshair' : 'default';
      return;
    }
    if (this.drag.t === 'n') {
      const c = this.chars.find(c => c.id === this.drag.id);
      if (c) { c.x = w.x - this.drag.ox; c.y = w.y - this.drag.oy; }
      this.cv.style.cursor = 'grabbing';
    } else if (this.drag.t === 'p') {
      this.camX = this.drag.cx + (e.clientX - this.drag.sx);
      this.camY = this.drag.cy + (e.clientY - this.drag.sy);
    }
  },

  _zoom(e) {
    const rect = this.cv.getBoundingClientRect();
    const ox = (e.clientX !== undefined ? e.clientX : e.offsetX) - rect.left;
    const oy = (e.clientY !== undefined ? e.clientY : e.offsetY) - rect.top;
    const wb = this._s2w(ox, oy);
    this.scale = Math.max(0.1, Math.min(3, this.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    const wa = this._s2w(ox, oy);
    this.camX += (wa.x - wb.x) * this.scale;
    this.camY += (wa.y - wb.y) * this.scale;
    const zl = document.getElementById('char-zoom-label');
    if (zl) zl.textContent = Math.round(this.scale * 100) + '%';
  },

  _dbl(e) {
    const rect = this.cv.getBoundingClientRect();
    const ox = (e.clientX !== undefined ? e.clientX : e.offsetX) - rect.left;
    const oy = (e.clientY !== undefined ? e.clientY : e.offsetY) - rect.top;
    const w = this._s2w(ox, oy);
    const n = this._hitNode(w.x, w.y);
    if (n) this._openEdit(n);
  },

  _rclick(e) {
    const rect = this.cv.getBoundingClientRect();
    const ox = (e.clientX !== undefined ? e.clientX : e.offsetX) - rect.left;
    const oy = (e.clientY !== undefined ? e.clientY : e.offsetY) - rect.top;
    const w = this._s2w(ox, oy);
    const e2 = this._hitEdge(w.x, w.y);
    if (e2) {
      // 选中高亮 + 提示删除
      this.hoverEdge = e2.id;
      if (confirm('删除此关系连线？')) {
        this._delRel(e2.id);
        this.hoverEdge = null;
      }
    }
  },

  // Touch
  _tStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0]; const rect = this.cv.getBoundingClientRect();
      this._down({clientX: t.clientX, clientY: t.clientY, offsetX: t.clientX - rect.left, offsetY: t.clientY - rect.top});
    }
    this._tdist = e.touches.length === 2 ? Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY) : 0;
  },

  _tMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this.drag) {
      const t = e.touches[0]; const rect = this.cv.getBoundingClientRect();
      this._move({clientX: t.clientX, clientY: t.clientY, offsetX: t.clientX - rect.left, offsetY: t.clientY - rect.top});
    } else if (e.touches.length === 2 && this._tdist > 0) {
      const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      this.scale = Math.max(0.1, Math.min(3, this.scale * (d / this._tdist)));
      this._tdist = d;
      const zl = document.getElementById('char-zoom-label');
      if (zl) zl.textContent = Math.round(this.scale * 100) + '%';
    }
  },

  // ===== ACTIONS =====
  addCharacter(name = '新角色', role = 'ally') {
    const c = {
      id: this._nextCharId(), name, role, hasAppeared: false,
      appearance: '', personality: '', bg: '', ability: '', goal: '', notes: '',
      x: (Math.random() - 0.5) * 400 + (this.vw/2 - this.camX) / this.scale,
      y: (Math.random() - 0.5) * 300 + (this.vh/2 - this.camY) / this.scale
    };
    this.chars.push(c);
    this.selNode = c.id;
    this._openEdit(c);
    if (GameEngine.state.gameStarted) AnnotationEngine.rebuildTerms();
  },

  _addRel(fromId, toId, type) {
    if (fromId === toId) return;
    if (this.rels.find(r => (r.from===fromId&&r.to===toId) || (r.from===toId&&r.to===fromId))) {
      UIManager.toast('已存在关系连线', 'warning');
      return;
    }
    // 如果未指定类型，弹出选择框
    if (!type) {
      const fromChar = this.chars.find(c => c.id === fromId);
      const toChar = this.chars.find(c => c.id === toId);
      const fromName = fromChar ? fromChar.name : '?';
      const toName = toChar ? toChar.name : '?';
      const options = REL_TYPES.map(t => `${t}`).join(' / ');
      const input = prompt(`设置「${fromName} → ${toName}」的关系类型\n可选：${options}`, '朋友');
      if (input === null) return; // 取消
      type = REL_TYPES.includes(input.trim()) ? input.trim() : '自定义';
    }
    this.rels.push({ id: this._nextRelId(), from: fromId, to: toId, type, description: '' });
    // 同步到 player.relations（如果涉及主角）
    CharacterBioManager._syncToPlayerRelations();
    UIManager.toast(`已添加关系：${type}`, 'success');
  },

  _delRel(id) { GameEngine.state.characterRelations = this.rels.filter(r => r.id !== id); },

  deleteCharacter() {
    if (!this._editingId) return;
    const id = this._editingId;
    const char = this.chars.find(c => c.id === id);
    const charName = char ? char.name : null;
    GameEngine.state.characterRelations = this.rels.filter(r => r.from !== id && r.to !== id);
    GameEngine.state.characterBios = this.chars.filter(c => c.id !== id);
    this.selNode = null; this._editingId = null;
    this.closeEdit();
    if (GameEngine.state.gameStarted) AnnotationEngine.rebuildTerms();
    // 同步删除 player.relations 中的对应项
    if (charName && GameEngine.state.player && GameEngine.state.player.relations) {
      delete GameEngine.state.player.relations[charName];
      if (GameEngine.state.player._charDetails) delete GameEngine.state.player._charDetails[charName];
      CharacterBioManager._syncToPlayerRelations();
    }
    // 刷新左侧人物列表
    if (typeof CharListPanel !== 'undefined') CharListPanel.render();
    // 刷新右侧面板
    if (typeof UIManager !== 'undefined') UIManager.updateAllStatus();
  },

  toggleConnectMode() {
    this.connMode = !this.connMode;
    this.connFrom = null; this.connLine = null;
    document.getElementById('btn-char-conn').classList.toggle('active', this.connMode);
  },

  // ===== EDIT PANEL =====
  _openEdit(c) {
    this._editingId = c.id;
    const P = id => document.getElementById(id);
    P('cep-title').textContent = '编辑：' + c.name;
    P('cep-name').value = c.name || '';
    P('cep-role').value = c.role || 'ally';
    P('cep-appeared').checked = !!c.hasAppeared;
    P('cep-appeared-text').textContent = c.hasAppeared ? '✅ 已登场' : '⏳ 未登场';
    P('cep-appeared-text').style.color = c.hasAppeared ? 'var(--success)' : 'var(--text-dim)';
    P('cep-show-in-panel').checked = !!c.showInPanel;
    P('cep-appearance').value = c.appearance || '';
    P('cep-personality').value = c.personality || '';
    P('cep-bg').value = c.bg || '';
    P('cep-ability').value = c.ability || '';
    P('cep-goal').value = c.goal || '';
    P('cep-notes').value = c.notes || '';
    // 贴图预览
    this._renderPortraitPreview(c);
    document.getElementById('char-edit-panel').classList.add('open');
  },

  /** 渲染贴图预览 */
  _renderPortraitPreview(c) {
    const el = document.getElementById('cep-portrait-preview');
    if (!el) return;
    if (c.portrait) {
      el.innerHTML = c.portrait;
    } else {
      // 默认生成一个占位头像
      el.innerHTML = this._generateFallbackPortrait(c);
    }
  },

  /** 生成基于角色信息的占位 SVG 头像 */
  _generateFallbackPortrait(c) {
    const name = c.name || '?';
    const initial = name.charAt(0) || '?';
    // 根据角色类型选色
    const colorMap = {
      protagonist: '#c9a84c',
      ally: '#6898c8',
      antagonist: '#c0392b',
      neutral: '#7cac60',
      other: '#888',
    };
    const bg = colorMap[c.role] || '#444';
    const hash = (name.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 360;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="g${hash}" cx="50%" cy="35%">
        <stop offset="0%" stop-color="${bg}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#1a1815" stop-opacity="1"/>
      </radialGradient></defs>
      <rect width="100" height="100" fill="url(#g${hash})"/>
      <circle cx="50" cy="38" r="18" fill="rgba(255,255,255,0.15)" stroke="${bg}" stroke-width="1"/>
      <text x="50" y="46" text-anchor="middle" fill="#fff" font-size="22" font-weight="bold" font-family="Microsoft YaHei">${initial}</text>
      <text x="50" y="80" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9" font-family="Microsoft YaHei">${name.length > 5 ? name.slice(0,4)+'..' : name}</text>
    </svg>`;
  },

  /** AI 生成人物贴图（调用服务端生图 API，产出动漫风格画像）*/
  async generatePortrait(c) {
    // 支持传入角色对象（批量生成）或使用 _editingId（手动按钮）
    var char = c || (this._editingId ? this.chars.find(function(ch) { return ch.id === this._editingId; }.bind(this)) : null);
    if (!char) return null;
    var btn = (typeof event !== 'undefined' && event) ? event.target : null;
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '⏳ 生成中...'; btn.disabled = true; }

    try {
      var gs = window.GameEngine.state;
      var payload = {
        name: char.name || '',
        role: char.role || '',
        appearance: char.appearance || '',
        personality: char.personality || '',
        bg: char.bg || '',
        genre: gs.genre || '',
        worldName: gs.worldName || ''
      };

      var resp = await fetch('/api/generate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var result = await resp.json();

      if (result.ok) {
        var safeName = (char.name || '').replace(/"/g, '&quot;');
        var imgUrl = result.url;
        char.portrait = '<img src="' + imgUrl + '" alt="' + safeName + '" style="width:100%;height:100%;object-fit:contain;">';
        char.portraitUrl = imgUrl;
        if (this._editingId === char.id) this._renderPortraitPreview(char);
        if (typeof UIManager !== 'undefined') UIManager.toast(result.cached ? '已加载缓存画像' : '画像生成完成!', 'success');
        return char.portrait;
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch(e) {
      console.error('Generate portrait failed:', e);
      char.portrait = this._generateFallbackPortrait(char);
      if (this._editingId === char.id) this._renderPortraitPreview(char);
      if (typeof UIManager !== 'undefined') UIManager.toast('画像生成失败: ' + e.message, 'error');
      return null;
    } finally {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
    }
  },

  /** 清除贴图 */
  clearPortrait() {
    if (!this._editingId) return;
    const c = this.chars.find(ch => ch.id === this._editingId);
    if (!c) return;
    c.portrait = null;
    c.portraitUrl = null;
    c.portraitDesc = null;
    this._renderPortraitPreview(c);
    UIManager.toast('贴图已清除', 'info');
  },

  /** 根据关键词字符串构建 SVG 贴图（简化版）*/
  _buildPortraitSVG(c, keywords) {
    var name = c.name || '?';
    var initial = name.charAt(0) || '?';
    var colorMap = {
      protagonist: { bg: '#3a2d18', accent: '#c9a84c' },
      ally: { bg: '#1a2a3a', accent: '#6898c8' },
      antagonist: { bg: '#3a1818', accent: '#c0392b' },
      neutral: { bg: '#1a2a18', accent: '#7cac60' },
      other: { bg: '#2a2a2a', accent: '#888' },
    };
    var colors = colorMap[c.role] || colorMap.other;
    // 从关键词中提取头发色
    var kw = (keywords || '').toLowerCase();
    var hairColor = colors.accent;
    if (kw.includes('black hair') || kw.includes('黑发')) hairColor = '#1a1a1a';
    else if (kw.includes('white hair') || kw.includes('silver hair') || kw.includes('银发') || kw.includes('白发')) hairColor = '#e8e8e8';
    else if (kw.includes('gold') || kw.includes('blond') || kw.includes('金发')) hairColor = '#d4a040';
    else if (kw.includes('red hair') || kw.includes('红发')) hairColor = '#a04030';
    else if (kw.includes('blue hair') || kw.includes('蓝发')) hairColor = '#4060a0';
    else if (kw.includes('purple') || kw.includes('紫发')) hairColor = '#7040a0';
    else if (kw.includes('brown') || kw.includes('棕')) hairColor = '#6b4c30';
    // 眼睛色
    var eyeColor = '#e8e8e8';
    if (kw.includes('amber') || kw.includes('golden eye') || kw.includes('金瞳')) eyeColor = '#d4a040';
    else if (kw.includes('blue eye') || kw.includes('蓝瞳')) eyeColor = '#4080c0';
    else if (kw.includes('red eye') || kw.includes('红瞳')) eyeColor = '#c04040';
    else if (kw.includes('green eye') || kw.includes('绿瞳')) eyeColor = '#60a060';
    else if (kw.includes('purple eye') || kw.includes('紫瞳')) eyeColor = '#a060c0';
    else if (kw.includes('dark eye') || kw.includes('black eye') || kw.includes('黑瞳')) eyeColor = '#404040';
    // 性别判断
    var isFemale = (c.personality || '').includes('女') || ['娘','姐','妹','女','姬','仙子','夫人','妃'].some(function(s) { return (name || '').includes(s); });
    if (kw.includes('female') || kw.includes('woman') || kw.includes('girl') || kw.includes('女性')) isFemale = true;
    if (kw.includes('male') || kw.includes('man') || kw.includes('男性')) isFemale = false;
    var hairLen = kw.includes('long hair') || kw.includes('长发') ? 35 : 22;
    var hash = Math.abs((name || '').split('').reduce(function(a, ch) { return a + ch.charCodeAt(0) * 31; }, 0));
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '<radialGradient id="bg' + hash + '" cx="50%" cy="40%" r="60%">' +
      '<stop offset="0%" stop-color="' + colors.bg + '" stop-opacity="0.6"/>' +
      '<stop offset="100%" stop-color="#0a0a08" stop-opacity="1"/>' +
      '</radialGradient>' +
      '<linearGradient id="hair' + hash + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
      '<stop offset="0%" stop-color="' + hairColor + '"/>' +
      '<stop offset="100%" stop-color="' + hairColor + '" stop-opacity="0.7"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect width="100" height="100" fill="url(#bg' + hash + ')"/>' +
      '<ellipse cx="50" cy="' + (50 - hairLen/2) + '" rx="28" ry="' + hairLen + '" fill="url(#hair' + hash + ')" opacity="0.85"/>' +
      '<ellipse cx="50" cy="48" rx="20" ry="24" fill="#e8d4b8"/>' +
      '<path d="M 30 ' + (48 - hairLen/2) + ' Q 50 ' + (28 - hairLen/2) + ' 70 ' + (48 - hairLen/2) + ' L 70 38 Q 50 30 30 38 Z" fill="url(#hair' + hash + ')"/>' +
      '<ellipse cx="42" cy="48" rx="3" ry="4" fill="' + eyeColor + '"/>' +
      '<ellipse cx="58" cy="48" rx="3" ry="4" fill="' + eyeColor + '"/>' +
      '<circle cx="42" cy="48" r="1.5" fill="#000"/>' +
      '<circle cx="58" cy="48" r="1.5" fill="#000"/>' +
      '<path d="M 45 60 Q 50 ' + (isFemale ? '62' : '63') + ' 55 60" stroke="#a06060" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M 30 78 L 50 72 L 70 78 L 70 100 L 30 100 Z" fill="' + colors.bg + '" stroke="' + colors.accent + '" stroke-width="0.8"/>' +
      '<circle cx="50" cy="48" r="32" fill="none" stroke="' + colors.accent + '" stroke-width="0.6" opacity="0.4"/>' +
      '<text x="50" y="94" text-anchor="middle" fill="' + colors.accent + '" font-size="8" font-family="Microsoft YaHei" opacity="0.9">' + (name.length > 6 ? name.slice(0,5)+'..' : name) + '</text>' +
      '</svg>';
  },

  closeEdit() {
    this._editingId = null;
    document.getElementById('char-edit-panel').classList.remove('open');
  },

  saveEdit() {
    const c = this.chars.find(c => c.id === this._editingId);
    if (!c) return;
    const G = id => document.getElementById(id).value.trim();
    c.name = G('cep-name') || c.name;
    c.role = document.getElementById('cep-role').value;
    c.hasAppeared = document.getElementById('cep-appeared').checked;
    c.showInPanel = document.getElementById('cep-show-in-panel').checked;
    c.appearance = G('cep-appearance');
    c.personality = G('cep-personality');
    c.bg = G('cep-bg');
    c.ability = G('cep-ability');
    c.goal = G('cep-goal');
    c.notes = G('cep-notes');
    this.closeEdit();
    if (GameEngine.state.gameStarted) AnnotationEngine.rebuildTerms();
    // 同步到 player.relations（右侧人际关系面板）
    CharacterBioManager._syncToPlayerRelations();
    // 刷新左侧人物列表
    if (typeof CharListPanel !== 'undefined') CharListPanel.render();
    // 刷新右侧面板
    if (typeof UIManager !== 'undefined') UIManager.updateAllStatus();
  },

  // ===== AI GENERATION =====
  async aiGenerate() {
    const keyword = window.prompt('输入世界观关键词或小说设定，AI 将生成人物关系图：',
      '修仙世界，正魔对立，主角是落魄门派传人');
    if (!keyword) return;

    const btn = document.querySelector('#char-bio-toolbar button:nth-child(5)');
    const origText = btn.textContent;
    btn.textContent = '⏳ 生成中...'; btn.disabled = true;

    try {
      let result;
      if (typeof AIBridge !== 'undefined' && AIBridge.isConfigured()) {
        result = await AIBridge.generateCharacterRelations(keyword);
      } else {
        result = await this._aiFallback(keyword);
      }
      this._applyAIData(result);
    } catch(e) {
      UIManager.toast('AI生成失败：' + e.message, 'error');
      console.error('CharGraph AI gen error:', e);
    }
    btn.textContent = origText; btn.disabled = false;
  },

  // v4.0.1: AI 补全当前编辑中人物的空白字段
  async aiFillCharacter() {
    var name = document.getElementById('cep-name').value.trim();
    if (!name) { UIManager.toast('请先输入人物姓名', 'warning'); return; }

    var overwrite = document.getElementById('cep-ai-overwrite').checked;
    var gs = window.GameEngine.state;
    var genre = gs.genre || '未知';
    var worldName = gs.worldName || '未知';

    // 收集已有字段
    var existing = {
      appearance: document.getElementById('cep-appearance').value.trim(),
      personality: document.getElementById('cep-personality').value.trim(),
      bg: document.getElementById('cep-bg').value.trim(),
      ability: document.getElementById('cep-ability').value.trim(),
      goal: document.getElementById('cep-goal').value.trim(),
      notes: document.getElementById('cep-notes').value.trim()
    };

    // 非覆盖模式：只补空字段
    var fieldsToFill = [];
    if (overwrite || !existing.appearance) fieldsToFill.push('appearance');
    if (overwrite || !existing.personality) fieldsToFill.push('personality');
    if (overwrite || !existing.bg) fieldsToFill.push('bg');
    if (overwrite || !existing.ability) fieldsToFill.push('ability');
    if (overwrite || !existing.goal) fieldsToFill.push('goal');

    if (fieldsToFill.length === 0) {
      UIManager.toast('所有字段已填写，勾选「覆盖已有」可重新生成', 'info');
      return;
    }

    var btn = document.getElementById('cep-ai-fill-btn');
    var origText = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ 补全中...';

    try {
      var result = await AIBridge.fillCharacterFields(name, genre, worldName, existing, fieldsToFill, overwrite);
      if (!result) { UIManager.toast('AI 未返回有效结果', 'error'); return; }

      if (result.appearance !== undefined) document.getElementById('cep-appearance').value = result.appearance;
      if (result.personality !== undefined) document.getElementById('cep-personality').value = result.personality;
      if (result.bg !== undefined) document.getElementById('cep-bg').value = result.bg;
      if (result.ability !== undefined) document.getElementById('cep-ability').value = result.ability;
      if (result.goal !== undefined) document.getElementById('cep-goal').value = result.goal;

      UIManager.toast('AI 补全完成（' + fieldsToFill.length + ' 个字段）', 'success');
    } catch(e) {
      UIManager.toast('AI 补全失败：' + e.message, 'error');
      console.error('[aiFillCharacter] error:', e);
    } finally {
      btn.disabled = false; btn.textContent = origText;
    }
  },

  async _aiFallback(keyword) {
    if (typeof AIBridge !== 'undefined') {
      let apiKey = AIBridge._apiKey || '';
      if (!apiKey) {
        // 尝试从 localStorage 直接读取
        const saved = localStorage.getItem('if-api-config');
        if (saved) {
          try { const c = JSON.parse(saved); apiKey = c.api_key || ''; } catch(e) {}
        }
      }
      if (!apiKey) throw new Error('未配置 API Key');
      const system = `你是小说角色关系设计师。根据用户提供的关键词，生成5-8个人物及其关系。
返回严格JSON格式（只返回JSON，不要任何其他文字）：
{"characters":[{"name":"","role":"","description":"","traits":[],"appearance":"","background":""}],
 "relationships":[{"from":"角色名1","to":"角色名2","type":"师徒|恋人|亲人|朋友|仇敌|同门|同盟|暗恋|利用|敌对|主仆","description":""}]}
类型从以下选：${REL_TYPES.join('、')}`;
      // 改用 AIBridge，通过 Flask 代理调用，避免 WebView2 直接外网 fetch 挂起
      const prompt = `${system}\n\n用户需求：${keyword}`;
      const text = await AIBridge.generate(prompt, { maxTokens: 2000, temperature: 0.8 });
      return this._parseAIResponse(text);
    }
    throw new Error('未配置 API，请先在主页面配置 DeepSeek API');
  },

  _parseAIResponse(text) {
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(clean); } catch(e) {}
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0]); } catch(e) {}
    throw new Error('AI 返回格式无法解析');
  },

  _applyAIData(data) {
    if (!data || !data.characters) return;
    const nameMap = {};
    const gs = GameEngine.state;
    // Preserve existing characters — merge AI-generated ones
    for (let i = 0; i < data.characters.length; i++) {
      const cd = data.characters[i];
      // Map AI role to our role system
      const roleMap = {'主角':'protagonist','盟友':'ally','同伴':'ally','朋友':'ally','对手':'antagonist','反派':'antagonist','中立':'neutral','其他':'other'};
      const role = roleMap[cd.role] || 'ally';
      const angle = (i / data.characters.length) * Math.PI * 2;
      const r = 200 + Math.random() * 100;
      const c = {
        id: this._nextCharId(),
        name: cd.name, role, hasAppeared: false,
        appearance: cd.appearance || '', personality: (cd.traits || []).join('、'),
        bg: cd.background || '', ability: '', goal: '',
        notes: cd.description || '',
        x: Math.cos(angle) * r + (this.vw/2 - this.camX) / this.scale,
        y: Math.sin(angle) * r + (this.vh/2 - this.camY) / this.scale
      };
      this.chars.push(c);
      nameMap[cd.name] = c.id;
    }
    // Add relationships
    if (data.relationships) {
      for (const rd of data.relationships) {
        const fromId = nameMap[rd.from];
        const toId = nameMap[rd.to];
        if (fromId && toId && fromId !== toId) {
          this.rels.push({ id: this._nextRelId(), from: fromId, to: toId,
            type: REL_TYPES.includes(rd.type) ? rd.type : '自定义', description: rd.description || '' });
        }
      }
    }
    this.autoLayout();
  },

  // ===== LAYOUT =====
  autoLayout() {
    if (this.chars.length === 0) {
      UIManager.toast('画布上没有人物', 'warning');
      return;
    }
    console.log('[autoLayout] start, chars:', this.chars.length, 'rels:', this.rels.length);
    // 主角固定在中心
    const protagonist = this.chars.find(c => c.role === 'protagonist');
    if (protagonist) { protagonist.x = 0; protagonist.y = 0; }

    // 给没有坐标的节点分配初始位置（圆形布局）
    const others = this.chars.filter(c => c !== protagonist);
    others.forEach((c, i) => {
      if (c.x == null || c.y == null) {
        const angle = (i / Math.max(others.length, 1)) * Math.PI * 2;
        c.x = Math.cos(angle) * 200;
        c.y = Math.sin(angle) * 200;
      }
    });

    // 力导向布局（限制主角不动）
    for (let iter = 0; iter < 30; iter++) {
      for (const c of this.chars) {
        if (c === protagonist) continue; // 主角固定
        let fx = 0, fy = 0;
        for (const o of this.chars) {
          if (o.id === c.id) continue;
          const dx = c.x - o.x, dy = c.y - o.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          const force = 5000 / (d * d);
          fx += dx / d * force; fy += dy / d * force;
        }
        for (const r of this.rels) {
          let other = null;
          if (r.from === c.id) other = this.chars.find(ch => ch.id === r.to);
          else if (r.to === c.id) other = this.chars.find(ch => ch.id === r.from);
          if (!other) continue;
          const dx = other.x - c.x, dy = other.y - c.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          fx += dx / d * (d - 200) * 0.01;
          fy += dy / d * (d - 200) * 0.01;
        }
        // 限制位移，避免节点飞太远
        const maxStep = 30;
        const step = Math.min(maxStep, Math.hypot(fx, fy) * 0.1);
        const norm = Math.max(0.001, Math.hypot(fx, fy));
        c.x += (fx / norm) * step;
        c.y += (fy / norm) * step;
      }
    }

    // 居中并自动缩放使所有节点可见
    this._autoFitView();
    console.log('[autoLayout] done, scale:', this.scale, 'camX:', this.camX, 'camY:', this.camY);
    UIManager.toast('已重新布局', 'success');
  },

  // ===== VIEW =====
  zoomIn() { this.scale = Math.min(3, this.scale * 1.2); document.getElementById('char-zoom-label').textContent = Math.round(this.scale * 100) + '%'; },
  zoomOut() { this.scale = Math.max(0.1, this.scale * 0.8); document.getElementById('char-zoom-label').textContent = Math.round(this.scale * 100) + '%'; },
  resetView() { this.camX = 0; this.camY = 0; this.scale = 1; document.getElementById('char-zoom-label').textContent = '100%'; },

  // ===== EXPORT/IMPORT =====
  exportData() {
    const data = { version: '3.5', chars: this.chars, rels: this.rels };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = '人物关系_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
  },

  importData() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          // Merge or replace
          if (data.chars) {
            const gs = GameEngine.state;
            gs.characterBios = data.chars;
            gs.characterRelations = data.rels || [];
            this.autoLayout();
          }
        } catch(ex) { alert('导入失败：' + ex.message); }
      };
      reader.readAsText(f);
    };
    input.click();
  },

  clearAll() {
    if (!confirm('确定清空全部人物和关系？此操作不可撤销。')) return;
    GameEngine.state.characterBios = [];
    GameEngine.state.characterRelations = [];
    this.selNode = null; this._editingId = null;
    this.closeEdit();
  },
};

// =============================================
// CharacterBioManager — 兼容接口
// =============================================
var CharacterBioManager = {
  _currentId: null,

  show() {
    const gs = GameEngine.state;
    if (!gs.characterBios) gs.characterBios = [];
    if (!gs.characterRelations) gs.characterRelations = [];
    // v4.0: 打开全屏画布前同步 player.relations
    if (CharacterBioManager._syncFromPlayerRelations) {
      try { CharacterBioManager._syncFromPlayerRelations(); } catch(e) { console.warn('[show] sync failed:', e); }
    }
    this._currentId = null;
    // 先显示 modal，再 resize——否则 display:none 时 canvas 尺寸为 0
    document.getElementById('char-bio-modal').classList.remove('hidden');
    // 渲染左侧人物列表
    if (typeof CharListPanel !== 'undefined') CharListPanel.render();
    // 等浏览器完成布局后再初始化画布
    requestAnimationFrame(() => {
      CharGraph.show();
    });
  },

  close() {
    CharGraph.hide();
    document.getElementById('char-bio-modal').classList.add('hidden');
  },

  addCharacter() {
    CharGraph.addCharacter();
  },

  deleteCharacter(id) {
    if (id) {
      CharGraph._editingId = id;
      CharGraph.deleteCharacter();
    }
  },

  selectCharacter(id) {
    const c = GameEngine.state.characterBios?.find(x => x.id === id);
    if (c) { CharGraph.selNode = id; CharGraph._openEdit(c); }
  },

  /** Build a text summary of all character bios for AI prompts */
  buildContext() {
    const gs = GameEngine.state;
    const bios = gs.characterBios || [];
    const rels = gs.characterRelations || [];
    if (!bios.length) return '';
    const roleNames = { protagonist: '主角', ally: '盟友', antagonist: '对手', neutral: '中立', other: '其他' };
    let text = bios.map(c => {
      const lines = [`【${roleNames[c.role] || '角色'}：${c.name}】`];
      if (c.appearance) lines.push(`外貌：${c.appearance}`);
      if (c.personality) lines.push(`性格：${c.personality}`);
      if (c.bg) lines.push(`背景：${c.bg}`);
      if (c.ability) lines.push(`能力：${c.ability}`);
      if (c.goal) lines.push(`目标：${c.goal}`);
      if (c.notes) lines.push(`备注：${c.notes}`);
      return lines.join('\n');
    }).join('\n\n');
    // Append relationship info
    if (rels.length) {
      text += '\n\n【人物关系】\n';
      for (const r of rels) {
        const f = bios.find(c => c.id === r.from);
        const t = bios.find(c => c.id === r.to);
        if (f && t) text += `${f.name} → ${t.name}：${r.type}${r.description ? '（'+r.description+'）' : ''}\n`;
      }
    }
    return text;
  },

  // Called by game-engine after AI response to update character data
  _updateFromAI(newChars) {
    if (!newChars || !newChars.length) return;
    const gs = GameEngine.state;
    if (!gs.characterBios) gs.characterBios = [];
    if (!gs.characterRelations) gs.characterRelations = [];
    newChars.forEach(char => {
      const existing = gs.characterBios.find(c => c.name === char.name);
      if (existing) {
        existing.hasAppeared = true;
        const newNotes = [];
        if (char.relation && !existing.notes.includes(char.relation)) newNotes.push(`关系：${char.relation}`);
        const appearanceChanged = char.appearance && !existing.appearance;
        if (char.appearance && !existing.appearance) existing.appearance = char.appearance;
        if (char.personality && !existing.personality) existing.personality = char.personality;
        if (char.notes && !existing.notes.includes(char.notes)) newNotes.push(char.notes);
        if (newNotes.length) existing.notes = (existing.notes ? existing.notes + '\n' : '') + newNotes.join('\n');
        // Ensure position
        if (existing.x == null || existing.y == null) {
          existing.x = (Math.random() - 0.5) * 400 + (CharGraph.vw/2 - CharGraph.camX) / (CharGraph.scale || 1);
          existing.y = (Math.random() - 0.5) * 300 + (CharGraph.vh/2 - CharGraph.camY) / (CharGraph.scale || 1);
        }
        // v4.0: 如果外貌有显著变化且没有贴图，自动生成贴图（跟随剧情变化）
        if (appearanceChanged && !existing.portrait && existing.appearance) {
          existing.portrait = CharGraph._buildPortraitSVG(existing, null);
        }
      } else {
        const newBio = {
          id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
          name: char.name, role: 'ally', hasAppeared: true,
          appearance: char.appearance || '', personality: char.personality || '',
          bg: '', ability: '', goal: '',
          notes: [char.relation ? `关系：${char.relation}` : '', char.notes || ''].filter(Boolean).join('\n'),
          x: (Math.random() - 0.5) * 400 + (CharGraph.vw/2 - CharGraph.camX) / (CharGraph.scale || 1),
          y: (Math.random() - 0.5) * 300 + (CharGraph.vh/2 - CharGraph.camY) / (CharGraph.scale || 1),
        };
        // 新人物自动生成默认贴图
        newBio.portrait = CharGraph._generateFallbackPortrait(newBio);
        gs.characterBios.push(newBio);
      }
    });
    // AI 更新后同步到 player.relations
    this._syncToPlayerRelations();
    // 刷新左侧人物列表
    if (typeof CharListPanel !== 'undefined') CharListPanel.render();
  },

  /**
   * 双向同步：characterBios ↔ player.relations
   * 1. 画布上有但 player.relations 没有 → 补入 player.relations
   * 2. player.relations 有但画布上没有 → 在画布上创建节点
   * 3. 根据 characterRelations 连线类型，推断亲密度
   */
  _syncToPlayerRelations() {
    const gs = GameEngine.state;
    if (!gs.player || !gs.player.relations) return;
    const p = gs.player;
    const bios = gs.characterBios || [];
    const rels = gs.characterRelations || [];

    // 1. 画布人物 → player.relations
    bios.forEach(c => {
      if (c.name && c.name !== p.name && p.relations[c.name] === undefined) {
        // 根据角色类型给初始亲密度
        let initVal = 0;
        if (c.role === 'ally') initVal = 20;
        else if (c.role === 'antagonist') initVal = -20;
        else if (c.role === 'protagonist') initVal = 0; // 主角自己跳过
        p.relations[c.name] = initVal;
      }
      // 同步详细信息到 _charDetails
      if (c.name && c.name !== p.name) {
        if (!p._charDetails) p._charDetails = {};
        if (!p._charDetails[c.name] || c.notes) {
          p._charDetails[c.name] = {
            intimacy: p.relations[c.name] || 0,
            relation: this._roleToRelationLabel(c.role),
            background: c.bg || c.notes || '',
          };
        }
      }
    });

    // 2. player.relations → 画布节点（补缺失的）
    Object.keys(p.relations).forEach(name => {
      if (name === '_charDetails' || name === p.name) return;
      if (!bios.find(c => c.name === name)) {
        const detail = (p._charDetails || {})[name] || {};
        const val = p.relations[name];
        // 推断角色类型
        let role = 'other';
        if (val >= 30) role = 'ally';
        else if (val <= -10) role = 'antagonist';
        bios.push({
          id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: name,
          role: role,
          hasAppeared: true,
          appearance: '', personality: '', bg: detail.background || '', ability: '', goal: '',
          notes: detail.relation ? `关系：${detail.relation}` : '',
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 300,
        });
      }
    });

    // 3. 根据 characterRelations 连线，更新亲密度（如果关系类型变了）
    rels.forEach(r => {
      const fromChar = bios.find(c => c.id === r.from);
      const toChar = bios.find(c => c.id === r.to);
      if (!fromChar || !toChar) return;
      // 只处理涉及主角的关系
      if (fromChar.name === p.name || toChar.name === p.name) {
        const otherName = fromChar.name === p.name ? toChar.name : fromChar.name;
        const val = this._relationTypeToIntimacy(r.type);
        if (val !== null && p.relations[otherName] !== undefined) {
          // 不覆盖，只调整方向（如果亲密度符号不对）
          const cur = p.relations[otherName];
          if (val < 0 && cur > 0) p.relations[otherName] = -Math.abs(cur);
          else if (val > 0 && cur < 0) p.relations[otherName] = Math.abs(cur);
        }
      }
    });

    // 刷新右侧面板
    if (typeof UIManager !== 'undefined' && UIManager.updateAllStatus) {
      UIManager.updateAllStatus();
    }
  },

  /** 角色类型 → 关系标签 */
  _roleToRelationLabel(role) {
    const map = { protagonist: '主角', ally: '盟友', antagonist: '对手', neutral: '中立', other: '其他' };
    return map[role] || '路人';
  },

  /** 关系类型 → 亲密度方向（正/负/null） */
  _relationTypeToIntimacy(type) {
    const positive = ['师徒', '恋人', '亲人', '朋友', '同门', '同盟', '暗恋'];
    const negative = ['仇敌', '利用', '敌对'];
    if (positive.includes(type)) return 1;
    if (negative.includes(type)) return -1;
    if (type === '主仆') return 0;
    return null;
  },

  /** 从 player.relations 单向同步到画布（供 game-engine 调用） */
  _syncFromPlayerRelations() {
    const gs = GameEngine.state;
    if (!gs.player) {
      console.log('[syncFromPlayerRelations] no player, skip');
      return;
    }
    const p = gs.player;
    if (!gs.characterBios) gs.characterBios = [];
    if (!gs.characterRelations) gs.characterRelations = [];
    const bios = gs.characterBios;

    // 0. 确保主角节点存在（画布中心）
    const playerName = p.name || '主角';
    let protagonist = bios.find(c => c.name === playerName || c.role === 'protagonist');
    if (!protagonist) {
      protagonist = {
        id: 'c_protagonist',
        name: playerName,
        role: 'protagonist',
        hasAppeared: true,
        appearance: p.appearance || '',
        personality: p.personality || '',
        bg: p.background || '',
        ability: p.ability || '',
        goal: p.goal || '',
        notes: '主角',
        x: 0, y: 0,
      };
      bios.unshift(protagonist);
      console.log('[syncFromPlayerRelations] 主角节点已创建:', playerName);
    } else {
      // 更新主角信息
      protagonist.role = 'protagonist';
      if (!protagonist.x && !protagonist.y) { protagonist.x = 0; protagonist.y = 0; }
    }

    // 0.5 给已有但没有坐标的 characterBios 分配坐标（圆形布局，主角在中心）
    let fixedCoords = 0;
    const others = bios.filter(c => c !== protagonist);
    others.forEach((c, i) => {
      if (c.x == null || c.y == null) {
        const angle = (i / Math.max(others.length, 1)) * Math.PI * 2;
        c.x = Math.cos(angle) * 200;
        c.y = Math.sin(angle) * 200;
        fixedCoords++;
      }
    });

    // 1. player.relations → 画布节点（补缺失的）
    let added = 0;
    if (p.relations) {
      Object.keys(p.relations).forEach(name => {
        if (name === '_charDetails' || name === playerName) return;
        if (!bios.find(c => c.name === name)) {
          const detail = (p._charDetails || {})[name] || {};
          const val = p.relations[name];
          let role = 'other';
          if (val >= 30) role = 'ally';
          else if (val <= -10) role = 'antagonist';
          const idx = others.length + added;
          const angle = (idx / 10) * Math.PI * 2;
          bios.push({
            id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: name,
            role: role,
            hasAppeared: true,
            appearance: '', personality: '', bg: detail.background || '', ability: '', goal: '',
            notes: detail.relation ? `关系：${detail.relation}` : '',
            x: Math.cos(angle) * 200,
            y: Math.sin(angle) * 200,
          });
          added++;
        }
      });
    }
    console.log('[syncFromPlayerRelations] done:', {
      playerName: playerName,
      playerRelations: p.relations ? Object.keys(p.relations).filter(k => k !== '_charDetails').length : 0,
      characterBios: bios.length,
      added: added,
      fixedCoords: fixedCoords
    });
  },
};

// =============================================
// CharGraphPanel — 右侧面板内嵌迷你关系图
// =============================================
var CharGraphPanel = {
  cv: null, ctx: null, wrap: null,
  camX: 0, camY: 0, scale: 1,
  _expanded: false,
  _loopId: null,

  get chars() { return GameEngine.state.characterBios || []; },
  get rels() { return GameEngine.state.characterRelations || []; },

  init() {
    this.cv = document.getElementById('char-panel-canvas');
    if (!this.cv) return;
    this.ctx = this.cv.getContext('2d');
    this.wrap = document.getElementById('char-panel-canvas-wrap');
    // 双击打开全屏modal
    this.cv.addEventListener('dblclick', () => CharacterBioManager.show());
    // 滚轮缩放
    this.cv.addEventListener('wheel', e => { e.preventDefault(); this._zoom(e); }, {passive:false});
    // 点击节点也打开全屏（并选中该角色）
    this.cv.addEventListener('mousedown', e => this._onClick(e));
    // 触摸支持
    this.cv.addEventListener('touchstart', e => { e.preventDefault(); this._onClick({ offsetX: e.touches[0].clientX - this.cv.getBoundingClientRect().left, offsetY: e.touches[0].clientY - this.cv.getBoundingClientRect().top }); }, {passive:false});
  },

  toggleExpand() {
    this._expanded = !this._expanded;
    const wrap = this.wrap;
    const btn = document.getElementById('char-panel-toggle');
    if (this._expanded) {
      wrap.style.display = 'block';
      if (btn) btn.textContent = '▲';
      // 强制重排，确保 getBoundingClientRect 返回正确尺寸
      void wrap.offsetHeight;
      // 先同步数据，再 resize 和启动循环
      if (typeof CharacterBioManager !== 'undefined' && CharacterBioManager._syncFromPlayerRelations) {
        try { CharacterBioManager._syncFromPlayerRelations(); } catch(e) { console.warn('[Panel] sync failed:', e); }
      }
      console.log('[CharGraphPanel] expand:', {
        chars: this.chars.length,
        rels: this.rels.length,
        playerRelations: GameEngine.state.player && GameEngine.state.player.relations ? Object.keys(GameEngine.state.player.relations).filter(k=>k!=='_charDetails').length : 0,
        wrapRect: this.wrap.getBoundingClientRect()
      });
      this._resize();
      this._autoCenter();
      this._startLoop();
      // 隐藏文字版关系列表
      const textVer = document.getElementById('s-relations');
      if (textVer) textVer.style.display = 'none';
    } else {
      wrap.style.display = 'none';
      if (btn) btn.textContent = '▼';
      this._stopLoop();
      // 显示文字版关系列表
      const textVer = document.getElementById('s-relations');
      if (textVer) textVer.style.display = '';
    }
  },

  _resize() {
    if (!this.wrap || !this.cv) return;
    const r = this.wrap.getBoundingClientRect();
    const w = r.width || 280, h = r.height || 220;
    this.cv.width = w * 2;
    this.cv.height = h * 2;
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(2, 2);
    // 自动居中所有节点
    if (this.chars.length > 0) this._autoCenter();
  },

  _autoCenter() {
    if (!this.chars.length) return;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (const c of this.chars) {
      if (c.x == null || c.y == null) continue;
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
    if (!isFinite(minX)) return;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const r = this.wrap.getBoundingClientRect();
    const w = r.width || 280, h = r.height || 220;
    // 计算合适的缩放比例，使所有节点都能显示在画布内
    const contentW = Math.max(1, maxX - minX + 160); // 节点宽度120+边距40
    const contentH = Math.max(1, maxY - minY + 80);  // 节点高度44+边距36
    const scaleX = w / contentW;
    const scaleY = h / contentH;
    this.scale = Math.max(0.1, Math.min(2, Math.min(scaleX, scaleY)));
    // 居中
    this.camX = w / 2 - cx * this.scale;
    this.camY = h / 2 - cy * this.scale;
  },

  _s2w(sx, sy) { return {x: (sx - this.camX) / this.scale, y: (sy - this.camY) / this.scale}; },
  _w2s(wx, wy) { return {x: wx * this.scale + this.camX, y: wy * this.scale + this.camY}; },

  _hitNode(wx, wy) {
    for (let i = this.chars.length - 1; i >= 0; i--) {
      const c = this.chars[i];
      if (c.x == null || c.y == null) continue;
      if (Math.abs(wx - c.x) < 60 && Math.abs(wy - c.y) < 26) return c;
    }
    return null;
  },

  _zoom(e) {
    const wb = this._s2w(e.offsetX, e.offsetY);
    this.scale = Math.max(0.3, Math.min(3, this.scale * (e.deltaY < 0 ? 1.15 : 0.85)));
    const wa = this._s2w(e.offsetX, e.offsetY);
    this.camX += (wa.x - wb.x) * this.scale;
    this.camY += (wa.y - wb.y) * this.scale;
  },

  _onClick(e) {
    const w = this._s2w(e.offsetX, e.offsetY);
    const n = this._hitNode(w.x, w.y);
    if (n) {
      CharacterBioManager.show();
      setTimeout(() => { CharGraph.selNode = n.id; CharGraph._openEdit(n); }, 100);
    }
  },

  _loop() {
    const ctx = this.ctx;
    if (!ctx || !this.cv) return;
    const vw = this.cv.width / 2;
    const vh = this.cv.height / 2;
    if (vw < 1 || vh < 1) { this._loopId = requestAnimationFrame(() => this._loop()); return; }
    if (!this._logged) {
      this._logged = true;
      console.log('[CharGraphPanel._loop] first render:', { vw, vh, chars: this.chars.length, rels: this.rels.length, camX: this.camX, camY: this.camY, scale: this.scale });
    }
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.scale, this.scale);
    this._drawGrid(ctx, vw, vh);
    this._drawEdges(ctx);
    this._drawNodes(ctx);
    ctx.restore();
    this._loopId = requestAnimationFrame(() => this._loop());
  },

  _drawGrid(ctx, vw, vh) {
    const gs = 40;
    const tl = this._s2w(0, 0), br = this._s2w(vw, vh);
    ctx.strokeStyle = 'rgba(201,168,76,0.04)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = Math.floor(tl.x/gs)*gs; x <= br.x; x += gs) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
    for (let y = Math.floor(tl.y/gs)*gs; y <= br.y; y += gs) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
    ctx.stroke();
  },

  _drawEdges(ctx) {
    for (const r of this.rels) {
      const f = this.chars.find(c => c.id === r.from);
      const t = this.chars.find(c => c.id === r.to);
      if (!f || !t || f.x==null || t.x==null) continue;
      const color = REL_COLORS[r.type] || '#888';
      const mid = this._bezMid(f, t, r);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.setLineDash(r.type === '暗恋' ? [3,3] : r.type === '利用' ? [2,2] : []);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(mid.x, mid.y, t.x, t.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  _bezMid(f, t, r) {
    const dx = t.x-f.x, dy = t.y-f.y, d = Math.hypot(dx,dy)||1;
    const idx = this.rels.filter(rr=>(rr.from===r.from&&rr.to===r.to)||(rr.from===r.to&&rr.to===r.from)).indexOf(r);
    const off = (idx*2-1)*40;
    return {x:(f.x+t.x)/2-dy/d*off, y:(f.y+t.y)/2+dx/d*off};
  },

  _drawNodes(ctx) {
    let drawn = 0;
    for (const c of this.chars) {
      if (c.x == null || c.y == null) continue;
      drawn++;
      const x = c.x - 60, y = c.y - 22;
      ctx.fillStyle = '#1a1815';
      ctx.strokeStyle = '#2a2818'; ctx.lineWidth = 1;
      this._rr(ctx, x, y, 120, 44, 6); ctx.fill(); ctx.stroke();
      // Name
      ctx.fillStyle = '#c9a84c'; ctx.font = 'bold 12px "Microsoft YaHei"'; ctx.textAlign='center';
      ctx.fillText(c.name.length>5?c.name.slice(0,4)+'..':c.name, c.x, c.y-4);
      // Role
      const roleLabels = { protagonist:'主', ally:'盟', antagonist:'敌', neutral:'中', other:'其' };
      ctx.fillStyle = '#7a7060'; ctx.font = '9px "Microsoft YaHei"';
      ctx.fillText(roleLabels[c.role]||'?', c.x, c.y+11);
    }
    // Empty state — 居中显示
    if (this.chars.length === 0 || drawn === 0) {
      const vw = (this.cv?.width || 0) / 2;
      const vh = (this.cv?.height || 0) / 2;
      ctx.fillStyle = '#666'; ctx.font = '12px "Microsoft YaHei"'; ctx.textAlign='center';
      ctx.fillText('暂无人物数据', vw / 2, vh / 2 - 8);
      ctx.fillStyle = '#555'; ctx.font = '10px "Microsoft YaHei"';
      ctx.fillText('开始冒险或加载存档后', vw / 2, vh / 2 + 10);
      ctx.fillText('人物将自动显示在此', vw / 2, vh / 2 + 24);
    }
  },

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  },

  _startLoop() { if (!this._loopId) this._loopId = requestAnimationFrame(() => this._loop()); },
  _stopLoop() { if (this._loopId) { cancelAnimationFrame(this._loopId); this._loopId = null; } },

  /** Call this when character data changes to refresh panel view */
  refresh() { if (this._expanded) { this._resize(); this._autoCenter(); } }
};

// =============================================
// CharListPanel — 左侧人物列表
// =============================================
var CharListPanel = {
  _filter: '',

  render() {
    const container = document.getElementById('char-list-items');
    if (!container) return;
    const bios = GameEngine.state.characterBios || [];
    const f = this._filter.toLowerCase();
    const filtered = f ? bios.filter(c => (c.name || '').toLowerCase().includes(f)) : bios;
    // 排序：主角在前 → 已登场 → 其他
    filtered.sort((a, b) => {
      if (a.role === 'protagonist') return -1;
      if (b.role === 'protagonist') return 1;
      if (a.hasAppeared && !b.hasAppeared) return -1;
      if (!a.hasAppeared && b.hasAppeared) return 1;
      return 0;
    });
    const countEl = document.getElementById('clp-count');
    if (countEl) countEl.textContent = filtered.length + '/' + bios.length;
    const roleLabels = { protagonist:'主角', ally:'盟友', antagonist:'对手', neutral:'中立', other:'其他' };
    container.innerHTML = filtered.map(c => {
      const avatar = c.portrait || CharGraph._generateFallbackPortrait(c);
      const isActive = CharGraph._editingId === c.id;
      const pinIcon = c.showInPanel ? '<span class="clp-pin">📌</span>' : '';
      return `<div class="clp-item ${isActive ? 'active' : ''}" onclick="CharListPanel.select('${c.id}')">
        <div class="clp-avatar">${avatar}</div>
        <div class="clp-info">
          <div class="clp-name">${escapeHTML(c.name || '?')}</div>
          <div class="clp-role">${roleLabels[c.role] || c.role || '?'}${c.hasAppeared ? ' ✦' : ''}</div>
        </div>
        ${pinIcon}
      </div>`;
    }).join('') || '<div style="padding:10px;color:var(--text-dim);font-size:11px;text-align:center;">暂无人物</div>';
  },

  filter() {
    const el = document.getElementById('clp-search');
    if (el) this._filter = el.value;
    this.render();
  },

  select(id) {
    const c = (GameEngine.state.characterBios || []).find(c => c.id === id);
    if (!c) return;
    CharGraph.selNode = id;
    CharGraph._openEdit(c);
    this.render();
  },
};

// ── 确保所有 const 对象在 onclick 中可访问 ──
window.CharacterBioManager = CharacterBioManager;
window.CharGraph = CharGraph;
window.CharGraphPanel = CharGraphPanel;
window.CharListPanel = CharListPanel;
window.REL_TYPES = REL_TYPES;
window.REL_COLORS = REL_COLORS;

// Init on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  try { CharGraph.init(); } catch(e) { console.error('[CharGraph.init]', e); }
  try { CharGraphPanel.init(); } catch(e) { console.error('[CharGraphPanel.init]', e); }
});
