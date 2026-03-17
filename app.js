'use strict';

// ─────────────────────────────────────────────────────────────────
//  CONFIG — the only place you need to touch to change location,
//  zoom, or default overlay.
// ─────────────────────────────────────────────────────────────────
var CONFIG = {
  lat:            34.0289,      // Johns Creek, GA
  lon:           -84.1986,
  zoom:           10,           // initial Windy zoom level
  defaultOverlay: 'radar',
  defaultProduct: 'radar',
  weatherRefreshMs: 15 * 60 * 1000   // how often to re-fetch weather (15 min)
};

// ─────────────────────────────────────────────────────────────────
//  WMO WEATHER CODE MAP
//  Maps Open-Meteo's WMO codes → human label + emoji icon.
// ─────────────────────────────────────────────────────────────────
var WMO = {
  0:  { l: 'Clear Sky',         i: '☀️'  },
  1:  { l: 'Mainly Clear',      i: '🌤️' },
  2:  { l: 'Partly Cloudy',     i: '⛅'  },
  3:  { l: 'Overcast',          i: '☁️'  },
  45: { l: 'Foggy',             i: '🌫️' },
  48: { l: 'Rime Fog',          i: '🌫️' },
  51: { l: 'Light Drizzle',     i: '🌦️' },
  53: { l: 'Drizzle',           i: '🌦️' },
  55: { l: 'Heavy Drizzle',     i: '🌧️' },
  61: { l: 'Light Rain',        i: '🌧️' },
  63: { l: 'Rain',              i: '🌧️' },
  65: { l: 'Heavy Rain',        i: '🌧️' },
  71: { l: 'Light Snow',        i: '🌨️' },
  73: { l: 'Snow',              i: '❄️'  },
  75: { l: 'Heavy Snow',        i: '❄️'  },
  77: { l: 'Snow Grains',       i: '🌨️' },
  80: { l: 'Rain Showers',      i: '🌦️' },
  81: { l: 'Showers',           i: '🌧️' },
  82: { l: 'Heavy Showers',     i: '⛈️'  },
  95: { l: 'Thunderstorm',      i: '⛈️'  },
  96: { l: 'T-Storm + Hail',    i: '⛈️'  },
  99: { l: 'Severe T-Storm',    i: '⛈️'  }
};

// ─────────────────────────────────────────────────────────────────
//  CLOCK MODULE
//  Updates #time-display and #date-display every second.
// ─────────────────────────────────────────────────────────────────
var Clock = (function () {
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];

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
//  Fetches current conditions from Open-Meteo (free, no key).
//  Renders into the sidebar conditions + stats cards.
// ─────────────────────────────────────────────────────────────────
var Weather = (function () {

  function fetch(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude='  + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,' +
      'weather_code,wind_speed_10m,dew_point_2m,visibility' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto';

    window.fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) { render(data.current); })
      .catch(function () {
        document.getElementById('condition-text').textContent = 'Weather unavailable';
      });
  }

  function render(c) {
    var info = WMO[c.weather_code] || { l: 'Unknown', i: '🌡️' };
    var visMi = c.visibility != null ? (c.visibility / 1609.34).toFixed(1) : '--';

    document.getElementById('temp-icon').textContent      = info.i;
    document.getElementById('temp-value').textContent     = Math.round(c.temperature_2m);
    document.getElementById('condition-text').textContent = info.l;
    document.getElementById('feels-like').textContent     = 'Feels like ' + Math.round(c.apparent_temperature) + '°F';
    document.getElementById('s-humidity').innerHTML       = c.relative_humidity_2m + '<span class="stat-unit">%</span>';
    document.getElementById('s-wind').innerHTML           = Math.round(c.wind_speed_10m) + '<span class="stat-unit">mph</span>';
    document.getElementById('s-dew').innerHTML            = Math.round(c.dew_point_2m) + '<span class="stat-unit">°F</span>';
    document.getElementById('s-vis').innerHTML            = visMi + '<span class="stat-unit">mi</span>';
  }

  return { fetch: fetch };
})();

// ─────────────────────────────────────────────────────────────────
//  WINDY MODULE
//  Builds the embed URL and manages the iframe + overlay buttons.
//  Windy's official embed endpoint: embed.windy.com/embed2.html
// ─────────────────────────────────────────────────────────────────
var Windy = (function () {

  function buildUrl(lat, lon, zoom, overlay, product) {
    var p = [
      'lat='         + lat,
      'lon='         + lon,
      'detailLat='   + lat,
      'detailLon='   + lon,
      'zoom='        + zoom,
      'level=surface',
      'overlay='     + overlay,
      'product='     + product,
      'menu=',
      'message=true',
      'marker=true',
      'calendar=now',
      'pressure=',
      'type=map',
      'location=coordinates',
      'detail=',
      'metricWind=mph',
      'metricTemp=%C2%B0F',
      'radarRange=-1'
    ];
    return 'https://embed.windy.com/embed2.html?' + p.join('&');
  }

  function load(lat, lon, zoom, overlay, product) {
    var frame = document.getElementById('windy-frame');
    frame.src = buildUrl(lat, lon, zoom, overlay, product);

    var label = overlay.charAt(0).toUpperCase() + overlay.slice(1);
    document.getElementById('pill-text').textContent = label + ' · Windy Live';
  }

  function initButtons(lat, lon, zoom) {
    document.querySelectorAll('.ov-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.ov-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        load(lat, lon, zoom,
          btn.getAttribute('data-overlay'),
          btn.getAttribute('data-product'));
      });
    });
  }

  return { load: load, initButtons: initButtons };
})();

// ─────────────────────────────────────────────────────────────────
//  LOCATION MODULE
//  Reverse-geocodes via Nominatim (free, no key) and updates the
//  sidebar label. Also triggers a weather + iframe refresh.
// ─────────────────────────────────────────────────────────────────
var Location = (function () {

  function reverseGeocode(lat, lon) {
    window.fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var a    = data.address || {};
        var city = a.city || a.town || a.village || a.county || 'Unknown';
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
//  BOOT — wires everything together
// ─────────────────────────────────────────────────────────────────
(function boot() {
  // Current active lat/lon (may be updated by geolocation)
  var lat  = CONFIG.lat;
  var lon  = CONFIG.lon;
  var zoom = CONFIG.zoom;

  // Start clock
  Clock.start();

  // Load Windy iframe at default location + overlay
  Windy.load(lat, lon, zoom, CONFIG.defaultOverlay, CONFIG.defaultProduct);
  Windy.initButtons(lat, lon, zoom);

  // Load weather panel
  Weather.fetch(lat, lon);

  // Auto-refresh weather on a timer
  setInterval(function () { Weather.fetch(lat, lon); }, CONFIG.weatherRefreshMs);

  // Geolocation — "Update Location" button
  document.getElementById('locate-btn').addEventListener('click', function () {
    Location.detect(
      function (newLat, newLon) {
        lat = newLat; lon = newLon;

        // Update weather panel
        Weather.fetch(lat, lon);
        Location.reverseGeocode(lat, lon);

        // Reload Windy iframe centered on new location
        var active = document.querySelector('.ov-btn.active');
        Windy.load(lat, lon, zoom,
          active.getAttribute('data-overlay'),
          active.getAttribute('data-product'));

        // Re-bind buttons with new coords
        Windy.initButtons(lat, lon, zoom);
      },
      function () {
        document.getElementById('location-display').textContent = '📍 Permission denied';
      }
    );
  });
})();
