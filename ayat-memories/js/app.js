// ── App Bootstrap ──
window.App = {
  async start() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.warn);
    }

    await UI.init();

    // Check for shared memory link
    const params = new URLSearchParams(location.search);
    const shareId = params.get('share');

    // Try auto sign-in
    const signedIn = await Auth.init();
    if (signedIn) {
      await UI.loadApp();
      // Handle shared link after loading
      if (shareId) {
        const mem = UI.appData?.memories.find(m => m.id === shareId);
        if (mem) setTimeout(() => UI.viewMemory(mem), 400);
      }
    } else {
      UI.showScreen('login-screen');
      if (shareId) {
        document.querySelector('.login-sub').textContent = 'Sign in to view this memory 🌸';
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.start());
