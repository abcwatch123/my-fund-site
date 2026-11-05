/* One quiet reveal on entry. The finished SVG remains the no-JS fallback. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const charts = [];
  let visibilityFrame = 0;

  function stopWatching() {
    window.removeEventListener('scroll', scheduleVisibility);
    window.removeEventListener('resize', scheduleVisibility);
    window.removeEventListener('load', scheduleVisibility);
    window.visualViewport?.removeEventListener('resize', scheduleVisibility);
    window.visualViewport?.removeEventListener('scroll', scheduleVisibility);
    if (visibilityFrame) cancelAnimationFrame(visibilityFrame);
    visibilityFrame = 0;
  }

  function checkVisibility() {
    visibilityFrame = 0;
    const viewport = window.visualViewport;
    const top = Math.max(viewport?.offsetTop || 0,
      document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0);
    const bottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight);
    charts.forEach(chart => {
      if (chart.svg.dataset.motionState !== 'pending') return;
      const bounds = chart.svg.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(bounds.bottom, bottom) - Math.max(bounds.top, top));
      // Mobile deliberately crops the SVG's horizontal margins. Require its full
      // height, including the legend; for short screens use the available height.
      const requiredHeight = Math.min(bounds.height, bottom - top);
      if (requiredHeight > 0 && visibleHeight >= requiredHeight - 1) reveal(chart);
    });
    if (charts.every(chart => chart.svg.dataset.motionState !== 'pending')) stopWatching();
  }

  function scheduleVisibility() {
    if (!visibilityFrame) visibilityFrame = requestAnimationFrame(checkVisibility);
  }

  function complete(chart) {
    if (chart.frame) cancelAnimationFrame(chart.frame);
    chart.frame = 0;
    chart.reveal.setAttribute('width', String(chart.width));
    chart.labels.forEach(({ nodes }) => nodes.forEach(node => node.style.removeProperty('opacity')));
    chart.svg.dataset.motionState = 'complete';
  }

  function reveal(chart) {
    const started = performance.now();
    const duration = 2900;
    chart.svg.dataset.motionState = 'running';
    const draw = now => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 2);
      const edge = chart.startX + (chart.endX - chart.startX + 50) * eased;
      chart.reveal.setAttribute('width', String(edge - chart.startX));
      chart.labels.forEach(({ x, nodes }) => {
        const opacity = Math.max(0, Math.min(1, (edge - x) / 34));
        nodes.forEach(node => node.style.opacity = String(opacity));
      });
      if (progress < 1) chart.frame = requestAnimationFrame(draw);
      else complete(chart);
    };
    chart.frame = requestAnimationFrame(draw);
  }

  document.querySelectorAll('.chart svg').forEach((svg, index) => {
    const series = [...svg.querySelectorAll('.chart-series')];
    if (series.length !== 2) return;
    const bounds = series.map(path => path.getBBox());
    const startX = Math.min(...bounds.map(box => box.x)) - 1;
    const endX = Math.max(...bounds.map(box => box.x + box.width)) + 1;
    const width = svg.viewBox.baseVal.width;
    const height = svg.viewBox.baseVal.height;
    const defs = document.createElementNS(ns, 'defs');
    const clip = document.createElementNS(ns, 'clipPath');
    clip.id = `chart-entry-reveal-${index}`;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(startX));
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    clip.append(rect);
    defs.append(clip);
    svg.prepend(defs);
    series.forEach(path => {
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('clip-path', `url(#${clip.id})`);
      path.before(group);
      group.append(path);
    });
    const labels = [...svg.querySelectorAll('.chart-value, .chart-point')].map(path => {
      const box = path.getBBox();
      const previous = path.previousElementSibling;
      const nodes = [path];
      // Exported percentage labels include a white outline copy.
      if (previous?.getAttribute('stroke') === '#ffffff' &&
          previous.getAttribute('d') === path.getAttribute('d')) nodes.push(previous);
      return { x: Number(path.getAttribute('data-x')) || box.x + box.width / 2, nodes };
    });
    const chart = { svg, reveal: rect, labels, startX, endX, width, frame: 0 };
    charts.push(chart);
    if (reducedMotion.matches) {
      complete(chart);
      return;
    }
    rect.setAttribute('width', '0');
    labels.forEach(({ nodes }) => nodes.forEach(node => node.style.opacity = '0'));
    svg.dataset.motionState = 'pending';
  });

  if (!reducedMotion.matches) {
    window.addEventListener('scroll', scheduleVisibility, { passive: true });
    window.addEventListener('resize', scheduleVisibility);
    window.addEventListener('load', scheduleVisibility);
    window.visualViewport?.addEventListener('resize', scheduleVisibility);
    window.visualViewport?.addEventListener('scroll', scheduleVisibility, { passive: true });
    scheduleVisibility();
  }
  reducedMotion.addEventListener('change', event => {
    if (!event.matches) return;
    stopWatching();
    charts.forEach(complete);
  });
  window.addEventListener('beforeprint', () => {
    stopWatching();
    charts.forEach(complete);
  });
})();
