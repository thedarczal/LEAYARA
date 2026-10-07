const $ = id => document.getElementById(id);
const token = () => localStorage.getItem('token');
let mode = 'login', imageFile = null, lastResult = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token() || '') },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token()) logout();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

/* ---------- Animasi tombol: cahaya mengikuti kursor + efek riak saat klik ---------- */
document.addEventListener('mousemove', e => {
  const b = e.target.closest('.btn');
  if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--x', e.clientX - r.left + 'px');
  b.style.setProperty('--y', e.clientY - r.top + 'px');
});
function ripple(btn, x, y) {
  const r = btn.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const el = document.createElement('span');
  el.className = 'ripple';
  el.style.cssText = `width:${s}px;height:${s}px;left:${x - r.left - s / 2}px;top:${y - r.top - s / 2}px`;
  btn.appendChild(el);
  setTimeout(() => el.remove(), 700);
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn');
  if (b && !b.disabled) ripple(b, e.clientX, e.clientY);
});
// Tekan Enter di kolom isian -> tombol "tertekan" lalu terkirim
$('auth-form').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const b = $('auth-submit'), r = b.getBoundingClientRect();
  b.classList.add('pressed');
  ripple(b, r.left + r.width / 2, r.top + r.height / 2);
  setTimeout(() => b.classList.remove('pressed'), 180);
});

/* ---------- Masuk / Daftar ---------- */
function setMode(m) {
  mode = m;
  $('tab-login').classList.toggle('active', m === 'login');
  $('tab-register').classList.toggle('active', m === 'register');
  document.querySelector('.tabs').classList.toggle('reg', m === 'register');
  $('auth-form').classList.toggle('reg', m === 'register');
  $('auth-submit').querySelector('.label').textContent = m === 'login' ? 'Masuk' : 'Buat akun';
  $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('auth-error').textContent = '';
}
$('tab-login').onclick = () => setMode('login');
$('tab-register').onclick = () => setMode('register');

$('auth-form').onsubmit = async e => {
  e.preventDefault();
  const btn = $('auth-submit');
  btn.classList.add('loading'); $('auth-error').textContent = '';
  try {
    const [data] = await Promise.all([
      api('/api/' + mode, 'POST', { name: $('name').value, email: $('email').value, password: $('password').value }),
      sleep(500)
    ]);
    localStorage.setItem('token', data.token);
    localStorage.setItem('name', data.name);
    btn.classList.replace('loading', 'done');
    await sleep(700);
    $('auth').classList.add('leave');
    await sleep(450);
    showApp(true);
    btn.classList.remove('done'); $('auth').classList.remove('leave');
  } catch (err) {
    btn.classList.remove('loading');
    $('auth-error').textContent = err.message;
    $('auth-form').classList.remove('shake'); void $('auth-form').offsetWidth; $('auth-form').classList.add('shake');
  }
};

function logout() {
  localStorage.clear();
  $('app').hidden = true; $('auth').hidden = false;
  $('auth-form').reset();
}
$('logout').onclick = logout;

function showApp(animate) {
  $('auth').hidden = true; $('app').hidden = false;
  if (animate) $('app').classList.add('enter');
  $('who').textContent = 'Halo, ' + (localStorage.getItem('name') || '');
  loadHistory();
}

/* ---------- Upload foto ---------- */
function setFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  imageFile = f;
  $('preview').src = URL.createObjectURL(f);
  $('preview').hidden = false; $('drop-hint').hidden = true;
  $('analyze').disabled = false; $('result').hidden = true;
  document.querySelectorAll('#pipe li').forEach((li, i) => li.classList.toggle('on', i === 0));
}
$('file').onchange = e => setFile(e.target.files[0]);
$('drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
['dragover', 'dragenter'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => $('drop').addEventListener(ev, () => $('drop').classList.remove('over')));
$('drop').addEventListener('drop', e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); });

/* ---------- Analisis citra ----------
   PROTOTIPE: analisis warna piksel (hijau / kuning / cokelat) di browser.
   Untuk model CNN sungguhan, ganti fungsi analyzeImage() dengan pemanggilan
   endpoint prediksi (lihat README). */
function loadImage(file) {
  return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
}
async function analyzeImage(file) {
  const img = await loadImage(file), S = 128;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  let leaf = 0, green = 0, yellow = 0, brown = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (max < .12 || d / (max || 1) < .22) continue; // buang latar putih/abu/gelap
    let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    leaf++;
    if (h >= 75 && h <= 165) green++;
    else if (h >= 42 && h < 75) yellow++;
    else if (h >= 8 && h < 42) brown++;
  }
  if (leaf < S * S * 0.04) return { condition: 'Daun tidak terdeteksi', confidence: 0, info: 'Gambar tidak memuat cukup area daun. Ambil foto dari dekat dengan latar polos dan cahaya cukup.' };
  const g = green / leaf, y = yellow / leaf, br = brown / leaf, sick = y + br;
  let condition, score, info;
  if (br >= .08 && br >= y * .6) { condition = 'Indikasi bercak / nekrosis'; score = Math.min(.55 + br * 2.2, .96); info = 'Terdeteksi area kecokelatan pada daun. Pisahkan daun terdampak, jaga sirkulasi udara, dan konsultasikan ke penyuluh pertanian untuk memastikan penyebabnya.'; }
  else if (y >= .12) { condition = 'Indikasi klorosis (menguning)'; score = Math.min(.55 + y * 2, .94); info = 'Terdeteksi area menguning. Dapat terkait kekurangan nutrisi, kelebihan air, atau infeksi. Periksa penyiraman dan nutrisi, lalu amati perkembangannya.'; }
  else if (g >= .85) { condition = 'Daun terlihat sehat'; score = Math.min(.6 + (g - .85) * 2.5, .97); info = 'Warna daun didominasi hijau merata. Tetap lakukan pemantauan rutin.'; }
  else { condition = 'Perlu pemeriksaan lanjut'; score = .5 + Math.min(sick, .1); info = 'Pola warna campuran sehingga hasil kurang pasti. Coba foto ulang dengan pencahayaan lebih baik atau minta bantuan ahli.'; }
  return { condition, confidence: Math.round(score * 100), info };
}
function thumbnail(file) {
  return loadImage(file).then(img => {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
    return c.toDataURL('image/jpeg', .7);
  });
}

$('analyze').onclick = async () => {
  const btn = $('analyze'), lis = [...document.querySelectorAll('#pipe li')];
  btn.classList.add('loading'); btn.disabled = true; $('result').hidden = true;
  for (let i = 0; i < lis.length - 1; i++) { lis.forEach((li, k) => li.classList.toggle('on', k <= i)); await sleep(650); }
  try {
    const res = await analyzeImage(imageFile);
    lis.forEach(li => li.classList.add('on'));
    $('res-title').textContent = res.condition;
    $('res-conf').textContent = 'Confidence ' + res.confidence + '%';
    $('res-info').textContent = res.info;
    $('res-bar').style.width = '0';
    $('result').hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => $('res-bar').style.width = res.confidence + '%'));
    btn.classList.replace('loading', 'done');
    if (res.confidence > 0) {
      await api('/api/scans', 'POST', { condition: res.condition, confidence: res.confidence, thumb: await thumbnail(imageFile), note: res.info });
      loadHistory();
    }
    await sleep(900);
  } catch (e) { alert(e.message); }
  btn.classList.remove('loading', 'done'); btn.disabled = false;
};

/* ---------- Riwayat ---------- */
async function loadHistory() {
  const list = await api('/api/scans');
  $('empty').hidden = list.length > 0;
  $('history').innerHTML = '';
  list.forEach((s, i) => {
    const li = document.createElement('li');
    li.style.animationDelay = i * 60 + 'ms';
    li.innerHTML = '<img alt=""><div><b></b><small></small></div><button title="Hapus" aria-label="Hapus">✕</button>';
    li.querySelector('img').src = s.thumb;
    li.querySelector('b').textContent = s.condition;
    li.querySelector('small').textContent = s.confidence + '% · ' + new Date(s.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    li.querySelector('button').onclick = async () => { li.style.transition = 'all .3s'; li.style.opacity = 0; li.style.transform = 'scale(.9)'; await sleep(280); await api('/api/scans/' + s.id, 'DELETE'); loadHistory(); };
    $('history').appendChild(li);
  });
}

if (token()) showApp(false);
