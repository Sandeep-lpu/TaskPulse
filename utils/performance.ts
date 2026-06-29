export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    setTimeout(() => {
      // Basic page load metric
      if (performance.timing) {
        const { loadEventEnd, navigationStart } = performance.timing;
        const pageLoadTime = loadEventEnd - navigationStart;
        if (pageLoadTime > 0) {
          console.log(`[Performance] Page Load Time: ${pageLoadTime}ms`);
        }
      }
      
      // Paint metrics (FCP)
      if (performance.getEntriesByType) {
        const paintMetrics = performance.getEntriesByType('paint');
        paintMetrics.forEach(metric => {
          console.log(`[Performance] ${metric.name}: ${metric.startTime.toFixed(2)}ms`);
        });
      }
    }, 0);
  });

  // Track FPS for smooth scroll effects
  let frameCount = 0;
  let lastTime = performance.now();
  
  const checkFPS = () => {
    const now = performance.now();
    frameCount++;
    
    if (now - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastTime));
      // Only warn if FPS drops below 30 to avoid console spam
      if (fps < 30) {
         console.warn(`[Performance] Low FPS detected: ${fps} FPS. Scroll effects might stutter.`);
      }
      frameCount = 0;
      lastTime = now;
    }
    requestAnimationFrame(checkFPS);
  };
  
  requestAnimationFrame(checkFPS);
};
