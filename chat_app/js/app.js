/**
 * app.js — Controlador principal da interface do chat
 * Orquestra CelularUsuario, EstrategiaEnvio e eventos Socket.IO
 */

const SERVER_URL = window.location.origin;

// ─── Estado Global ────────────────────────────────────────────────────────────
let socket = null;
let celularUsuario = null;
let usuariosOnline = [];
let modoPrivado = false;
let destinatariosSelecionados = new Set();

// ─── Inicialização ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupLoginScreen();
});

function setupLoginScreen() {
  const loginBtn = document.getElementById('btn-entrar');
  const nomeInput = document.getElementById('input-nome');
  const loginError = document.getElementById('login-error');

  loginBtn.addEventListener('click', () => entrarNoChat());
  nomeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrarNoChat();
    loginError.classList.add('hidden');
  });
  nomeInput.focus();
}

function entrarNoChat() {
  const nome = document.getElementById('input-nome').value.trim();
  if (!nome) {
    document.getElementById('login-error').classList.remove('hidden');
    return;
  }
  conectar(nome);
}

// ─── Conexão Socket.IO ────────────────────────────────────────────────────────
function conectar(nome) {
  socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log(`✅ Conectado ao ServidorCentral: ${socket.id}`);

    // Cria o CelularUsuario (Observavel) passando o socket (Observador)
    celularUsuario = new CelularUsuario(nome, socket);

    // Registra o usuário no servidor
    socket.emit('registrar_usuario', nome);

    // Transiciona para a tela de chat
    mostrarChat(nome);
  });

  socket.on('disconnect', () => {
    adicionarMensagemSistema('Conexão perdida. Tentando reconectar...', 'erro');
  });

  // ── Eventos recebidos do ServidorCentral ──────────────────────────────────
  socket.on('mensagem_recebida', (pacote) => {
    renderizarMensagem(pacote);
  });

  socket.on('lista_usuarios', (usuarios) => {
    usuariosOnline = usuarios;
    renderizarListaUsuarios(usuarios);
    renderizarSeletorDestinatarios(usuarios);
  });

  socket.on('sistema_mensagem', (dados) => {
    adicionarMensagemSistema(dados.texto, dados.tipo.toLowerCase());
  });
}

// ─── Chat Screen Setup ────────────────────────────────────────────────────────
function mostrarChat(nome) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  document.getElementById('nome-usuario').textContent = nome;
  document.getElementById('avatar-inicial').textContent = nome.charAt(0).toUpperCase();

  setupChatEvents();
}

function setupChatEvents() {
  const msgInput = document.getElementById('msg-input');
  const btnEnviar = document.getElementById('btn-enviar');
  const btnToggle = document.getElementById('btn-toggle-estrategia');

  btnEnviar.addEventListener('click', enviarMensagem);
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });

  btnToggle.addEventListener('click', toggleEstrategia);
  msgInput.focus();
}

// ─── Envio de Mensagem ────────────────────────────────────────────────────────
function enviarMensagem() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !celularUsuario) return;

  try {
    if (modoPrivado) {
      if (destinatariosSelecionados.size === 0) {
        mostrarToast('Selecione ao menos um destinatário!', 'aviso');
        return;
      }
      // Troca para EnvioPrivado se ainda não estiver
      celularUsuario.mudarEstrategia(new EnvioPrivado(celularUsuario.nome));
      celularUsuario.escreverMensagem(texto, Array.from(destinatariosSelecionados));
    } else {
      // Garante estratégia pública
      celularUsuario.mudarEstrategia(new EnvioPublico(celularUsuario.nome));
      celularUsuario.escreverMensagem(texto, []);
    }
    input.value = '';
    input.focus();
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
}

// ─── Toggle de Estratégia ─────────────────────────────────────────────────────
function toggleEstrategia() {
  modoPrivado = !modoPrivado;
  const btn = document.getElementById('btn-toggle-estrategia');
  const badge = document.getElementById('badge-estrategia');
  const seletor = document.getElementById('seletor-destinatarios');
  const inputArea = document.getElementById('input-area');

  if (modoPrivado) {
    btn.classList.add('privado');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      Privado
    `;
    badge.textContent = 'PRIVADO';
    badge.className = 'badge-estrategia privado';
    seletor.classList.remove('hidden');
    inputArea.classList.add('modo-privado');
    mostrarToast('Modo Privado: selecione os destinatários', 'info');
  } else {
    btn.classList.remove('privado');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      Público
    `;
    badge.textContent = 'PÚBLICO';
    badge.className = 'badge-estrategia publico';
    seletor.classList.add('hidden');
    inputArea.classList.remove('modo-privado');
    destinatariosSelecionados.clear();
    mostrarToast('Modo Público: todos receberão a mensagem', 'info');
  }
}

// ─── Renderização de Mensagens ────────────────────────────────────────────────
function renderizarMensagem(pacote) {
  const container = document.getElementById('messages-container');
  const isMeu = pacote.remetente === celularUsuario?.nome;
  const hora = new Date(pacote.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const bubble = document.createElement('div');
  bubble.className = `message-wrapper ${isMeu ? 'minha' : 'outro'}`;
  bubble.dataset.id = pacote.id;

  const destinatariosInfo =
    pacote.tipo === 'PRIVADO' && pacote.destinatarios.length > 0
      ? `<div class="msg-destinatarios">🔒 Para: ${[pacote.remetente, ...pacote.destinatarios].filter((n, i, a) => a.indexOf(n) === i).join(', ')}</div>`
      : '';

  bubble.innerHTML = `
    <div class="message-bubble ${pacote.tipo.toLowerCase()} ${isMeu ? 'meu' : ''}">
      ${!isMeu ? `<div class="msg-remetente">${pacote.remetente}</div>` : ''}
      ${destinatariosInfo}
      <div class="msg-texto">${escapeHtml(pacote.texto)}</div>
      <div class="msg-meta">
        <span class="msg-hora">${hora}</span>
        <span class="msg-tipo-badge ${pacote.tipo.toLowerCase()}">${pacote.tipo}</span>
      </div>
    </div>
  `;

  // Animação de entrada
  bubble.style.opacity = '0';
  bubble.style.transform = `translateY(10px)`;
  container.appendChild(bubble);

  requestAnimationFrame(() => {
    bubble.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateY(0)';
  });

  container.scrollTop = container.scrollHeight;
}

// ─── Renderização de Usuários ─────────────────────────────────────────────────
function renderizarListaUsuarios(usuarios) {
  const lista = document.getElementById('lista-usuarios');
  const count = document.getElementById('usuarios-count');
  count.textContent = usuarios.length;

  const meuNome = celularUsuario?.nome;
  lista.innerHTML = usuarios
    .map((u) => {
      const isMeu = u.nome === meuNome;
      return `
        <div class="usuario-item ${isMeu ? 'eu' : ''}">
          <div class="usuario-avatar">${u.nome.charAt(0).toUpperCase()}</div>
          <div class="usuario-info">
            <span class="usuario-nome">${u.nome}${isMeu ? ' (você)' : ''}</span>
            <span class="usuario-status">Online</span>
          </div>
          <div class="usuario-dot"></div>
        </div>
      `;
    })
    .join('');
}

function renderizarSeletorDestinatarios(usuarios) {
  const seletor = document.getElementById('checkboxes-destinatarios');
  const meuNome = celularUsuario?.nome;

  seletor.innerHTML = usuarios
    .filter((u) => u.nome !== meuNome)
    .map((u) => {
      const checked = destinatariosSelecionados.has(u.nome);
      return `
        <label class="destinatario-check ${checked ? 'selecionado' : ''}">
          <input type="checkbox" value="${u.nome}" ${checked ? 'checked' : ''}
            onchange="toggleDestinatario('${u.nome}', this)">
          <span class="dest-avatar">${u.nome.charAt(0).toUpperCase()}</span>
          <span>${u.nome}</span>
        </label>
      `;
    })
    .join('');
}

function toggleDestinatario(nome, checkbox) {
  const label = checkbox.closest('label');
  if (checkbox.checked) {
    destinatariosSelecionados.add(nome);
    label.classList.add('selecionado');
  } else {
    destinatariosSelecionados.delete(nome);
    label.classList.remove('selecionado');
  }
}

// ─── Mensagem do Sistema ──────────────────────────────────────────────────────
function adicionarMensagemSistema(texto, tipo = 'info') {
  const container = document.getElementById('messages-container');
  const div = document.createElement('div');
  div.className = `sistema-msg ${tipo}`;
  div.textContent = texto;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${tipo} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
