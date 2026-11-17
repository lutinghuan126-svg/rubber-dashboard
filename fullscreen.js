(() => {
  function resizeCharts() {
    document.querySelectorAll('.chart-mobile').forEach(button => {
      const active=button.closest('.panel').classList.contains('mobile-landscape');
      button.textContent=active?'退出横屏':'▱ 手机横屏';
      button.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('.chart-fullscreen').forEach(button => {
      const active = document.fullscreenElement === button.closest('.panel') || button.closest('.panel').classList.contains('expanded-chart');
      button.textContent = active ? '⛶ 退出全屏' : '⛶ 全屏';
      button.setAttribute('aria-label', active ? '退出全屏' : '全屏查看图表');
    });
    requestAnimationFrame(() => {
      document.querySelectorAll('.js-plotly-plot').forEach(plot => {
        if (window.Plotly && plot.layout) {
          const panel = plot.closest('.panel');
          const active = document.fullscreenElement === panel || panel?.classList.contains('expanded-chart') || panel?.classList.contains('mobile-landscape');
          const update = {'xaxis.fixedrange': !active, 'yaxis.fixedrange': !active, dragmode: active ? 'zoom' : false};
          if (!active) { update['xaxis.autorange'] = true; update['yaxis.autorange'] = true; }
          window.Plotly.relayout(plot, update).then(() => window.Plotly.Plots.resize(plot));
        }
      });
      window.dispatchEvent(new Event('resize'));
    });
  }
  document.addEventListener('click', async event => {
    const mobile=event.target.closest('.chart-mobile');
    if(mobile){
      const panel=mobile.closest('.panel');
      const opening=!panel.classList.contains('mobile-landscape');
      if(document.fullscreenElement) await document.exitFullscreen();
      document.querySelectorAll('.mobile-landscape,.expanded-chart').forEach(p=>p.classList.remove('mobile-landscape','expanded-chart'));
      if(opening) panel.classList.add('mobile-landscape');
      document.body.classList.toggle('mobile-chart-open',opening);
      resizeCharts();
      return;
    }
    const button = event.target.closest('.chart-fullscreen');
    if (!button) return;
    try {
      if (button.closest('.panel').classList.contains('expanded-chart')) { button.closest('.panel').classList.remove('expanded-chart'); resizeCharts(); return; }
      if (document.fullscreenElement) await document.exitFullscreen();
      else await button.closest('.panel').requestFullscreen();
    } catch (error) {
      button.closest('.panel').classList.add('expanded-chart'); resizeCharts();
    }
  });
  document.addEventListener('fullscreenchange', resizeCharts);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') { document.querySelectorAll('.expanded-chart,.mobile-landscape').forEach(p => p.classList.remove('expanded-chart','mobile-landscape')); document.body.classList.remove('mobile-chart-open'); resizeCharts(); } });
  window.addEventListener('orientationchange',()=>setTimeout(resizeCharts,200));
})();

