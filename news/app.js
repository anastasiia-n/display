/**
 * @fileoverview Retro Pixel News Broadcast studio controls and canvas renderer.
 */

'use strict';

/** @const {string} Fallback background when no #img hash is set. */
const DEFAULT_BG_URL =
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23' +
    '?auto=format&fit=crop&w=1000&q=80';

/** @const {number} Canvas logical width in pixels. */
const CANVAS_WIDTH = 640;

/** @const {number} Canvas logical height in pixels. */
const CANVAS_HEIGHT = 360;

/** @const {number} Backstage monitor width in pixels. */
const MONITOR_WIDTH = 468;

/** @const {number} Backstage monitor height in pixels (approximately 16:9). */
const MONITOR_HEIGHT = 260;

/** @const {number} Backstage monitor top-left X on the canvas. */
const MONITOR_X = 10;

/** @const {number} Backstage monitor top-left Y on the canvas. */
const MONITOR_Y = 10;

/**
 * Application state for studio UI modes.
 * @type {{tvMode: boolean, scanlinesActive: boolean}}
 */
const state = {
  tvMode: false,
  scanlinesActive: true,
};

/**
 * Cached DOM element references. Populated on DOMContentLoaded.
 * @type {Object<string, ?Element>}
 */
const els = {};

/**
 * Enables or disables full-screen TV mode.
 * @param {boolean=} forceState If set, forces TV mode on/off; otherwise toggles.
 */
function setTvMode(forceState) {
  if (typeof forceState === 'boolean') {
    state.tvMode = forceState;
  } else {
    state.tvMode = !state.tvMode;
  }

  const header = document.querySelector('header');
  const chrome = [header, els.studioControls, els.studioFooter];

  if (state.tvMode) {
    chrome.forEach((el) => el && el.classList.add('hidden'));
    if (els.mainBroadcastContainer) {
      els.mainBroadcastContainer.classList.remove('max-w-6xl');
      els.mainBroadcastContainer.classList.add(
          'w-full', 'h-screen', 'max-w-none', 'p-0', 'm-0', 'rounded-none',
          'border-0');
    }
  } else {
    chrome.forEach((el) => el && el.classList.remove('hidden'));
    if (els.mainBroadcastContainer) {
      els.mainBroadcastContainer.classList.add(
          'max-w-6xl', 'rounded-lg', 'border-8');
      els.mainBroadcastContainer.classList.remove(
          'w-full', 'h-screen', 'max-w-none', 'p-0', 'm-0', 'rounded-none',
          'border-0');
    }
  }

  updateShareUrl();
}

/**
 * Punches a hole in the CRT overlay so scanlines skip the backstage monitor image.
 * Coordinates follow MONITOR_* / CANVAS_* so the hole tracks the drawn screen.
 */
function applyScanlineMonitorHole() {
  if (!els.scanlineOverlay) {
    return;
  }

  const left = (MONITOR_X / CANVAS_WIDTH) * 100;
  const top = (MONITOR_Y / CANVAS_HEIGHT) * 100;
  const right = ((MONITOR_X + MONITOR_WIDTH) / CANVAS_WIDTH) * 100;
  const bottom = ((MONITOR_Y + MONITOR_HEIGHT) / CANVAS_HEIGHT) * 100;

  // evenodd: outer full frame minus inner monitor rect.
  els.scanlineOverlay.style.clipPath =
      `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ` +
      `${left}% ${top}%, ${right}% ${top}%, ${right}% ${bottom}%, ` +
      `${left}% ${bottom}%, ${left}% ${top}%)`;
}

/**
 * Toggles the CRT scanline overlay and updates the status label.
 */
function toggleScanlines() {
  state.scanlinesActive = !state.scanlinesActive;

  if (!els.scanlineOverlay || !els.scanlinesStatus) {
    return;
  }

  if (state.scanlinesActive) {
    els.scanlineOverlay.classList.remove('hidden');
    els.scanlinesStatus.textContent = 'ON';
    els.scanlinesStatus.className = 'text-green-400';
  } else {
    els.scanlineOverlay.classList.add('hidden');
    els.scanlinesStatus.textContent = 'OFF';
    els.scanlinesStatus.className = 'text-red-400';
  }
}

/**
 * Copies the share URL from the readonly input to the clipboard.
 * @return {!Promise<void>}
 */
async function copyShareUrl() {
  if (!els.shareUrlInput) {
    return;
  }

  const url = els.shareUrlInput.value;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      els.shareUrlInput.select();
      document.execCommand('copy');
    }
  } catch (err) {
    els.shareUrlInput.select();
    document.execCommand('copy');
  }

  if (!els.copyBtn) {
    return;
  }

  const originalText = els.copyBtn.textContent;
  els.copyBtn.textContent = 'COPIED!';
  els.copyBtn.classList.replace('bg-blue-600', 'bg-green-600');
  setTimeout(() => {
    els.copyBtn.textContent = originalText;
    els.copyBtn.classList.replace('bg-green-600', 'bg-blue-600');
  }, 2000);
}

/**
 * Builds the shareable URL from current control values and writes it to the UI.
 */
function updateShareUrl() {
  if (!els.shareUrlInput || !els.inputImgUrl || !els.inputTickerText) {
    return;
  }

  const params = new URLSearchParams();
  const imgVal = els.inputImgUrl.value.trim();
  const tickerVal = els.inputTickerText.value.trim();

  if (imgVal) {
    params.set('img', imgVal);
  }
  if (tickerVal) {
    params.set('ticker', tickerVal);
  }
  if (state.tvMode) {
    params.set('tv', 'true');
  }

  const baseUrl = window.location.href.split('#')[0];
  const hashStr = params.toString();
  els.shareUrlInput.value = hashStr ? `${baseUrl}#${hashStr}` : baseUrl;
}

/**
 * Parses location.hash and applies img, ticker, and tv settings.
 * @param {function(string): void} loadBgImage Callback to load a background.
 */
function parseHash(loadBgImage) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const imgParam = params.get('img');
  const tickerParam = params.get('ticker');
  const tvParam = params.get('tv') || params.get('tvmode');

  if (imgParam) {
    els.inputImgUrl.value = imgParam;
    loadBgImage(imgParam);
  } else {
    els.inputImgUrl.value = '';
    loadBgImage(DEFAULT_BG_URL);
  }

  if (tickerParam != null) {
    els.inputTickerText.value = tickerParam;
    els.tickerText.textContent = tickerParam;
  } else {
    els.inputTickerText.value = '';
    els.tickerText.textContent = '';
  }

  if (tvParam === 'true' || tvParam === '1') {
    setTvMode(true);
  }

  updateShareUrl();
}

/**
 * Updates the UTC clock label.
 */
function updateClock() {
  if (!els.clockDisplay) {
    return;
  }

  const now = new Date();
  const hrs = String(now.getUTCHours()).padStart(2, '0');
  const mins = String(now.getUTCMinutes()).padStart(2, '0');
  const secs = String(now.getUTCSeconds()).padStart(2, '0');
  els.clockDisplay.textContent = `${hrs}:${mins}:${secs} UTC`;
}

/**
 * Fills the studio wall with a solid color.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawStudioBackground(ctx, width, height) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws the colorful "no signal" placeholder on the backstage monitor.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function drawPlaceholderScreen(ctx, x, y, w, h) {
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(x, y, w, h);

  const colors =
      ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ec4899'];
  const stripeW = w / colors.length;
  colors.forEach((col, idx) => {
    ctx.fillStyle = col;
    ctx.fillRect(x + idx * stripeW, y, stripeW, h - 30);
  });

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y + h - 30, w, 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8.4px "Press Start 2P"';
  ctx.fillText('NO MEDIA SIGNAL', x + 14, y + h - 7);
}

/**
 * Draws the backstage media monitor, optionally filled with a user image.
 * This is the main "image" display.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {?HTMLImageElement} bgImage
 * @param {boolean} isBgLoaded
 */
function drawBackstageScreen(ctx, bgImage, isBgLoaded) {
  const screenX = MONITOR_X;
  const screenY = MONITOR_Y;
  const screenW = MONITOR_WIDTH;
  const screenH = MONITOR_HEIGHT;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(screenX - 6, screenY - 6, screenW + 12, screenH + 12);

  ctx.fillStyle = '#334155';
  ctx.fillRect(screenX - 2, screenY - 2, screenW + 4, screenH + 4);

  ctx.save();
  ctx.beginPath();
  ctx.rect(screenX, screenY, screenW, screenH);
  ctx.clip();

  if (isBgLoaded && bgImage && bgImage.complete) {
    try {
      // Cover-fit into the 16:9 monitor; crop overflow.
      const imgRatio = bgImage.width / bgImage.height;
      const screenRatio = 16 / 9;
      let renderW = screenW;
      let renderH = screenH;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > screenRatio) {
        renderW = screenH * imgRatio;
        offsetX = (screenW - renderW) / 2;
      } else {
        renderH = screenW / imgRatio;
        offsetY = (screenH - renderH) / 2;
      }

      ctx.drawImage(
          bgImage, screenX + offsetX, screenY + offsetY, renderW, renderH);
    } catch (err) {
      drawPlaceholderScreen(ctx, screenX, screenY, screenW, screenH);
    }
  } else {
    drawPlaceholderScreen(ctx, screenX, screenY, screenW, screenH);
  }

  ctx.restore();
}

/**
 * Draws the animated pixel-art news anchor. This is the "presenter".
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick Animation frame counter.
 * @param {{mouthOpen: boolean, eyeState: string, headOffsetY: number}} anim
 */
function drawAnchor(ctx, tick, anim) {
  if (tick % 12 === 0) {
    anim.mouthOpen = Math.random() > 0.4;
  }

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;

  const gridSize = 22.4;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/**
 * Draws the colorful "no signal" placeholder on the backstage monitor.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function drawPlaceholderScreen(ctx, x, y, w, h) {
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(x, y, w, h);

  const colors =
      ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ec4899'];
  const stripeW = w / colors.length;
  colors.forEach((col, idx) => {
    ctx.fillStyle = col;
    ctx.fillRect(x + idx * stripeW, y, stripeW, h - 30);
  });

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y + h - 30, w, 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8.4px "Press Start 2P"';
  ctx.fillText('NO MEDIA SIGNAL', x + 14, y + h - 7);
}

/**
 * Draws the backstage media monitor, optionally filled with a user image.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {?HTMLImageElement} bgImage
 * @param {boolean} isBgLoaded
 */
function drawBackstageScreen(ctx, bgImage, isBgLoaded) {
  const screenX = MONITOR_X;
  const screenY = MONITOR_Y;
  const screenW = MONITOR_WIDTH;
  const screenH = MONITOR_HEIGHT;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(screenX - 6, screenY - 6, screenW + 12, screenH + 12);

  ctx.fillStyle = '#334155';
  ctx.fillRect(screenX - 2, screenY - 2, screenW + 4, screenH + 4);

  ctx.save();
  ctx.beginPath();
  ctx.rect(screenX, screenY, screenW, screenH);
  ctx.clip();

  if (isBgLoaded && bgImage && bgImage.complete) {
    try {
      // Cover-fit into the 16:9 monitor; crop overflow.
      const imgRatio = bgImage.width / bgImage.height;
      const screenRatio = 16 / 9;
      let renderW = screenW;
      let renderH = screenH;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > screenRatio) {
        renderW = screenH * imgRatio;
        offsetX = (screenW - renderW) / 2;
      } else {
        renderH = screenW / imgRatio;
        offsetY = (screenH - renderH) / 2;
      }

      ctx.drawImage(
          bgImage, screenX + offsetX, screenY + offsetY, renderW, renderH);
    } catch (err) {
      drawPlaceholderScreen(ctx, screenX, screenY, screenW, screenH);
    }
  } else {
    drawPlaceholderScreen(ctx, screenX, screenY, screenW, screenH);
  }

  ctx.restore();
}

/**
 * Draws the animated pixel-art news anchor.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick Animation frame counter.
 * @param {{mouthOpen: boolean, eyeState: string, headOffsetY: number}} anim
 */
function drawAnchor(ctx, tick, anim) {
  if (tick % 12 === 0) {
    anim.mouthOpen = Math.random() > 0.4;
  }

  if (tick % 180 === 0) {
    anim.eyeState = 'blink';
  } else if (tick % 180 === 10) {
    anim.eyeState = 'open';
  }

  anim.headOffsetY = Math.sin(tick * 0.08) * 1.05;

  // Center the anchor in the canvas area to the right of the monitor.
  const anchorX = MONITOR_X + MONITOR_WIDTH + ((CANVAS_WIDTH - (MONITOR_X + MONITOR_WIDTH)) / 2);
  // Lower the presenter so the desk covers the bottom of the suit.
  const anchorY = (CANVAS_HEIGHT / 2) + 70 + anim.headOffsetY;

  // Hair (back)
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(anchorX - 24.5, anchorY - 66.5, 49, 31.5);

  // Suit
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(anchorX - 35, anchorY - 21, 70, 56);

  ctx.fillStyle = '#312e81';
  ctx.fillRect(anchorX - 21, anchorY - 21, 14, 35);
  ctx.fillRect(anchorX + 7, anchorY - 21, 14, 35);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(anchorX - 7, anchorY - 21, 14, 28);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(anchorX - 2.8, anchorY - 17.5, 5.6, 21);

  // Head
  ctx.fillStyle = '#fde047';
  ctx.fillRect(anchorX - 17.5, anchorY - 56, 35, 38.5);
  ctx.fillRect(anchorX - 7, anchorY - 21, 14, 7);

  // Hair (front)
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(anchorX - 19.6, anchorY - 63, 39.2, 12.6);
  ctx.fillRect(anchorX - 19.6, anchorY - 54.6, 8.4, 14);

  // Glasses
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(anchorX - 15.4, anchorY - 45.5, 12.6, 9.8);
  ctx.fillRect(anchorX + 2.8, anchorY - 45.5, 12.6, 9.8);
  ctx.fillRect(anchorX - 2.8, anchorY - 42.7, 5.6, 2.8);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(anchorX - 14, anchorY - 44.1, 9.8, 7);
  ctx.fillRect(anchorX + 4.2, anchorY - 44.1, 9.8, 7);

  ctx.fillStyle = '#0f172a';
  if (anim.eyeState === 'open') {
    ctx.fillRect(anchorX - 9.8, anchorY - 42, 2.8, 3.5);
    ctx.fillRect(anchorX + 8.4, anchorY - 42, 2.8, 3.5);
  } else {
    ctx.fillRect(anchorX - 12.6, anchorY - 40.6, 7, 1.4);
    ctx.fillRect(anchorX + 5.6, anchorY - 40.6, 7, 1.4);
  }

  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(anchorX - 1.4, anchorY - 36.4, 2.8, 4.2);

  ctx.fillStyle = '#991b1b';
  if (anim.mouthOpen) {
    ctx.fillRect(anchorX - 5.6, anchorY - 28, 11.2, 5.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(anchorX - 4.2, anchorY - 28, 8.4, 1.4);
  } else {
    ctx.fillRect(anchorX - 5.6, anchorY - 26.6, 11.2, 2.1);
  }
}

/**
 * Draws the news desk and microphone in the foreground.
 * @param {!CanvasRenderingContext2D} ctx
 */
function drawStudioForeground(ctx) {
  // Start the desk at the canvas midpoint, allowing for the top panel overhang.
  const deskX = CANVAS_WIDTH / 2 - 7;
  const deskY = CANVAS_HEIGHT - 70 - 7;
  const deskW = CANVAS_WIDTH / 2;
  const deskH = 70;

  ctx.fillStyle = '#451a03';
  ctx.fillRect(deskX, deskY, deskW, deskH);

  ctx.fillStyle = '#78350f';
  // Desk top panel
  ctx.fillRect(deskX - 7, deskY - 10.5, deskW + 14, 10.5);

  // Place the microphone beside the presenter on the right side of the desk.
  const micX = deskX + deskW - 43;
  const micY = deskY - 28;

  ctx.fillStyle = '#334155';
  ctx.fillRect(micX - 5.6, micY + 14, 11.2, 3.5);
  ctx.fillRect(micX - 1.4, micY, 2.8, 14);

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(micX - 3.5, micY - 7, 7, 8.4);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(micX - 3.5, micY - 2.8, 7, 1.4);
}

/**
 * Caches DOM nodes used by the studio UI.
 */
function cacheElements() {
  els.mainBroadcastContainer = document.getElementById('main-broadcast-container');
  els.studioControls = document.getElementById('studio-controls');
  els.studioFooter = document.getElementById('studio-footer');
  els.scanlineOverlay = document.getElementById('scanline-overlay');
  els.scanlinesStatus = document.getElementById('scanlines-status');
  els.scanlinesBtn = document.getElementById('scanlines-btn');
  els.tvModeBtn = document.getElementById('tv-mode-btn');
  els.copyBtn = document.getElementById('copy-btn');
  els.inputImgUrl = document.getElementById('input-img-url');
  els.inputTickerText = document.getElementById('input-ticker-text');
  els.tickerText = document.getElementById('ticker-text');
  els.shareUrlInput = document.getElementById('share-url-input');
  els.clockDisplay = document.getElementById('clock-display');
  els.pixelCanvas = document.getElementById('pixel-canvas');
}

/**
 * Wires button, input, keyboard, and hash listeners.
 * @param {function(string): void} loadBgImage
 */
function bindUiEvents(loadBgImage) {
  if (els.tvModeBtn) {
    els.tvModeBtn.addEventListener('click', () => setTvMode());
  }
  if (els.scanlinesBtn) {
    els.scanlinesBtn.addEventListener('click', toggleScanlines);
  }
  if (els.copyBtn) {
    els.copyBtn.addEventListener('click', () => {
      copyShareUrl();
    });
  }

  els.inputImgUrl.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    loadBgImage(val || DEFAULT_BG_URL);
    updateShareUrl();
  });

  els.inputTickerText.addEventListener('input', (e) => {
    els.tickerText.textContent = e.target.value;
    updateShareUrl();
  });

  window.addEventListener('hashchange', () => parseHash(loadBgImage));

  document.addEventListener('keydown', (e) => {
    const typing = document.activeElement === els.inputImgUrl ||
        document.activeElement === els.inputTickerText;
    const key = e.key.toLowerCase();

    if ((key === 't' || key === 'f') && !typing) {
      setTvMode();
    } else if (e.key === 'Escape' && state.tvMode) {
      setTvMode(false);
    }
  });
}

/**
 * Starts the canvas animation loop and studio bootstrap.
 */
function initStudio() {
  cacheElements();
  applyScanlineMonitorHole();

  const canvas = /** @type {!HTMLCanvasElement} */ (els.pixelCanvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  let bgImage = new Image();
  let isBgLoaded = false;

  /**
   * Loads a background image URL onto the studio monitor.
   * @param {string} url
   */
  function loadBgImage(url) {
    isBgLoaded = false;
    bgImage = new Image();
    bgImage.onload = () => {
      isBgLoaded = true;
    };
    bgImage.onerror = () => {
      isBgLoaded = false;
    };
    bgImage.src = url;
  }

  const anim = {
    mouthOpen: false,
    eyeState: 'open',
    headOffsetY: 0,
  };

  let tick = 0;

  /** Renders one animation frame. */
  function render() {
    tick++;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawStudioBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBackstageScreen(ctx, bgImage, isBgLoaded);
    drawAnchor(ctx, tick, anim);
    drawStudioForeground(ctx);

    requestAnimationFrame(render);
  }

  bindUiEvents(loadBgImage);
  setInterval(updateClock, 1000);
  updateClock();
  parseHash(loadBgImage);
  render();
}

document.addEventListener('DOMContentLoaded', initStudio);
