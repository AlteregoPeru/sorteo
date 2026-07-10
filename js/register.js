import { supabase } from './supabase-client.js';
import { CONFIG } from './config.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#registrationForm');
const button = $('#submitBtn');
const message = $('#formMessage');
let redirectTimer = null;

$('#instagramLink').href = CONFIG.INSTAGRAM_URL;
$('#modalInstagram').href = CONFIG.INSTAGRAM_URL;
$('#drawDatePill').textContent = `📅 ${CONFIG.DRAW_DATE_TEXT}`;
$('#year').textContent = new Date().getFullYear();

const normalize = (value) => value.trim().replace(/\s+/g, ' ');
const cleanDocument = (value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
const cleanPhone = (value) => value.replace(/[^0-9+]/g, '');

function showMessage(text, type = 'error') {
  message.textContent = text;
  message.className = text ? `form-message ${type}` : 'form-message';
}

function showModal(title, text, success = true) {
  $('#modalTitle').textContent = title;
  $('#modalText').textContent = text;
  $('#modalIcon').textContent = success ? '✓' : '!';
  $('#modalBackdrop').classList.remove('hidden');
}

function closeModal() {
  $('#modalBackdrop').classList.add('hidden');
}

$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', (event) => {
  if (event.target.id === 'modalBackdrop') closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('');

  if (!form.checkValidity()) {
    showMessage('Revisa los campos obligatorios y acepta las condiciones.');
    form.reportValidity();
    return;
  }

  const payload = {
    first_name: normalize($('#firstName').value),
    last_name: normalize($('#lastName').value),
    document_type: $('#documentType').value,
    document_number: cleanDocument($('#documentNumber').value),
    phone: cleanPhone($('#phone').value),
    email: $('#email').value.trim().toLowerCase(),
    consent: $('#consent').checked,
  };

  if (payload.document_number.length < 5) {
    showMessage('Ingresa un número de documento válido.');
    return;
  }
  if (payload.phone.replace(/\D/g, '').length < 8) {
    showMessage('Ingresa un número de celular válido.');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="loader"></span> Enviando…';

  try {
    const { data, error } = await supabase.functions.invoke('register-participant', {
      body: payload,
    });
    if (error) throw error;

    if (data?.status === 'duplicate') {
      showModal(
        'Ya estás participando',
        'Encontramos una participación con tu documento, celular o correo. Cada persona puede participar una sola vez.',
        false,
      );
      return;
    }

    if (!data?.ok) {
      showMessage(data?.message || 'No se pudo completar tu participación.');
      return;
    }

    form.reset();
    const emailText = data.email_sent
      ? 'También enviamos una confirmación a tu correo.'
      : 'Tu participación quedó guardada correctamente.';
    showModal(
      '¡Ya estás participando!',
      `Tu número es ${data.participant_number}. ${emailText} Serás redirigido a Instagram en ${CONFIG.REDIRECT_SECONDS} segundos.`,
    );

    clearTimeout(redirectTimer);
    redirectTimer = setTimeout(() => {
      window.location.assign(CONFIG.INSTAGRAM_URL);
    }, CONFIG.REDIRECT_SECONDS * 1000);
  } catch (error) {
    console.error('register-participant:', error);
    showMessage('No pudimos conectar con Supabase. Revisa que la Edge Function esté desplegada e inténtalo nuevamente.');
  } finally {
    button.disabled = false;
    button.textContent = 'PARTICIPAR EN EL SORTEO';
  }
});
