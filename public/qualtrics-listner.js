(function() {
  window.addEventListener('message', function(e) {
    if (e.data === 'gameComplete') {
      var status = document.getElementById('game-status');
      var waiting = document.getElementById('waiting-msg');
      if (status) status.style.display = 'block';
      if (waiting) waiting.style.display = 'none';
      if (typeof qthis !== 'undefined') qthis.showNextButton();
    }
  });
})();
