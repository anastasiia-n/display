/**
 * @fileoverview Retro Pixel News Broadcast studio controls and canvas renderer.
 */

'use strict';

/** @const {string} Fallback background when no #img hash is set. */
const DEFAULT_BG_URL =
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23' +
    '?auto=format&fit=crop&w=1920&q=80';

/** @const {number} Canvas logical width in pixels. */
const CANVAS_WIDTH = 640;

/** @const {number} Canvas logical height in pixels. */
const CANVAS_HEIGHT = 360;

/** @const {number} Scale from logical scene coordinates to canvas pixels. */
const CANVAS_SCALE = 3;

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
 * @type {{tvMode: boolean, scanlinesActive: boolean, presenter: string}}
 */
const state = {
  tvMode: false,
  scanlinesActive: true,
  presenter: 'male',
};

const PRESENTER_IDS = ['male', 'female', 'cyber', 'robot'];
const PRESENTER_SCALE = 0.7;
const PRESENTER_DRAWERS = {
  male: drawMalePresenter,
  female: drawFemalePresenter,
  cyber: drawCyberPresenter,
  robot: drawRobotPresenter,
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
 * Updates the presenter control to show the active presenter.
 */
function updatePresenterButton() {
  if (els.presenterStatus) {
    els.presenterStatus.textContent = state.presenter.toUpperCase();
  }
  if (els.presenterBtn) {
    els.presenterBtn.setAttribute(
        'aria-label', `Change presenter. Current presenter: ${state.presenter}`);
  }
}

/**
 * Advances to the next presenter and updates the share URL.
 */
function cyclePresenter() {
  const currentIndex = PRESENTER_IDS.indexOf(state.presenter);
  state.presenter = PRESENTER_IDS[(currentIndex + 1) % PRESENTER_IDS.length];
  updatePresenterButton();
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
  params.set('presenter', state.presenter);
  if (state.tvMode) {
    params.set('tv', 'true');
  }

  const baseUrl = window.location.href.split('#')[0];
  const hashStr = params.toString();
  els.shareUrlInput.value = hashStr ? `${baseUrl}#${hashStr}` : baseUrl;
}

/**
 * Parses location.hash and applies img, ticker, presenter, and tv settings.
 * @param {function(string): void} loadBgImage Callback to load a background.
 */
function parseHash(loadBgImage) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const imgParam = params.get('img');
  const tickerParam = params.get('ticker');
  const presenterParam = params.get('presenter');
  const tvParam = params.get('tv') || params.get('tvmode');

  state.presenter = PRESENTER_IDS.includes(presenterParam) ?
      presenterParam : 'male';
  updatePresenterButton();

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
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws a procedural synthwave skyline scaled to the presenter stage.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} tick
 */
function drawNightCityGraphic(ctx, x, y, width, height, tick) {
  const animationTick = Math.floor(tick / 18);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(width / 600, height / 210);

  const sceneWidth = 600;
  const sceneHeight = 210;
  const sky = ctx.createLinearGradient(0, 0, 0, sceneHeight);
  sky.addColorStop(0, '#090514');
  sky.addColorStop(0.5, '#1e112a');
  sky.addColorStop(1, '#3b1843');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, sceneWidth, sceneHeight);

  const stars = [
    {x: 40, y: 20}, {x: 120, y: 35}, {x: 230, y: 15},
    {x: 310, y: 40}, {x: 410, y: 25}, {x: 490, y: 45},
  ];
  stars.forEach((star, index) => {
    if ((animationTick + index * 15) % 40 < 25) {
      ctx.fillStyle = index % 2 === 0 ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(star.x, star.y, 3, 3);
    }
  });

  ctx.fillStyle = '#1e1b4b';
  const farBuildings = [
    [0, 40, 70], [35, 30, 90], [60, 50, 60], [105, 40, 110],
    [140, 55, 80], [190, 35, 100], [220, 60, 75], [275, 45, 120],
    [315, 50, 85], [360, 40, 105], [395, 60, 70], [450, 50, 115],
    [495, 45, 80], [535, 65, 95],
  ];
  farBuildings.forEach(([buildingX, buildingW, buildingH]) => {
    ctx.fillRect(
        buildingX, sceneHeight - buildingH, buildingW, buildingH);
  });

  const nearBuildings = [
    [10, 50, 120, '#0f172a', '#06b6d4', false],
    [70, 40, 150, '#111827', '#f43f5e', true],
    [120, 65, 100, '#0f172a', '#a855f7', false],
    [195, 45, 165, '#111827', '#eab308', false],
    [250, 55, 130, '#0f172a', '#06b6d4', false],
    [315, 70, 110, '#111827', '#ec4899', false],
    [390, 45, 155, '#0f172a', '#22c55e', true],
    [445, 60, 125, '#111827', '#38bdf8', false],
    [515, 55, 140, '#0f172a', '#f43f5e', false],
  ];
  nearBuildings.forEach(
      ([buildingX, buildingW, buildingH, color, accent, hasAntenna], index) => {
        const buildingY = sceneHeight - buildingH;
        ctx.fillStyle = color;
        ctx.fillRect(buildingX, buildingY, buildingW, buildingH);

        if (hasAntenna) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(buildingX + buildingW / 2 - 1, buildingY - 20, 3, 20);
          ctx.fillStyle = animationTick % 30 < 15 ? '#ef4444' : '#7f1d1d';
          ctx.fillRect(buildingX + buildingW / 2 - 2, buildingY - 23, 5, 4);
        }

        for (let windowY = buildingY + 10;
          windowY < sceneHeight - 10; windowY += 14) {
          for (let windowX = buildingX + 6;
            windowX < buildingX + buildingW - 8; windowX += 10) {
            const isLit =
                ((windowX * 7 + windowY * 13 + animationTick / 10 + index) % 7) > 2;
            ctx.fillStyle = isLit ? accent : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(windowX, windowY, 5, 7);
          }
        }

        ctx.fillStyle = accent;
        ctx.fillRect(buildingX + buildingW - 3, buildingY, 2, buildingH);
      });

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, sceneHeight - 12, sceneWidth, 12);
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect((animationTick * 2) % (sceneWidth - 60), sceneHeight - 8, 40, 2);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(
      sceneWidth - ((animationTick * 1.5) % (sceneWidth - 40)),
      sceneHeight - 5, 30, 2);

  ctx.restore();
}

/**
 * Draws the city backdrop and dark spotlight vignette behind the presenter.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick
 */
function drawPresenterBackdrop(ctx, tick) {
  const stageX = MONITOR_X + MONITOR_WIDTH;
  const stageY = MONITOR_Y;
  const stageWidth = CANVAS_WIDTH - stageX;
  const stageHeight = CANVAS_HEIGHT - stageY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(stageX, stageY, stageWidth, stageHeight);
  ctx.clip();

  const cityWidth = stageWidth * 3;
  const cityHeight = stageHeight;
  const cityX = stageX - stageWidth;
  const cityY = stageY;
  drawNightCityGraphic(ctx, cityX, cityY, cityWidth, cityHeight, tick);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fillRect(stageX, stageY, stageWidth, stageHeight);

  const anchorX = stageX + stageWidth / 2;
  const anchorY = (CANVAS_HEIGHT / 2) + 70 - 30;
  const spotlight = ctx.createRadialGradient(
      anchorX, anchorY, 10, anchorX, anchorY, stageWidth * 0.9);
  spotlight.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  spotlight.addColorStop(0.6, 'rgba(15, 23, 42, 0.35)');
  spotlight.addColorStop(1, 'rgba(2, 6, 23, 0.15)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(stageX, stageY, stageWidth, stageHeight);
  ctx.restore();
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
 * Draws one of the animated pixel-art presenters.
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

  anim.headOffsetY = Math.sin(tick * 0.08) * 1.5;
  const anchorX = MONITOR_X + MONITOR_WIDTH +
      ((CANVAS_WIDTH - (MONITOR_X + MONITOR_WIDTH)) / 2);
  const anchorY = (CANVAS_HEIGHT / 2) + 70;
  ctx.save();
  ctx.translate(anchorX, anchorY);
  ctx.scale(PRESENTER_SCALE, PRESENTER_SCALE);
  PRESENTER_DRAWERS[state.presenter](ctx, tick, anim);
  ctx.restore();
}

/**
 * Draws the male presenter with glasses, dark hair, and a charcoal suit.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick
 * @param {{mouthOpen: boolean, eyeState: string, headOffsetY: number}} anim
 */
function drawMalePresenter(ctx, tick, anim) {
  const y = anim.headOffsetY;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-25, y - 96, 50, 40);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-23, y - 96, 12, 10);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-45, y - 30, 90, 80);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-28, y - 30, 18, 50);
  ctx.fillRect(10, y - 30, 18, 50);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-10, y - 30, 20, 40);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-4, y - 25, 8, 30);

  ctx.fillStyle = '#b45309';
  ctx.fillRect(-23, y - 82, 46, 56);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(-21, y - 80, 42, 52);
  ctx.fillRect(-8, y - 30, 16, 10);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-25, y - 94, 50, 18);
  ctx.fillRect(-25, y - 82, 8, 20);
  ctx.fillRect(17, y - 82, 8, 20);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-25, y - 80, 3, 12);
  ctx.fillRect(22, y - 80, 3, 12);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-22, y - 66, 18, 14);
  ctx.fillRect(4, y - 66, 18, 14);
  ctx.fillRect(-4, y - 62, 8, 3);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-20, y - 64, 14, 10);
  ctx.fillRect(6, y - 64, 14, 10);
  ctx.fillStyle = '#0f172a';
  if (anim.eyeState === 'open') {
    ctx.fillRect(-14, y - 61, 4, 5);
    ctx.fillRect(12, y - 61, 4, 5);
  } else {
    ctx.fillRect(-18, y - 59, 10, 2);
    ctx.fillRect(8, y - 59, 10, 2);
  }
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-2, y - 53, 4, 6);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-21, y - 44, 42, 18);
  ctx.fillRect(-10, y - 48, 20, 5);
  ctx.fillStyle = '#450a0a';
  if (anim.mouthOpen) {
    ctx.fillRect(-8, y - 42, 16, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, y - 42, 12, 2);
  } else {
    ctx.fillRect(-8, y - 41, 16, 3);
  }
}

/**
 * Draws the female presenter with brown hair and a red blazer.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick
 * @param {{mouthOpen: boolean, eyeState: string, headOffsetY: number}} anim
 */
function drawFemalePresenter(ctx, tick, anim) {
  const y = anim.headOffsetY;
  ctx.fillStyle = '#291d18';
  ctx.fillRect(-28, y - 92, 56, 82);
  ctx.fillStyle = '#45281d';
  ctx.fillRect(-26, y - 90, 52, 80);
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-42, y - 30, 84, 80);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-40, y - 28, 80, 78);
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-24, y - 28, 14, 48);
  ctx.fillRect(10, y - 28, 14, 48);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-10, y - 28, 20, 36);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(-6, y - 22, 3, 3);
  ctx.fillRect(-1, y - 20, 3, 3);
  ctx.fillRect(4, y - 22, 3, 3);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(-8, y - 36, 16, 16);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-7, y - 36, 14, 4);

  ctx.fillStyle = '#fde047';
  ctx.fillRect(-21, y - 82, 42, 46);
  ctx.fillRect(-17, y - 36, 34, 6);
  ctx.fillRect(-11, y - 30, 22, 4);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-18, y - 80, 36, 42);
  ctx.fillRect(-14, y - 38, 28, 6);
  ctx.fillRect(-9, y - 32, 18, 3);

  ctx.fillStyle = '#543322';
  ctx.fillRect(-24, y - 94, 48, 18);
  ctx.fillRect(-25, y - 80, 8, 44);
  ctx.fillRect(17, y - 80, 8, 44);
  ctx.fillStyle = '#784833';
  ctx.fillRect(-16, y - 92, 32, 4);
  ctx.fillRect(-23, y - 78, 3, 38);
  ctx.fillRect(20, y - 78, 3, 38);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-22, y - 48, 3, 5);
  ctx.fillRect(19, y - 48, 3, 5);

  ctx.fillStyle = '#3a2016';
  ctx.fillRect(-14, y - 66, 8, 2);
  ctx.fillRect(6, y - 66, 8, 2);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-15, y - 62, 10, 2);
  ctx.fillRect(5, y - 62, 10, 2);
  if (anim.eyeState === 'open') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, y - 60, 8, 5);
    ctx.fillRect(6, y - 60, 8, 5);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-12, y - 60, 4, 5);
    ctx.fillRect(8, y - 60, 4, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-11, y - 59, 2, 3);
    ctx.fillRect(9, y - 59, 2, 3);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14, y - 59, 8, 2);
    ctx.fillRect(6, y - 59, 8, 2);
  }
  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(-1, y - 52, 3, 4);
  ctx.fillStyle = '#f43f5e';
  ctx.globalAlpha = 0.3;
  ctx.fillRect(-16, y - 48, 5, 3);
  ctx.fillRect(11, y - 48, 5, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#be123c';
  if (anim.mouthOpen) {
    ctx.fillRect(-7, y - 43, 14, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, y - 43, 10, 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-5, y - 38, 10, 2);
  } else {
    ctx.fillRect(-7, y - 42, 14, 3);
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(-5, y - 42, 10, 1);
  }
}

/**
 * Draws the cyberpunk presenter with neon hair and a glowing visor.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick
 * @param {{mouthOpen: boolean, eyeState: string, headOffsetY: number}} anim
 */
function drawCyberPresenter(ctx, tick, anim) {
  const y = anim.headOffsetY;
  ctx.fillStyle = '#831843';
  ctx.fillRect(-32, y - 104, 64, 45);
  ctx.fillStyle = '#3b0764';
  ctx.fillRect(-45, y - 30, 90, 80);
  ctx.fillStyle = '#581c87';
  ctx.fillRect(-42, y - 28, 84, 78);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(-32, y - 30, 10, 42);
  ctx.fillRect(22, y - 30, 10, 42);
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(-30, y - 28, 2, 40);
  ctx.fillRect(28, y - 28, 2, 40);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-12, y - 28, 24, 40);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(-2, y - 25, 4, 30);
  ctx.fillStyle = '#fdba74';
  ctx.fillRect(-10, y - 36, 20, 16);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-12, y - 30, 24, 4);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect((tick % 20 < 10) ? -8 : 6, y - 29, 3, 2);
  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(-22, y - 82, 44, 52);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-26, y - 72, 6, 20);
  ctx.fillRect(20, y - 72, 6, 20);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(-25, y - 68, 2, 12);
  ctx.fillRect(23, y - 68, 2, 12);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(-28, y - 102, 56, 26);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(-22, y - 106, 10, 12);
  ctx.fillRect(-6, y - 108, 12, 14);
  ctx.fillRect(10, y - 104, 10, 10);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-25, y - 72, 50, 24);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(-23, y - 70, 46, 20);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(-23, y - 64, 46, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-18 + ((tick * 3) % 36), y - 68, 8, 16);
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(-20 + ((tick * 2) % 38), y - 60, 4, 2);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-2, y - 46, 4, 4);
  ctx.fillStyle = '#0284c7';
  if (anim.mouthOpen) {
    ctx.fillRect(-8, y - 38, 16, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-6, y - 36, 12, 4);
  } else {
    ctx.fillRect(-8, y - 37, 16, 3);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-4, y - 36, 8, 1);
  }
}

/**
 * Draws the robot presenter with a metallic body and animated display.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {number} tick
 * @param {{mouthOpen: boolean, eyeState: string, headOffsetY: number}} anim
 */
function drawRobotPresenter(ctx, tick, anim) {
  const y = anim.headOffsetY;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-46, y - 31, 92, 82);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-44, y - 29, 88, 78);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-42, y - 29, 84, 8);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-40, y - 26, 3, 3);
  ctx.fillRect(37, y - 26, 3, 3);
  ctx.fillRect(-40, y + 20, 3, 3);
  ctx.fillRect(37, y + 20, 3, 3);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-22, y - 18, 44, 32);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-20, y - 16, 40, 28);
  ctx.fillStyle = tick % 20 < 10 ? '#22c55e' : '#16a34a';
  const signalHeight = 4 + (tick % 12);
  ctx.fillRect(-15, y + 4 - signalHeight, 6, signalHeight);
  ctx.fillRect(-5, y + 4 - signalHeight / 2, 6, signalHeight / 2);
  ctx.fillRect(5, y + 4 - signalHeight * 0.8, 6, signalHeight * 0.8);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-12, y - 40, 24, 14);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-10, y - 38, 20, 3);
  ctx.fillRect(-10, y - 32, 20, 3);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-30, y - 88, 60, 52);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-28, y - 86, 56, 48);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-26, y - 86, 52, 6);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-4, y - 102, 8, 16);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-2, y - 100, 4, 14);
  ctx.fillStyle = tick % 16 < 8 ? '#ef4444' : '#7f1d1d';
  ctx.fillRect(-7, y - 109, 14, 8);
  if (tick % 16 < 8) {
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(-3, y - 107, 6, 4);
  }
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-34, y - 72, 6, 20);
  ctx.fillRect(28, y - 72, 6, 20);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-33, y - 68, 2, 12);
  ctx.fillRect(31, y - 68, 2, 12);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(-22, y - 78, 44, 36);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-21, y - 77, 42, 34);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (let i = 0; i < 34; i += 3) {
    ctx.fillRect(-21, y - 77 + i, 42, 1);
  }
  ctx.fillStyle = '#fef08a';
  if (anim.eyeState === 'open') {
    ctx.fillRect(-16, y - 72, 10, 10);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-14, y - 70, 6, 6);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(6, y - 72, 10, 10);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(8, y - 70, 6, 6);
  } else {
    ctx.fillRect(-16, y - 67, 10, 2);
    ctx.fillRect(6, y - 67, 10, 2);
  }
  ctx.fillStyle = '#22c55e';
  if (anim.mouthOpen) {
    const b1 = Math.min(10, 3 + (tick % 7));
    const b2 = Math.min(12, 5 + (tick % 5));
    const b3 = Math.min(10, 4 + (tick % 8));
    ctx.fillRect(-14, y - 50 - b1, 5, b1 + 2);
    ctx.fillRect(-7, y - 50 - b2, 5, b2 + 2);
    ctx.fillRect(0, y - 50 - b3, 5, b3 + 2);
    ctx.fillRect(7, y - 50 - b1, 5, b1 + 2);
  } else {
    ctx.fillRect(-14, y - 50, 26, 2);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-8, y - 50, 14, 2);
  }
}

/**
 * Draws the news desk and microphone in the foreground.
 * @param {!CanvasRenderingContext2D} ctx
 */
function drawStudioForeground(ctx) {
  // Start the desk at the canvas midpoint, allowing for the top panel overhang.
  const deskX = CANVAS_WIDTH / 2;
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
  els.presenterBtn = document.getElementById('presenter-btn');
  els.presenterStatus = document.getElementById('presenter-status');
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
  if (els.presenterBtn) {
    els.presenterBtn.addEventListener('click', cyclePresenter);
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
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

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
    drawPresenterBackdrop(ctx, tick);
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
