'use strict';

// ─────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────
var CONFIG = {
  lat:              34.0289,    // Johns Creek, GA
  lon:             -84.1986,
  zoom:             7,
  weatherRefreshMs: 15 * 60 * 1000,
  radarRefreshMs:   5 * 60 * 1000,  // 5 minutes (more frequent)
  animDelayMs:      1200
};

// ─────────────────────────────────────────────────────────────────
//  WMO WEATHER CODE MAP
// ─────────────────────────────────────────────────────────────────
var WMO = {
  0:  { l: 'Clear Sky',      i: '☀️'  },
  1:  { l: 'Mainly Clear',   i: '🌤️' },
  2:  { l: 'Partly Cloudy',  i: '⛅'  },
  3:  { l: 'Overcast',       i: '☁️'  },
  45: { l: 'Foggy',          i: '🌫️' },
  48: { l: 'Rime Fog',       i: '🌫️' },
  51: { l: 'Light Drizzle',  i: '🌦️' },
  53: { l: 'Drizzle',        i: '🌦️' },
  55: { l: 'Heavy Drizzle',  i: '🌧️' },
  61: { l: 'Light Rain',     i: '🌧️' },
  63: { l: 'Rain',           i: '🌧️' },
  65: { l: 'Heavy Rain',     i: '🌧️' },
  71: { l: 'Light Snow',     i: '🌨️' },
  73: { l: 'Snow',           i: '❄️'  },
  75: { l: 'Heavy Snow',     i: '❄️'  },
  77: { l: 'Snow Grains',    i: '🌨️' },
  80: { l: 'Rain Showers',   i: '🌦️' },
  81: { l: 'Showers',        i: '🌧️' },
  82: { l: 'Heavy Showers',  i: '⛈️'  },
  95: { l: 'Thunderstorm',   i: '⛈️'  },
  96: { l: 'T-Storm + Hail', i: '⛈️'  },
  99: { l: 'Severe T-Storm', i: '⛈️'  }
};

// ─────────────────────────────────────────────────────────────────
//  CLOCK MODULE
// ─────────────────────────────────────────────────────────────────
var Clock = (function () {
  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function update() {
    var now = new Date();
    var h   = now.getHours();
    var m   = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('time-display').textContent =
      String((h % 12) || 12).padStart(2, '0') + ':' + m;
    document.getElementById('date-display').textContent =
      DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate();
  }

  function start() { update(); setInterval(update, 1000); }
  return { start: start };
})();

// ─────────────────────────────────────────────────────────────────
//  WEATHER MODULE
// ─────────────────────────────────────────────────────────────────
var Weather = (function () {

  function fetch(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude='  + lat + '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,' +
      'weather_code,wind_speed_10m,dew_point_2m,visibility' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto';

    window.fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) { render(d.current); })
      .catch(function () {
        document.getElementById('condition-text').textContent = 'Weather unavailable';
      });
  }

  function render(c) {
    var info  = WMO[c.weather_code] || { l: 'Unknown', i: '🌡️' };
    var visMi = c.visibility != null ? (c.visibility / 1609.34).toFixed(1) : '--';
    document.getElementById('temp-icon').textContent      = info.i;
    document.getElementById('temp-value').textContent     = Math.round(c.temperature_2m);
    document.getElementById('condition-text').textContent = info.l;
    document.getElementById('feels-like').textContent     =
      'Feels like ' + Math.round(c.apparent_temperature) + '°F';
    document.getElementById('s-humidity').innerHTML =
      c.relative_humidity_2m + '<span class="stat-unit">%</span>';
    document.getElementById('s-wind').innerHTML =
      Math.round(c.wind_speed_10m) + '<span class="stat-unit">mph</span>';
    document.getElementById('s-dew').innerHTML =
      Math.round(c.dew_point_2m) + '<span class="stat-unit">°F</span>';
    document.getElementById('s-vis').innerHTML =
      visMi + '<span class="stat-unit">mi</span>';
  }

  return { fetch: fetch };
})();

// ─────────────────────────────────────────────────────────────────
//  WINDY MODULE  (iframe — Wind / Temp / Clouds only)
// ─────────────────────────────────────────────────────────────────
var Windy = (function () {

  function buildUrl(lat, lon, zoom, overlay, product) {
    return 'https://embed.windy.com/embed2.html?' + [
      'lat=' + lat, 'lon=' + lon,
      'detailLat=' + lat, 'detailLon=' + lon,
      'zoom=' + zoom, 'level=surface',
      'overlay=' + overlay, 'product=' + product,
      'menu=', 'message=true', 'marker=true', 'calendar=now',
      'pressure=', 'type=map', 'location=coordinates', 'detail=',
      'metricWind=mph', 'metricTemp=%C2%B0F', 'radarRange=-1'
    ].join('&');
  }

  function load(lat, lon, zoom, overlay, product) {
    document.getElementById('windy-frame').src = buildUrl(lat, lon, zoom, overlay, product);
    var label = overlay.charAt(0).toUpperCase() + overlay.slice(1);
    document.getElementById('pill-text').textContent = label + ' · Windy Live';
  }

  return { load: load };
})();

// ─────────────────────────────────────────────────────────────────
//  RAINVIEWER MODULE
//
//  Uses ONE tile layer. Animation uses chained setTimeout so we
//  never swap the URL before the previous frame finishes loading.
//  This eliminates NS_BINDING_ABORTED completely.
// ─────────────────────────────────────────────────────────────────
var RainViewer = (function () {

  var map         = null;
  var radarLayer  = null;
  var frames      = [];
  var animPos     = 0;
  var animTimer   = null;
  var playing     = false;
  var apiData     = {};
  var colorScheme = 6;
  var lastUpdated = null;

  var TILE_SIZE = 256;
  var OPACITY   = 0.85;

  function tileUrl(path) {
    return apiData.host + path + '/' + TILE_SIZE +
           '/{z}/{x}/{y}/' + colorScheme + '/1_1.png';
  }

  // ── Map init ──────────────────────────────────────────
  function initMap(lat, lon, zoom) {
    if (map) return;

    map = L.map('leaflet-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lon], zoom);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, subdomains: 'abcd' }
    ).addTo(map);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, subdomains: 'abcd', zIndex: 10, opacity: 0.7 }
    ).addTo(map);

    setTimeout(function () { map.invalidateSize(); }, 150);
    initScrubberEvents();
  }

  // ── Fetch frame list ──────────────────────────────────
  function fetchData(onReady) {
    window.fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        apiData = data;
        var past    = (data.radar.past    || []).map(function (f) {
          return { time: f.time, path: f.path, type: 'past' };
        });
        var nowcast = (data.radar.nowcast || []).map(function (f) {
          return { time: f.time, path: f.path, type: 'nowcast' };
        });
        frames = past.concat(nowcast);
        lastUpdated = new Date();
        updateLastUpdatedDisplay();
        buildTicks();
        if (typeof onReady === 'function') onReady();
      })
      .catch(function (e) { console.error('[RainViewer] fetch failed:', e); });
  }

  function updateLastUpdatedDisplay() {
    if (!lastUpdated) return;
    var h = lastUpdated.getHours();
    var m = String(lastUpdated.getMinutes()).padStart(2, '0');
    var timeStr = ((h % 12) || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
    document.getElementById('rb-updated-time').textContent = timeStr;
  }

  // ── Show one frame ────────────────────────────────────
  //  andThenPlay: if true, schedule the next frame after load
  function showFrame(pos, andThenPlay) {
    if (!frames.length || !map) return;

    pos     = ((pos % frames.length) + frames.length) % frames.length;
    animPos = pos;

    var url = tileUrl(frames[pos].path);

    if (!radarLayer) {
      radarLayer = L.tileLayer(url, {
        opacity: OPACITY, zIndex: 5, transparent: true
      }).addTo(map);
    } else {
      radarLayer.setUrl(url);
    }

    updateBarUI(pos);
    updateTimeLabel(frames[pos]);

    if (andThenPlay) scheduleNext();
  }

  // ── Schedule next frame after current tiles load ──────
  function scheduleNext() {
    if (!playing) return;
    clearPending();

    var fired = false;

    function advance() {
      if (fired || !playing) return;
      fired = true;
      if (radarLayer) radarLayer.off('load', advance);
      clearPending();
      animTimer = setTimeout(function () {
        if (!playing) return;
        
        // Check if we're at the last frame
        if (animPos >= frames.length - 1) {
          // Auto-refresh: fetch new data and loop back to start
          var updateBox = document.getElementById('rb-updated');
          
          fetchData(function () {
            animPos = 0; // Loop back to beginning with fresh data
            showFrame(animPos, true);
            
            // Highlight the updated time briefly
            updateBox.classList.add('just-updated');
            setTimeout(function () {
              updateBox.classList.remove('just-updated');
            }, 2000);
          });
        } else {
          showFrame(animPos + 1, true);
        }
      }, CONFIG.animDelayMs);
    }

    // Advance when tiles finish loading …
    if (radarLayer) radarLayer.once('load', advance);
    // … but no longer than 2× animDelayMs regardless
    animTimer = setTimeout(advance, CONFIG.animDelayMs * 2);
  }

  function clearPending() {
    if (animTimer) { clearTimeout(animTimer); animTimer = null; }
  }

  // ── Play / stop ───────────────────────────────────────
  function play() {
    if (!frames.length) return;
    clearPending();
    playing = true;
    document.getElementById('rb-play').textContent = '⏸';
    showFrame(animPos, true);
  }

  function stop() {
    playing = false;
    clearPending();
    document.getElementById('rb-play').textContent = '▶';
  }

  function togglePlay() { if (playing) stop(); else play(); }

  // ── Color scheme (Radar ↔ Rain) ───────────────────────
  function setColorScheme(scheme) {
    colorScheme = scheme;
    if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
    showFrame(animPos, false);
  }

  // ── Pan map ───────────────────────────────────────────
  function panTo(lat, lon) {
    if (map) map.setView([lat, lon], CONFIG.zoom);
  }

  // ── Manual refresh ────────────────────────────────────
  function refresh() {
    var wasPlaying = playing;
    var btn = document.getElementById('rb-refresh');
    var updateBox = document.getElementById('rb-updated');
    
    if (wasPlaying) stop();
    
    // Show loading state
    btn.classList.add('refreshing');
    
    fetchData(function () {
      // Jump to the most recent frame after refresh
      animPos = frames.length - 1;
      showFrame(animPos, false);
      
      // Remove loading state
      btn.classList.remove('refreshing');
      
      // Highlight the updated time briefly
      updateBox.classList.add('just-updated');
      setTimeout(function () {
        updateBox.classList.remove('just-updated');
      }, 2000);
      
      if (wasPlaying) play();
    });
  }

  // ── Build tick marks ──────────────────────────────────
  function buildTicks() {
    var container = document.getElementById('rb-ticks');
    container.innerHTML = '';
    frames.forEach(function (frame, i) {
      var tick = document.createElement('div');
      tick.className = 'rb-tick' + (frame.type === 'nowcast' ? ' rb-tick-fc' : '');
      tick.title = formatTime(frame.time);
      tick.addEventListener('click', function () { stop(); showFrame(i, false); });
      container.appendChild(tick);
    });
  }

  function updateBarUI(pos) {
    var pct = frames.length > 1 ? (pos / (frames.length - 1)) * 100 : 0;
    document.getElementById('rb-fill').style.width = pct + '%';
    document.getElementById('rb-thumb').style.left = pct + '%';
    document.querySelectorAll('.rb-tick').forEach(function (t, i) {
      t.classList.toggle('active', i === pos);
    });
  }

  function updateTimeLabel(frame) {
    document.getElementById('rb-time').textContent = formatTime(frame.time);
    var badge = document.getElementById('rb-label');
    badge.textContent = frame.type === 'nowcast' ? 'FORECAST' : 'PAST';
    badge.className   = 'rb-label-badge' + (frame.type === 'nowcast' ? ' fc' : '');
  }

  function formatTime(ts) {
    var d  = new Date(ts * 1000);
    var h  = d.getHours();
    var m  = String(d.getMinutes()).padStart(2, '0');
    return ((h % 12) || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  // ── Scrubber drag ─────────────────────────────────────
  function initScrubberEvents() {
    var track    = document.getElementById('rb-track');
    var dragging = false;

    function seek(e) {
      var rect    = track.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var pct     = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      stop();
      showFrame(Math.round(pct * (frames.length - 1)), false);
    }

    track.addEventListener('mousedown',  function (e) { dragging = true; seek(e); });
    track.addEventListener('touchstart', function (e) { dragging = true; seek(e); }, { passive: true });
    document.addEventListener('mousemove',  function (e) { if (dragging) seek(e); });
    document.addEventListener('touchmove',  function (e) { if (dragging) seek(e); }, { passive: true });
    document.addEventListener('mouseup',    function ()  { dragging = false; });
    document.addEventListener('touchend',   function ()  { dragging = false; });
  }

  // ── Start ─────────────────────────────────────────────
  function start(lat, lon, zoom) {
    initMap(lat, lon, zoom);
    fetchData(function () { showFrame(0, false); play(); });
    setInterval(function () {
      fetchData(function () { showFrame(animPos, playing); });
    }, CONFIG.radarRefreshMs);
  }

  // ── Manual refresh ────────────────────────────────────
  function refresh() {
    var btn = document.getElementById('rb-refresh');
    var updatedDiv = document.getElementById('rb-updated');
    
    // Add refreshing animation
    if (btn) btn.classList.add('refreshing');
    
    fetchData(function () {
      // Remove refreshing animation
      if (btn) btn.classList.remove('refreshing');
      
      // Add "just updated" highlight
      if (updatedDiv) {
        updatedDiv.classList.add('just-updated');
        setTimeout(function () {
          updatedDiv.classList.remove('just-updated');
        }, 2000);
      }
      
      // Continue playing if we were playing
      showFrame(animPos, playing);
    });
  }

  return { start: start, panTo: panTo, play: play, stop: stop,
           togglePlay: togglePlay, setColorScheme: setColorScheme, refresh: refresh };
})();

// ─────────────────────────────────────────────────────────────────
//  LOCATION MODULE
// ─────────────────────────────────────────────────────────────────
var Location = (function () {

  function reverseGeocode(lat, lon) {
    window.fetch('https://nominatim.openstreetmap.org/reverse?lat=' +
      lat + '&lon=' + lon + '&format=json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var a = data.address || {};
        var city  = a.city || a.town || a.village || a.county || 'Unknown';
        var state = a.state || '';
        document.getElementById('location-display').textContent =
          '📍 ' + city + (state ? ', ' + state : '');
      })
      .catch(function () {
        document.getElementById('location-display').textContent = '📍 Location detected';
      });
  }

  function detect(onSuccess, onFail) {
    document.getElementById('location-display').textContent = '📍 Detecting…';
    if (!navigator.geolocation) { onFail(); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) { onSuccess(pos.coords.latitude, pos.coords.longitude); },
      function ()    { onFail(); }
    );
  }

  return { detect: detect, reverseGeocode: reverseGeocode };
})();

// ─────────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────────
(function boot() {
  var lat  = CONFIG.lat;
  var lon  = CONFIG.lon;
  var zoom = CONFIG.zoom;

  Clock.start();
  Weather.fetch(lat, lon);
  setInterval(function () { Weather.fetch(lat, lon); }, CONFIG.weatherRefreshMs);

  RainViewer.start(lat, lon, zoom);

  document.getElementById('rb-play').addEventListener('click', function () {
    RainViewer.togglePlay();
  });

  document.getElementById('rb-refresh').addEventListener('click', function () {
    RainViewer.refresh();
  });

  var currentMode = 'rv';

  function applyMode(btn) {
    var mode = btn.getAttribute('data-mode');
    document.querySelectorAll('.ov-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');

    var leafletEl = document.getElementById('leaflet-map');
    var windyEl   = document.getElementById('windy-frame');
    var barEl     = document.getElementById('radar-bar');

    if (mode === 'rv') {
      leafletEl.classList.add('visible');
      windyEl.classList.remove('visible');
      barEl.classList.add('visible');
      RainViewer.setColorScheme(parseInt(btn.getAttribute('data-color') || '6', 10));
      RainViewer.play();
      document.getElementById('pill-text').textContent = 'Radar · RainViewer';
    } else {
      leafletEl.classList.remove('visible');
      windyEl.classList.add('visible');
      barEl.classList.remove('visible');
      RainViewer.stop();
      Windy.load(lat, lon, zoom,
        btn.getAttribute('data-overlay'),
        btn.getAttribute('data-product'));
    }
    currentMode = mode;
  }

  document.querySelectorAll('.ov-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { applyMode(btn); });
  });

  document.getElementById('locate-btn').addEventListener('click', function () {
    Location.detect(
      function (newLat, newLon) {
        lat = newLat; lon = newLon;
        Weather.fetch(lat, lon);
        Location.reverseGeocode(lat, lon);
        if (currentMode === 'rv') {
          RainViewer.panTo(lat, lon);
        } else {
          var active = document.querySelector('.ov-btn.active');
          Windy.load(lat, lon, zoom,
            active.getAttribute('data-overlay'),
            active.getAttribute('data-product'));
        }
      },
      function () {
        document.getElementById('location-display').textContent = '📍 Permission denied';
      }
    );
  });
})();