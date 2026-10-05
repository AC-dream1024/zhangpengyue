/* Small interface enhancements; resume content and original actions stay in place. */
(() => {
  const root = document.documentElement;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const navLinks = [...document.querySelectorAll('.a-nav a')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href')));
  const stream = document.querySelector('.a-stream');
  const grid = document.querySelector('#a-cert-grid');
  let pointer = null;
  let suppressClickUntil = 0;
  let waveFrame = 0;
  const wave = () => {
    waveFrame = 0;
    [...grid.querySelectorAll('.a-cert:not(.hide)')].forEach((card, index) => {
      const offset = reducedMotion() ? 0 : Math.sin(index * .8 - stream.scrollLeft * .001) * 12;
      card.style.transform = `translateY(${offset}px)`;
    });
  };
  stream.addEventListener('scroll', () => { if (!waveFrame) waveFrame = requestAnimationFrame(wave); }, {passive:true});
  grid.addEventListener('certfilterchange', wave);
  stream.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stream.clientWidth : 1;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
    const max = stream.scrollWidth - stream.clientWidth;
    if (max <= 0 || (delta < 0 && stream.scrollLeft <= 1) || (delta > 0 && stream.scrollLeft >= max - 1)) return;
    event.preventDefault();
    stream.scrollLeft += delta;
  }, {passive:false});
  stream.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = {id:event.pointerId, x:event.clientX, y:event.clientY, scroll:stream.scrollLeft, moved:false};
  });
  stream.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const distance = event.clientX - pointer.x;
    if (!pointer.moved) {
      if (Math.abs(distance) <= 6 || Math.abs(distance) <= Math.abs(event.clientY - pointer.y)) return;
      pointer.moved = true;
      stream.setPointerCapture(event.pointerId);
      stream.classList.add('dragging');
    }
    event.preventDefault();
    stream.scrollLeft = pointer.scroll - distance;
  });
  const endDrag = event => {
    // Touch initially captures the image; transferring capture must not end the drag.
    if (event.type === 'lostpointercapture' && event.target !== stream) return;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.moved) suppressClickUntil = Date.now() + 400;
    pointer = null;
    stream.classList.remove('dragging');
    if (stream.hasPointerCapture(event.pointerId)) stream.releasePointerCapture(event.pointerId);
  };
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => stream.addEventListener(type, endDrag));
  stream.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, {capture:true});
  wave();
  const toolbar = document.createElement('div');
  toolbar.className = 'a-stream-toolbar';
  const hint = document.createElement('span');
  const controls = document.createElement('div');
  controls.className = 'a-stream-controls';
  const buttons = [-1, 1].map(direction => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'a-stream-button';
    button.setAttribute('aria-controls', stream.id);
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
      (direction < 0 ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6') + '"/></svg>';
    button.addEventListener('click', () => {
      const card = grid.querySelector('.a-cert:not(.hide)');
      const distance = card ? card.offsetWidth + parseFloat(getComputedStyle(grid).gap) : 310;
      stream.scrollBy({left: direction * distance, behavior: reducedMotion() ? 'instant' : 'smooth'});
    });
    controls.append(button);
    return button;
  });
  toolbar.append(hint, controls);
  stream.before(toolbar);

  const updateButtons = () => {
    buttons[0].disabled = stream.scrollLeft < 2;
    buttons[1].disabled = stream.scrollLeft >= stream.scrollWidth - stream.clientWidth - 2;
  };
  stream.addEventListener('scroll', updateButtons, {passive: true});
  grid.addEventListener('certfilterchange', () => requestAnimationFrame(updateButtons));
  if ('ResizeObserver' in window) new ResizeObserver(updateButtons).observe(stream);
  stream.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const cards = [...grid.querySelectorAll('.a-cert:not(.hide)')];
    const current = cards.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    let index = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 :
      Math.max(0, Math.min(cards.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    cards[index].focus({preventScroll: true});
    stream.scrollTo({left: cards[index].offsetLeft - 28, behavior: reducedMotion() ? 'instant' : 'smooth'});
  });

  const titles = [
    ['个人简介', 'PROFILE'], ['志愿服务', 'PRACTICE'], ['个人作品', 'PLAYGROUND'],
    ['认证与荣誉', 'CREDENTIALS'], ['教育与成长', 'JOURNEY']
  ];
  const syncLanguage = () => {
    const chinese = root.lang !== 'en';
    document.querySelectorAll('.a-section .a-title').forEach((heading, index) => {
      heading.textContent = titles[index][chinese ? 0 : 1];
      if (chinese) {
        const english = document.createElement('small');
        english.textContent = titles[index][1];
        heading.append(english);
      }
    });
    hint.textContent = chinese ? '横向浏览学习足迹 · 点击查看完整证书' : 'Explore learning milestones · Select a certificate to view';
    buttons[0].setAttribute('aria-label', chinese ? '向左浏览证书' : 'Previous certificates');
    buttons[1].setAttribute('aria-label', chinese ? '向右浏览证书' : 'Next certificates');
    stream.setAttribute('aria-label', chinese ? '证书溪流' : 'Credential stream');
    const tags = chinese ? ['活动合影 / 01', '志愿行动 / 02', '公益项目 / 03', '服务团队 / 04'] :
      ['GROUP / 01', 'ACTION / 02', 'CAUSE / 03', 'TEAM / 04'];
    document.querySelectorAll('.a-photo').forEach((photo, i) => photo.dataset.tag = tags[i]);
    document.querySelector('.a-dialog-hint').textContent = chinese ? '方向键切换证书 · Esc 关闭' : 'Arrow keys to browse · Esc to close';
    document.querySelectorAll('#a-media-grid .a-launch').forEach(link => {
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', link.textContent.trim() + (chinese ? '（在新标签页打开）' : ' (opens in a new tab)'));
    });
  };
  new MutationObserver(syncLanguage).observe(root, {attributes: true, attributeFilter: ['lang']});
  const savedTheme = localStorage.getItem('resume-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') root.dataset.theme = savedTheme;

  let scrollFrame = 0;
  const markCurrent = () => {
    scrollFrame = 0;
    const threshold = parseFloat(getComputedStyle(root).getPropertyValue('--head')) + 100;
    let current = -1;
    sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= threshold) current = i; });
    navLinks.forEach((link, i) => {
      if (i === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(markCurrent); }, {passive: true});
  addEventListener('resize', markCurrent, {passive: true});
  syncLanguage();
  updateButtons();
  markCurrent();
})();
