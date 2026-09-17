/* Hello Screen - 按钮绑定已由内联 HelloScreen.init() 处理（黑洞动画 + __bootConfig 逻辑） */
/* 本文件仅保留 mousedown preventDefault（阻止 WebView2 长按菜单） */
(function () {
  function bindMousedown() {
    var btn = document.getElementById('hs-enter-btn');
    if (!btn) {
      setTimeout(bindMousedown, 80);
      return;
    }
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMousedown);
  } else {
    bindMousedown();
  }
})();
