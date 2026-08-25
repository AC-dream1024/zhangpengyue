/* Cache-safe campaign progression patch for existing game.js builds. */
(() => {
  if (typeof game === 'undefined' || typeof restartButton === 'undefined' || typeof STORY === 'undefined') return;
  const originalEnd = game.end.bind(game);
  game.end = function (victory, title) {
    const previousLevel = this.campaignLevel;
    originalEnd(victory, title);
    if (victory && this.mode === 'campaign' && previousLevel < STORY.length && this.campaignLevel === previousLevel) {
      this.campaignLevel = Math.min(STORY.length, previousLevel + 1);
      localStorage.setItem('cresting_wave_level', String(this.campaignLevel));
    }
    if (victory && this.mode === 'campaign' && this.campaignLevel < STORY.length) {
      restartButton.textContent = '下一关';
      restartButton.style.background = 'linear-gradient(135deg,#00ff88,#00cc66)';
      restartButton.style.color = '#07120b';
    }
  };
  restartButton.onclick = () => {
    if (game.over && game.mode === 'campaign' && game.campaignLevel < STORY.length) game.start('campaign');
    else game.start(game.mode);
  };
})();
