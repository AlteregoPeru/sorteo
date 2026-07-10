import { supabase } from './supabase-client.js';

// --- Configuración Inicial y Referencias ---
const $ = s => document.querySelector(s);
let participants = [], winners = [];

const loginView = $('#loginView');
const appView = $('#appView');

// --- Funciones de Utilidad ---
function msg(el, text, type = 'error') {
    el.textContent = text;
    el.className = `form-message ${type}`;
}

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[c]));

const date = v => new Intl.DateTimeFormat('es-PE', { 
    dateStyle: 'short', timeStyle: 'short' 
}).format(new Date(v));

// --- Lógica de Autenticación ---
$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = $('#loginBtn');
    b.disabled = true;
    b.innerHTML = '<span class="loader"></span> Ingresando…';
    msg($('#loginMessage'), '', '');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: $('#adminEmail').value.trim(),
            password: $('#adminPassword').value
        });
        if (error) throw error;

        const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
        if (rpcError || !isAdmin) {
            await supabase.auth.signOut();
            throw new Error('No autorizado');
        }

        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        await loadAll();
    } catch (err) {
        console.error(err);
        msg($('#loginMessage'), 'Credenciales incorrectas o usuario sin permisos de administrador.');
    } finally {
        b.disabled = false;
        b.textContent = 'INICIAR SESIÓN';
    }
});

$('#logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

// --- Manejo de Vistas y Datos ---
document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    ['dashboard', 'participants', 'draw'].forEach(v => $(`#${v}View`).classList.toggle('hidden', v !== btn.dataset.view));
}));

async function loadAll() {
    const [{ data: p, error: pe }, { data: w, error: we }] = await Promise.all([
        supabase.from('participants').select('*').order('created_at', { ascending: false }),
        supabase.from('winners').select('*, participants(*)').order('created_at', { ascending: false })
    ]);

    if (pe || we) {
        console.error(pe || we);
        return;
    }

    participants = p || [];
    winners = w || [];

    renderStats();
    renderRecent();
    renderParticipants(participants);
    renderWinners();
    
    $('#eligibleText').textContent = `${participants.filter(p => p.status === 'active' && !winners.some(w => w.participant_id === p.id)).length} participantes disponibles para el sorteo.`;
}

// --- Renderizado de Tablas ---
function table(rows, compact = false) {
    if (!rows.length) return '<div class="empty">No hay registros para mostrar.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>N.º</th><th>Participante</th><th>Documento</th><th>Celular</th><th>Correo</th><th>Registro</th><th>Estado</th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.participant_number)}</td><td>${esc(p.first_name)} ${esc(p.last_name)}</td><td>${esc(p.document_type)} ${esc(p.document_number)}</td><td>${esc(p.phone)}</td><td>${esc(p.email)}</td><td>${date(p.created_at)}</td><td><span class="badge badge-green">${esc(p.status)}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function renderStats() {
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), week = new Date(now);
    week.setDate(now.getDate() - 7);
    $('#statTotal').textContent = participants.length;
    $('#statToday').textContent = participants.filter(p => new Date(p.created_at) >= today).length;
    $('#statWeek').textContent = participants.filter(p => new Date(p.created_at) >= week).length;
    $('#statWinners').textContent = winners.length;
}

function renderRecent() { $('#recentTable').innerHTML = table(participants.slice(0, 8), true); }
function renderParticipants(rows) { $('#participantsTable').innerHTML = table(rows); }

function renderWinners() {
    if (!winners.length) {
        $('#winnersTable').innerHTML = '<div class="empty">Todavía no se ha realizado ningún sorteo.</div>';
        return;
    }
    $('#winnersTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Número</th><th>Ganador</th><th>Correo</th></tr></thead><tbody>${winners.map(w => `<tr><td>${date(w.created_at)}</td><td><span class="badge badge-gold">${esc(w.participants?.participant_number)}</span></td><td>${esc(w.participants?.first_name)} ${esc(w.participants?.last_name)}</td><td>${esc(w.participants?.email)}</td></tr>`).join('')}</tbody></table></div>`;
}

// --- Funcionalidades (Búsqueda, Exportación, Sorteo) ---
$('#searchInput').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    renderParticipants(!q ? participants : participants.filter(p => [p.first_name, p.last_name, p.document_number, p.phone, p.email, p.participant_number].some(v => String(v).toLowerCase().includes(q))));
});

$('#refreshBtn').addEventListener('click', loadAll);

$('#exportBtn').addEventListener('click', () => {
    const headers = ['numero', 'nombres', 'apellidos', 'tipo_documento', 'documento', 'celular', 'correo', 'fecha'];
    const rows = participants.map(p => [p.participant_number, p.first_name, p.last_name, p.document_type, p.document_number, p.phone, p.email, p.created_at]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `participantes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
});

// --- Lógica del Sorteo ---
$('#drawBtn').addEventListener('click', () => $('#confirmModal').classList.remove('hidden'));
$('#cancelDraw').addEventListener('click', () => $('#confirmModal').classList.add('hidden'));

$('#confirmDraw').addEventListener('click', async () => {
    $('#confirmModal').classList.add('hidden');
    const btn = $('#drawBtn');
    btn.disabled = true;
    msg($('#drawMessage'), '', '');

    for (let n = 5; n >= 1; n--) {
        $('#countdown').textContent = n;
        $('#countdown').classList.remove('hidden');
        await new Promise(r => setTimeout(r, 700));
    }
    $('#countdown').classList.add('hidden');

    const anim = setInterval(() => {
        $('#drawNumber').textContent = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
    }, 70);

    try {
        const { data, error } = await supabase.functions.invoke('draw-winner', { body: {} });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message || 'No fue posible realizar el sorteo');
        
        await new Promise(r => setTimeout(r, 1600));
        clearInterval(anim);
        
        const w = data.winner;
        $('#drawNumber').textContent = w.participant_number;
        $('#winnerName').textContent = `${w.first_name} ${w.last_name}`;
        $('#winnerData').textContent = `${w.document_type} •••${w.document_number.slice(-4)} · ${w.email.replace(/(^.).*(@.*$)/, '$1••••$2')}`;
        
        confetti();
        msg($('#drawMessage'), data.email_sent ? 'Ganador guardado y correo enviado correctamente.' : 'Ganador guardado. El correo no pudo enviarse.', 'success');
        await loadAll();
    } catch (err) {
        clearInterval(anim);
        console.error(err);
        msg($('#drawMessage'), err.message || 'Ocurrió un error al realizar el sorteo.');
    } finally {
        btn.disabled = false;
    }
});

function confetti() {
    const c = $('#confetti');
    c.innerHTML = '';
    for (let i = 0; i < 90; i++) {
        const x = document.createElement('i');
        x.style.left = Math.random() * 100 + 'vw';
        x.style.animationDelay = Math.random() * .8 + 's';
        x.style.transform = `rotate(${Math.random() * 360}deg)`;
        c.appendChild(x);
    }
    setTimeout(() => c.innerHTML = '', 4000);
}