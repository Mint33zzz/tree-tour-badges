const RADIUS_M = 20;
let stops = [];
let progress = JSON.parse(localStorage.getItem('tt_progress') || '{}');
let demoMode = false;
let currentStopId = null;

const els = {
  current: document.getElementById('current'),
  badgeGrid: document.getElementById('badgeGrid'),
  fill: document.getElementById('progressFill'),
  ptext: document.getElementById('progressText'),
  reset: document.getElementById('resetBtn'),
  clear: document.getElementById('clearBtn'),
  demo: document.getElementById('demoMode'),
  map: document.getElementById('map'),
};

let mapInstance = null;

fetch('data/stops.json')
  .then(r => r.json())
  .then(data => {
    stops = data.map((s, i) => ({ ...s, idx: i }));
    initMap();
    renderAll();
  })
  .catch(err => {
    console.error('Failed to load stops.json:', err);
    alert('Failed to load stops data. Please check if data/stops.json exists.');
  });

els.reset.addEventListener('click', () => {
  if (confirm('Clear your progress on this device?')) {
    localStorage.removeItem('tt_progress');
    progress = {};
    currentStopId = null;
    renderAll();
  }
});

els.clear.addEventListener('click', () => {
  if (currentStopId && progress[currentStopId]) {
    const stopName = stops.find(s => s.id === currentStopId)?.name;
    if (confirm(`Clear badge for "${stopName}" and return to initial state?`)) {
      delete progress[currentStopId];
      localStorage.setItem('tt_progress', JSON.stringify(progress));
      currentStopId = null;
      renderAll();
    }
  } else {
    alert('No unlocked badge to clear for current stop.');
  }
});

els.demo.addEventListener('change', (e) => {
  demoMode = e.target.checked;
});

function initMap() {
  if (stops.length === 0) return;
  
  const bounds = stops.reduce((acc, stop) => {
    if (!acc.minLat || stop.lat < acc.minLat) acc.minLat = stop.lat;
    if (!acc.maxLat || stop.lat > acc.maxLat) acc.maxLat = stop.lat;
    if (!acc.minLng || stop.lng < acc.minLng) acc.minLng = stop.lng;
    if (!acc.maxLng || stop.lng > acc.maxLng) acc.maxLng = stop.lng;
    return acc;
  }, { minLat: null, maxLat: null, minLng: null, maxLng: null });
  
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  
  mapInstance = L.map('map').setView([centerLat, centerLng], 16);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapInstance);
  
  renderMapMarkers();
}

function renderMapMarkers() {
  if (!mapInstance) return;
  
  mapInstance.eachLayer(layer => {
    if (layer instanceof L.CircleMarker) {
      mapInstance.removeLayer(layer);
    }
  });
  
  stops.forEach(stop => {
    const isUnlocked = !!progress[stop.id];
    const isCurrent = currentStopId === stop.id;
    
    const color = isUnlocked ? '#43b27b' : '#9ca3af';
    const borderColor = isCurrent ? '#ffdf5a' : '#fff';
    
    const marker = L.circleMarker([stop.lat, stop.lng], {
      radius: 10,
      fillColor: color,
      color: borderColor,
      weight: isCurrent ? 4 : 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(mapInstance);
    
    marker.bindPopup(`
      <div style="text-align:center;">
        <div style="font-size:1.5em;margin-bottom:4px;">${stop.emoji}</div>
        <b>${stop.name}</b><br>
        <small>#${stop.idx + 1} ${stop.type}</small>
        ${isUnlocked ? '<br><span style="color:#43b27b;">✓ Unlocked</span>' : ''}
      </div>
    `);
    
    marker.on('click', () => {
      currentStopId = stop.id;
      renderCurrent();
      const currentEl = document.getElementById('current');
      if (currentEl && typeof currentEl.scrollIntoView === 'function') {
        try {
          currentEl.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
          currentEl.scrollIntoView();
        }
      }
    });
  });
}

function renderAll() {
  renderProgress();
  renderCurrent();
  renderBadges();
  renderMapMarkers();
}

function renderProgress() {
  const unlocked = Object.keys(progress).filter(k => progress[k]).length;
  const total = stops.length;
  const pct = total ? Math.round(unlocked / total * 100) : 0;
  els.fill.style.width = pct + '%';
  els.ptext.textContent = `${unlocked} / ${total} badges`;
}

function renderCurrent() {
  let targetStop;
  
  if (currentStopId) {
    targetStop = stops.find(s => s.id === currentStopId);
    if (!targetStop) {
      targetStop = stops.find(s => !progress[s.id]) || stops[stops.length - 1];
      currentStopId = targetStop.id;
    }
  } else {
    targetStop = stops.find(s => !progress[s.id]) || stops[stops.length - 1];
    currentStopId = targetStop.id;
  }
  
  const isUnlocked = !!progress[targetStop.id];
  const idx = targetStop.idx + 1;
  
  els.current.innerHTML = `
    <div class="hero">
      <div class="emblem">${targetStop.emoji || "🌳"}</div>
      <div>
        <h2>#${idx} ${targetStop.name} ${isUnlocked ? '✓' : ''}</h2>
        <div class="meta">${targetStop.type}</div>
        <p>${targetStop.desc}</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn" id="checkBtn">${isUnlocked ? 'Re-check in' : 'Check in'}</button>
      <button class="btn secondary" id="skipBtn">Skip</button>
    </div>
    <div class="hint"><b>Next hint:</b> ${targetStop.hint}</div>
  `;
  
  document.getElementById('checkBtn').addEventListener('click', () => doCheckIn(targetStop));
  document.getElementById('skipBtn').addEventListener('click', () => {
    if (confirm('Skip location check for this stop?')) {
      progress[targetStop.id] = true;
      localStorage.setItem('tt_progress', JSON.stringify(progress));
      renderAll();
    }
  });
}

function renderBadges() {
  els.badgeGrid.innerHTML = '';
  stops.forEach(s => {
    const unlocked = !!progress[s.id];
    const isCurrent = currentStopId === s.id;
    const d = document.createElement('div');
    d.className = 'badge ' + (unlocked ? 'unlocked' : '') + (isCurrent ? ' current' : '');
    d.style.cursor = 'pointer';
    d.innerHTML = `<div>${s.emoji || '🌳'}</div>`;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = s.short || s.name;
    d.appendChild(label);
    
    d.addEventListener('click', () => {
      currentStopId = s.id;
      renderCurrent();
    });
    
    els.badgeGrid.appendChild(d);
  });
}

function doCheckIn(stop) {
  if (demoMode) {
    progress[stop.id] = true;
    localStorage.setItem('tt_progress', JSON.stringify(progress));
    renderAll();
    return;
  }

  if (!('geolocation' in navigator)) {
    alert('Geolocation not supported. Enable demo mode to proceed.');
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const d = distanceInMeters(
      pos.coords.latitude, pos.coords.longitude,
      stop.lat, stop.lng
    );
    if (d <= RADIUS_M) {
      progress[stop.id] = true;
      localStorage.setItem('tt_progress', JSON.stringify(progress));
      alert(`Badge unlocked: ${stop.name}! 🎉`);
      renderAll();
    } else {
      alert(`You are ${Math.round(d)}m away. Move closer (≤ ${RADIUS_M}m) or enable demo mode.`);
    }
  }, err => {
    alert('Location error: ' + err.message + '\nTip: allow location permission, or use demo mode.');
  }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
