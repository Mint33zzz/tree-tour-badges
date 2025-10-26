const RADIUS_M = 20;
let stops = [];
let progress = JSON.parse(localStorage.getItem('tt_progress') || '{}');
let demoMode = false;

const els = {
  current: document.getElementById('current'),
  badgeGrid: document.getElementById('badgeGrid'),
  fill: document.getElementById('progressFill'),
  ptext: document.getElementById('progressText'),
  reset: document.getElementById('resetBtn'),
  demo: document.getElementById('demoMode'),
};

// 读取 stops.json
fetch('data/stops.json')
  .then(r => r.json())
  .then(data => {
    stops = data.map((s, i) => ({ ...s, idx: i }));
    renderAll();
  });

els.reset.addEventListener('click', () => {
  if (confirm('Clear your progress on this device?')) {
    localStorage.removeItem('tt_progress');
    progress = {};
    renderAll();
  }
});

els.demo.addEventListener('change', (e) => {
  demoMode = e.target.checked;
});

function renderAll() {
  renderProgress();
  renderCurrent();
  renderBadges();
}

function renderProgress() {
  const unlocked = Object.keys(progress).filter(k => progress[k]).length;
  const total = stops.length;
  const pct = total ? Math.round(unlocked / total * 100) : 0;
  els.fill.style.width = pct + '%';
  els.ptext.textContent = `${unlocked} / ${total} badges`;
}

function renderCurrent() {
  const nextStop = stops.find(s => !progress[s.id]) || stops[stops.length - 1];
  const idx = nextStop.idx + 1;
  els.current.innerHTML = `
    <div class="hero">
      <div class="emblem">${nextStop.emoji || "🌳"}</div>
      <div>
        <h2>#${idx} ${nextStop.name}</h2>
        <div class="meta">${nextStop.type}</div>
        <p>${nextStop.desc}</p>
      </div>
    </div>
    <div class="actions">
      <button class="btn" id="checkBtn">Check in</button>
      <button class="btn secondary" id="skipBtn">Skip</button>
    </div>
    <div class="hint"><b>Next hint:</b> ${nextStop.hint}</div>
  `;

  document.getElementById('checkBtn').addEventListener('click', () => doCheckIn(nextStop));
  document.getElementById('skipBtn').addEventListener('click', () => {
    if (confirm('Skip location check for this stop?')) {
      progress[nextStop.id] = true;
      localStorage.setItem('tt_progress', JSON.stringify(progress));
      renderAll();
    }
  });
}

function renderBadges() {
  els.badgeGrid.innerHTML = '';
  stops.forEach(s => {
    const unlocked = !!progress[s.id];
    const d = document.createElement('div');
    d.className = 'badge ' + (unlocked ? 'unlocked' : '');
    d.innerHTML = `<div>${s.emoji || '🌳'}</div>`;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = s.short || s.name;
    d.appendChild(label);
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
