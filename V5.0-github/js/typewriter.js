// ============================
// TYPEWRITER EFFECT
// ============================
var Typewriter = {
  _active: null,

  /** Stop any currently running typewriter animation */
  stop() {
    if (this._active) {
      clearInterval(this._active.timer);
      this._active.container.removeEventListener('click', this._active.handler);
      this._active = null;
    }
  },

  /**
   * Animate text into a container, paragraph by paragraph, character by character.
   * Click anywhere to skip and reveal all remaining text instantly.
   *
   * @param {HTMLElement} container - the story-content element
   * @param {string} rawText - the raw AI story text (with \n\n paragraphs, \n line breaks)
   * @param {number} speed - ms between character chunks (default 15)
   * @param {string} [annotatedText] - optional annotated HTML version; used on skip/completion
   * @returns {Promise} resolves when animation completes or is skipped
   */
  async animate(container, rawText, speed = 15, annotatedText = null) {
    this.stop();

    const wrapper = document.createElement('div');
    wrapper.className = 'fade-in';
    wrapper.innerHTML = '<hr class="separator">';
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    // Parse into paragraphs, splitting on double newlines
    const paragraphs = rawText.split('\n\n').filter(p => p.trim() !== '');
    if (paragraphs.length === 0) {
      return; // nothing to animate
    }

    let skipped = false;
    let paraIdx = 0;
    let charIdx = 0;
    let currentPElem = null;

    // Render final content — annotated if available
    const renderFinal = () => {
      if (annotatedText) {
        const annotatedParas = annotatedText.split('\n\n').filter(p => p.trim() !== '');
        wrapper.innerHTML = '<hr class="separator">'
          + annotatedParas.map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
      } else {
        wrapper.innerHTML = '<hr class="separator">'
          + paragraphs.map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
      }
    };

    return new Promise((resolve) => {
      const skip = () => {
        if (skipped) return;
        skipped = true;
        renderFinal();
        container.scrollTop = container.scrollHeight;
        this._cleanup(container, skip);
        resolve();
      };

      container.addEventListener('click', skip);
      this._active = { container, handler: skip, timer: null };

      const CHUNK_SIZE = 5; // characters per tick — rapid typing feel

      const timer = setInterval(() => {
        if (skipped) return;

        // All paragraphs done
        if (paraIdx >= paragraphs.length) {
          if (annotatedText) renderFinal();
          this._cleanup(container, skip);
          resolve();
          return;
        }

        const para = paragraphs[paraIdx];

        // Start a new paragraph element
        if (!currentPElem) {
          currentPElem = document.createElement('p');
          wrapper.appendChild(currentPElem);
          charIdx = 0;
        }

        // Type the next chunk
        const end = Math.min(charIdx + CHUNK_SIZE, para.length);
        let chunk = para.substring(charIdx, end);

        // If the chunk contains a newline, treat it as a <br> — don't split across chunks
        if (chunk.includes('\n')) {
          // Split at the newline: type up to \n, insert <br>, continue
          const nlPos = chunk.indexOf('\n');
          const beforeNl = chunk.substring(0, nlPos);
          const afterNl = chunk.substring(nlPos + 1);

          if (beforeNl) {
            currentPElem.appendChild(document.createTextNode(beforeNl));
          }
          currentPElem.appendChild(document.createElement('br'));
          charIdx += nlPos + 1;

          // If there's text after the newline in this chunk, queue it for next tick
          if (afterNl) {
            paragraphs[paraIdx] = afterNl + para.substring(end);
            charIdx = 0;
          }
        } else {
          currentPElem.appendChild(document.createTextNode(chunk));
          charIdx = end;
        }

        // Paragraph finished
        if (charIdx >= para.length) {
          currentPElem = null;
          paraIdx++;
        }

        container.scrollTop = container.scrollHeight;
      }, speed);

      // If container is scrolled near bottom, keep it there
      this._active.timer = timer;
    });
  },

  _cleanup(container, handler) {
    clearInterval(this._active?.timer);
    container.removeEventListener('click', handler);
    this._active = null;
  }
};
// ── 确保 Typewriter 在 onclick 中可访问（const 不挂 window）──
window.Typewriter = Typewriter;
