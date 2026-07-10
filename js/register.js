import { supabase } from './supabase-client.js';
import { CONFIG } from './config.js';

const $ = (selector) => document.querySelector(selector);

const form = $('#registrationForm');
const button = $('#submitBtn');
const message = $('#formMessage');
const instagramLink = $('#instagramLink');
const modalInstagram = $('#modalInstagram');
const drawDatePill = $('#drawDatePill');
const year = $('#year');
const modalBackdrop = $('#modalBackdrop');
const modalClose = $('#modalClose');

let redirectTimer = null;

if (instagramLink) {
    instagramLink.href = CONFIG.INSTAGRAM_URL;
}

if (modalInstagram) {
    modalInstagram.href = CONFIG.INSTAGRAM_URL;
}

if (drawDatePill) {
    drawDatePill.textContent = `📅 ${CONFIG.DRAW_DATE_TEXT}`;
}

if (year) {
    year.textContent = new Date().getFullYear();
}

const normalize = (value) => value.trim().replace(/\s+/g, ' ');

const cleanDocument = (value) => {
    return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
};

const cleanPhone = (value) => {
    return value.replace(/[^0-9+]/g, '');
};

function showMessage(text, type = 'error') {
    if (!message) {
        return;
    }

    message.textContent = text;
    message.className = text
        ? `form-message ${type}`
        : 'form-message';
}

function showModal(title, text, success = true) {
    const modalTitle = $('#modalTitle');
    const modalText = $('#modalText');
    const modalIcon = $('#modalIcon');

    if (!modalBackdrop || !modalTitle || !modalText || !modalIcon) {
        showMessage(text, success ? 'success' : 'error');
        return;
    }

    modalTitle.textContent = title;
    modalText.textContent = text;
    modalIcon.textContent = success ? '✓' : '!';
    modalBackdrop.classList.remove('hidden');
}

function closeModal() {
    modalBackdrop?.classList.add('hidden');
}

modalClose?.addEventListener('click', closeModal);

modalBackdrop?.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) {
        closeModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
});

if (!form || !button) {
    console.error(
        'No se encontró el formulario de registro o el botón de envío.'
    );
} else {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');

        if (!form.checkValidity()) {
            showMessage(
                'Revisa los campos obligatorios y acepta las condiciones.'
            );
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
            consent: $('#consent').checked
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
            const { data, error } = await supabase.functions.invoke(
                'register-participant',
                {
                    body: payload
                }
            );

            if (error) {
                throw error;
            }

            if (data?.status === 'duplicate') {
                showModal(
                    'Ya estás participando',
                    'Encontramos una participación con tu documento, celular o correo. Cada persona puede participar una sola vez.',
                    false
                );
                return;
            }

            if (!data?.ok) {
                showMessage(
                    data?.message ||
                    'No se pudo completar tu participación.'
                );
                return;
            }

            form.reset();

            showModal(
                '¡Ya estás participando!',
                `Tu número es ${data.participant_number}. Serás redirigido a Instagram en ${CONFIG.REDIRECT_SECONDS} segundos.`
            );

            clearTimeout(redirectTimer);

            redirectTimer = setTimeout(() => {
                window.location.assign(CONFIG.INSTAGRAM_URL);
            }, CONFIG.REDIRECT_SECONDS * 1000);
        } catch (error) {
            console.error('register-participant:', error);

            showMessage(
                'No pudimos conectar con Supabase. Inténtalo nuevamente.'
            );
        } finally {
            button.disabled = false;
            button.textContent = 'PARTICIPAR EN EL SORTEO';
        }
    });
}
