/**
 * app.js — Controlador principal da interface do chat
 * Orquestra CelularUsuario, EstrategiaEnvio e eventos Socket.IO
 *
 * Arquitetura de conversas estilo WhatsApp:
 *  - 'geral'       → canal público, todos recebem (EnvioPublico)
 *  - 'nomeUsuario' → chat privado 1-1 (EnvioPrivado)
 *  - 'grupo_xxx'   → grupo com membros selecionados
 */

const SERVER_URL = window.location.origin;

// ─── Estado Global ────────────────────────────────────────────────────────────
let socket = null;
let celularUsuario = null;
let usuariosOnline = [];

let conversaAtiva = 'geral';
let conversas = new Map();
let naoLidas = new Map();
let grupos = new Map();
let buscaQuery = '';
let historicoCarregado = new Set();

// Impede que eventos da interface sejam registrados novamente em reconexões.
let interfaceInicializada = false;
let chatEventsConfigurados = false;
let modalGrupoConfigurado = false;

conversas.set('geral', []);

// ─── Visual Viewport (teclado virtual mobile) ─────────────────────────────────
/**
 * setupVisualViewport()
 *
 * Quando o teclado virtual abre no celular, o viewport lógico (100vh/dvh)
 * NÃO é atualizado pela maioria dos browsers — o #input-area some atrás do teclado.
 *
 * Solução: usamos window.visualViewport que reporta a área visível REAL.
 * Setamos style.height e style.top diretamente no #chat-screen para que ele
 * ocupe exatamente a área visível, empurrando o #input-area para acima do teclado.
 *
 * A chain flex garante que a área de mensagens encolhe (graças ao min-height:0
 * adicionado no CSS) e o input fica sempre no fundo.
 *
 * Compatibilidade: iOS Safari 13+, Android Chrome 61+, todos browsers modernos.
 */
function setupVisualViewport() {
  const chatScreen = document.getElementById('chat-screen');
  if (!chatScreen) return;

  let ticking = false;

  function aplicarAltura() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      ticking = false;

      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        chatScreen.style.removeProperty('height');
        chatScreen.style.removeProperty('top');
        return;
      }

      if (window.visualViewport) {
        const vv = window.visualViewport;
        // Altura real da área visível (sem o teclado)
        chatScreen.style.height = vv.height + 'px';
        // offsetTop: iOS Safari às vezes move a viewport em vez de redimensionar
        chatScreen.style.top = vv.offsetTop + 'px';
      } else {
        // Fallback para browsers sem visualViewport (muito antigos)
        // No Android com interactive-widget=resizes-content, window.innerHeight atualiza
        chatScreen.style.height = window.innerHeight + 'px';
        chatScreen.style.top = '0px';
      }
    });
  }

  // --- Eventos da visualViewport API ---
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', aplicarAltura);
    window.visualViewport.addEventListener('scroll', aplicarAltura);
  }

  // --- Fallback: resize da window (Android com interactive-widget) ---
  window.addEventListener('resize', aplicarAltura);

  // --- Fallback: orientação mudou ---
  window.addEventListener('orientationchange', () => {
    setTimeout(aplicarAltura, 300); // aguarda a rotação completar
  });

  // Inicializa
  aplicarAltura();
}

// Roda assim que o DOM estiver pronto (antes mesmo do login)
document.addEventListener('DOMContentLoaded', () => {
  setupVisualViewport();
  setupLoginScreen();
});


// ─── Abas Login / Registro ────────────────────────────────────────────────────
function trocarAba(aba) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegistro = document.getElementById('tab-registro');
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');

  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('registro-error').classList.add('hidden');

  if (aba === 'login') {
    tabLogin.classList.add('active');
    tabRegistro.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegistro.classList.add('hidden');
    document.getElementById('input-nome').focus();
  } else {
    tabRegistro.classList.add('active');
    tabLogin.classList.remove('active');
    formRegistro.classList.remove('hidden');
    formLogin.classList.add('hidden');
    document.getElementById('input-reg-nome').focus();
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
function setupLoginScreen() {
  const loginBtn = document.getElementById('btn-entrar');
  const nomeInput = document.getElementById('input-nome');
  const senhaInput = document.getElementById('input-senha');
  const regBtn = document.getElementById('btn-registrar');

  loginBtn.addEventListener('click', () => entrarNoChat());

  nomeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') senhaInput.focus();
    document.getElementById('login-error').classList.add('hidden');
  });

  senhaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrarNoChat();
    document.getElementById('login-error').classList.add('hidden');
  });

  regBtn.addEventListener('click', () => registrarConta());

  document.getElementById('input-reg-nome').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('input-reg-senha').focus();
    }
    document.getElementById('registro-error').classList.add('hidden');
  });

  document.getElementById('input-reg-senha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('input-reg-senha2').focus();
    }
    document.getElementById('registro-error').classList.add('hidden');
  });

  document.getElementById('input-reg-senha2').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') registrarConta();
    document.getElementById('registro-error').classList.add('hidden');
  });

  nomeInput.focus();
}

function mostrarErroLogin(mensagem) {
  const el = document.getElementById('login-error');
  el.textContent = '⚠️ ' + mensagem;
  el.classList.remove('hidden');
}

function mostrarErroRegistro(mensagem) {
  const el = document.getElementById('registro-error');
  el.textContent = '⚠️ ' + mensagem;
  el.classList.remove('hidden');
}

async function entrarNoChat() {
  const nome = document.getElementById('input-nome').value.trim();
  const senha = document.getElementById('input-senha').value;

  if (!nome || !senha) {
    mostrarErroLogin('Preencha o nome e a senha.');
    return;
  }

  const btn = document.getElementById('btn-entrar');
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loading').classList.remove('hidden');
  btn.disabled = true;

  try {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nome, senha }),
    });

    const data = await response.json();

    if (!data.sucesso) {
      mostrarErroLogin(data.erro || 'Erro ao fazer login.');
      return;
    }

    conectar(nome);
  } catch (err) {
    mostrarErroLogin('Erro de conexão com o servidor.');
  } finally {
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loading').classList.add('hidden');
    btn.disabled = false;
  }
}

async function registrarConta() {
  const nome = document.getElementById('input-reg-nome').value.trim();
  const senha = document.getElementById('input-reg-senha').value;
  const senha2 = document.getElementById('input-reg-senha2').value;

  if (!nome || !senha || !senha2) {
    mostrarErroRegistro('Preencha todos os campos.');
    return;
  }

  if (senha !== senha2) {
    mostrarErroRegistro('As senhas não coincidem.');
    return;
  }

  if (nome.length < 3) {
    mostrarErroRegistro('Nome deve ter pelo menos 3 caracteres.');
    return;
  }

  if (senha.length < 4) {
    mostrarErroRegistro('Senha deve ter pelo menos 4 caracteres.');
    return;
  }

  const btn = document.getElementById('btn-registrar');
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loading').classList.remove('hidden');
  btn.disabled = true;

  try {
    const response = await fetch(`${SERVER_URL}/api/auth/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nome, senha }),
    });

    const data = await response.json();

    if (!data.sucesso) {
      mostrarErroRegistro(data.erro || 'Erro ao criar conta.');
      return;
    }

    mostrarToast('✅ Conta criada! Faça login para entrar.', 'sucesso');
    trocarAba('login');
    document.getElementById('input-nome').value = nome;
    document.getElementById('input-senha').focus();
  } catch (err) {
    mostrarErroRegistro('Erro de conexão com o servidor.');
  } finally {
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loading').classList.add('hidden');
    btn.disabled = false;
  }
}

// ─── Conexão Socket.IO ────────────────────────────────────────────────────────
function conectar(nome) {
  socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log(`✅ Conectado ao ServidorCentral: ${socket.id}`);

    celularUsuario = new CelularUsuario(nome, socket);
    socket.emit('registrar_usuario', nome);

    // IMPORTANTE:
    // Socket.IO dispara "connect" novamente depois de uma reconexão.
    // A interface deve ser configurada somente uma vez para não duplicar
    // addEventListener() do botão de enviar, Enter, modal etc.
    if (!interfaceInicializada) {
      interfaceInicializada = true;
      mostrarChat(nome);
    } else {
      renderizarConversas();
      renderizarMensagensAtuais();
      atualizarHeader(conversaAtiva);
      mostrarToast('✅ Conexão restabelecida.', 'sucesso');
    }
  });

  socket.on('disconnect', () => {
    console.warn('⚠️ Conexão perdida. Socket.IO tentará reconectar automaticamente.');
    mostrarToast('Conexão perdida. Tentando reconectar...', 'erro');
  });

  socket.on('mensagem_recebida', (pacote) => {
    adicionarMensagemConversa(pacote);
  });

  socket.on('mensagem_secreta_geral', (pacote) => {
    if (!conversas.has('geral')) conversas.set('geral', []);

    conversas.get('geral').unshift(pacote);

    if (conversaAtiva === 'geral') {
      renderizarMensagensAtuais();
    }

    renderizarConversas();
  });

  socket.on('lista_usuarios', (usuarios) => {
    usuariosOnline = usuarios;
    const meuNome = celularUsuario?.nome;

    usuarios.forEach((u) => {
      if (u.nome !== meuNome && !conversas.has(u.nome)) {
        conversas.set(u.nome, []);
      }
    });

    renderizarConversas();
    atualizarListaMembrosCriarGrupo();
  });

  socket.on('lista_grupos', (listaGrupos) => {
    listaGrupos.forEach((g) => {
      grupos.set(g.id, g);

      if (!conversas.has(g.id)) {
        conversas.set(g.id, []);
      }
    });

    renderizarConversas();
  });

  socket.on('grupo_criado', (grupo) => {
    grupos.set(grupo.id, grupo);

    if (!conversas.has(grupo.id)) {
      conversas.set(grupo.id, []);
    }

    renderizarConversas();
    mostrarToast(`👥 Grupo "${grupo.nome}" criado!`, 'info');

    if (grupo.criador === celularUsuario?.nome) {
      abrirConversa(grupo.id);
    }
  });

  socket.on('historico_carregado', ({ conversaId, mensagens }) => {
    if (!mensagens || mensagens.length === 0) return;

    const chaveLocal = mapearConversaIdParaLocal(conversaId);

    if (!conversas.has(chaveLocal)) {
      conversas.set(chaveLocal, []);
    }

    const msgsAtuais = conversas.get(chaveLocal);
    const idsExistentes = new Set(msgsAtuais.map((m) => m.id));

    const novas = mensagens.filter((m) => !idsExistentes.has(m.id));

    if (novas.length > 0) {
      conversas.set(chaveLocal, [...novas, ...msgsAtuais]);
    }

    if (conversaAtiva === chaveLocal) {
      renderizarMensagensAtuais();
    }

    renderizarConversas();
  });

  socket.on('sistema_mensagem', (dados) => {
    adicionarMensagemSistema(dados.texto, dados.tipo.toLowerCase());
  });
}

/**
 * Mapeia o conversaId do banco para a chave usada localmente nas conversas.
 */
function mapearConversaIdParaLocal(conversaId) {
  if (conversaId === 'geral') return 'geral';
  if (conversaId.startsWith('grupo_')) return conversaId;

  if (conversaId.startsWith('priv_')) {
    const meuNome = celularUsuario?.nome;
    const partes = conversaId.replace('priv_', '').split('_');

    return partes.find((p) => p !== meuNome) || partes[0];
  }

  return conversaId;
}

/**
 * Gera o conversaId canônico para solicitar histórico ao servidor.
 */
function gerarConversaIdParaHistorico(chaveLocal) {
  if (chaveLocal === 'geral') return 'geral';
  if (chaveLocal.startsWith('grupo_')) return chaveLocal;

  const meuNome = celularUsuario?.nome;
  const participantes = [meuNome, chaveLocal].sort();

  return `priv_${participantes.join('_')}`;
}

// ─── Chat Screen ──────────────────────────────────────────────────────────────
function mostrarChat(nome) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  document.getElementById('nome-usuario').textContent = nome;
  document.getElementById('avatar-inicial').textContent =
    nome.charAt(0).toUpperCase();

  atualizarHeader('geral');
  renderizarConversas();
  setupChatEvents();
  setupModalGrupo();

  carregarHistorico('geral');
}

function setupChatEvents() {
  // Segunda camada de proteção contra listeners duplicados.
  if (chatEventsConfigurados) {
    return;
  }

  chatEventsConfigurados = true;

  const msgInput = document.getElementById('msg-input');
  const btnEnviar = document.getElementById('btn-enviar');
  const buscaInput = document.getElementById('busca-conversa');
  const btnVoltar = document.getElementById('btn-voltar-conversas');

  btnEnviar.addEventListener('click', enviarMensagem);
  btnVoltar.addEventListener('click', voltarParaListaConversas);

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });

  msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
  });

  // Fallback universal: garante que o input fique visível ao receber foco
  // (útil para browsers que não disparam visualViewport resize corretamente)
  msgInput.addEventListener('focus', () => {
    setTimeout(() => {
      msgInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 350); // aguarda o teclado terminar de abrir (~300ms)
  });

  buscaInput.addEventListener('input', () => {
    buscaQuery = buscaInput.value.trim().toLowerCase();
    renderizarConversas();
  });

  msgInput.focus();
}

/**
 * Solicita ao servidor o histórico de mensagens de uma conversa.
 */
function carregarHistorico(chaveLocal) {
  const conversaId = gerarConversaIdParaHistorico(chaveLocal);

  if (historicoCarregado.has(conversaId)) {
    return;
  }

  historicoCarregado.add(conversaId);
  socket.emit('carregar_historico', {
    conversaId,
    limite: 50,
  });
}

// ─── Envio de Mensagem ────────────────────────────────────────────────────────
function enviarMensagem() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();

  if (!texto || !celularUsuario) return;

  try {
    if (conversaAtiva === 'geral') {
      celularUsuario.mudarEstrategia(
        new EnvioPublico(celularUsuario.nome)
      );

      celularUsuario.escreverMensagem(texto, []);
    } else if (grupos.has(conversaAtiva)) {
      socket.emit('mensagem_grupo', {
        grupoId: conversaAtiva,
        texto,
        remetente: celularUsuario.nome,
        destinatarios: grupos.get(conversaAtiva).membros,
        tipo: 'GRUPO',
        timestamp: new Date().toISOString(),
        id: `msg_${Date.now()}`,
      });
    } else {
      celularUsuario.mudarEstrategia(
        new EnvioPrivado(celularUsuario.nome)
      );

      celularUsuario.escreverMensagem(texto, [conversaAtiva]);
    }

    input.value = '';
    input.style.height = 'auto';
    input.focus();
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
}

// ─── Gerenciamento de Conversas ───────────────────────────────────────────────
function abrirConversa(id) {
  conversaAtiva = id;
  naoLidas.set(id, 0);

  carregarHistorico(id);

  renderizarConversas();
  renderizarMensagensAtuais();
  atualizarHeader(id);

  document.getElementById('chat-screen').classList.add('conversa-aberta');

  if (!ehTelaMobile()) {
    document.getElementById('msg-input').focus();
  }
}

function voltarParaListaConversas() {
  document.getElementById('chat-screen').classList.remove('conversa-aberta');
}

function ehTelaMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function adicionarMensagemConversa(pacote) {
  const meuNome = celularUsuario?.nome;
  let chave;

  if (pacote.tipo === 'PUBLICO') {
    chave = 'geral';
  } else if (pacote.tipo === 'GRUPO') {
    chave = pacote.grupoId;
  } else {
    chave =
      pacote.remetente === meuNome
        ? pacote.destinatarios[0]
        : pacote.remetente;
  }

  if (!conversas.has(chave)) {
    conversas.set(chave, []);
  }

  // Evita também renderizar o mesmo pacote duas vezes se, por qualquer motivo,
  // um evento repetido chegar com o mesmo ID.
  const mensagensDaConversa = conversas.get(chave);
  const jaExiste = mensagensDaConversa.some((m) => m.id === pacote.id);

  if (jaExiste) {
    return;
  }

  mensagensDaConversa.push(pacote);

  if (chave === conversaAtiva) {
    renderizarMensagem(pacote);
  } else {
    naoLidas.set(chave, (naoLidas.get(chave) || 0) + 1);

    const label =
      pacote.tipo === 'PUBLICO'
        ? `${pacote.remetente} (Geral)`
        : pacote.tipo === 'GRUPO'
          ? `${pacote.remetente} (${grupos.get(chave)?.nome || 'Grupo'})`
          : pacote.remetente;

    mostrarToast(
      `💬 ${label}: ${pacote.texto.slice(0, 40)}`,
      'info'
    );
  }

  renderizarConversas();
}

// ─── Renderização do Sidebar ──────────────────────────────────────────────────
function renderizarConversas() {
  const lista = document.getElementById('lista-conversas');
  const meuNome = celularUsuario?.nome;

  const geralMsgs = conversas.get('geral') || [];
  const geralUltima =
    geralMsgs.length ? geralMsgs[geralMsgs.length - 1] : null;
  const geralNaoLidas = naoLidas.get('geral') || 0;
  const geralAtivo = conversaAtiva === 'geral';

  const mostraGeral =
    !buscaQuery || 'canal geral'.includes(buscaQuery);

  const outrosUsuarios =
    usuariosOnline.filter((u) => u.nome !== meuNome);

  const nomesOnline =
    new Set(outrosUsuarios.map((u) => u.nome));

  const comHistorico = [...conversas.keys()].filter(
    (k) =>
      k !== 'geral' &&
      !k.startsWith('grupo_') &&
      !nomesOnline.has(k)
  );

  const todasPrivadas = [
    ...outrosUsuarios,
    ...comHistorico.map((nome) => ({
      nome,
      offline: true,
    })),
  ].filter(
    (u) =>
      !buscaQuery ||
      u.nome.toLowerCase().includes(buscaQuery)
  );

  const meusGrupos = [...grupos.values()].filter(
    (g) =>
      g.membros.includes(meuNome) &&
      (!buscaQuery ||
        g.nome.toLowerCase().includes(buscaQuery))
  );

  lista.innerHTML = `
    ${
      mostraGeral
        ? `
    <div class="conversa-item ${geralAtivo ? 'ativa' : ''}" id="conv-geral" onclick="abrirConversa('geral')">
      <div class="conv-avatar geral">🌐</div>
      <div class="conv-info">
        <div class="conv-top">
          <span class="conv-nome">Canal Geral</span>
          ${
            geralUltima
              ? `<span class="conv-hora">${formatarHora(geralUltima.timestamp)}</span>`
              : ''
          }
        </div>

        <div class="conv-preview">
          ${
            geralUltima
              ? `<span class="conv-preview-remetente">${
                  geralUltima.remetente === meuNome
                    ? 'Você'
                    : geralUltima.remetente
                }:</span> ${escapeHtml(geralUltima.texto).slice(0, 35)}${
                  geralUltima.texto.length > 35 ? '…' : ''
                }`
              : '<span class="conv-preview-vazio">Sem mensagens ainda</span>'
          }
        </div>
      </div>

      ${
        geralNaoLidas > 0
          ? `<span class="conv-badge">${geralNaoLidas}</span>`
          : ''
      }
    </div>
    `
        : ''
    }

    ${
      meusGrupos.length > 0
        ? `
      <div class="conversas-section-sep">
        <span>Grupos</span>
        <span class="usuarios-count-badge">${meusGrupos.length}</span>
      </div>

      ${meusGrupos
        .map((g) => {
          const msgs = conversas.get(g.id) || [];
          const ultima = msgs.length ? msgs[msgs.length - 1] : null;
          const qtdNaoLidas = naoLidas.get(g.id) || 0;
          const ativo = conversaAtiva === g.id;

          return `
          <div class="conversa-item grupo-item ${ativo ? 'ativa' : ''}" onclick="abrirConversa('${g.id}')">
            <div class="conv-avatar grupo">${g.nome.charAt(0).toUpperCase()}</div>

            <div class="conv-info">
              <div class="conv-top">
                <span class="conv-nome">👥 ${escapeHtml(g.nome)}</span>
                ${
                  ultima
                    ? `<span class="conv-hora">${formatarHora(ultima.timestamp)}</span>`
                    : ''
                }
              </div>

              <div class="conv-preview">
                ${
                  ultima
                    ? `<span class="conv-preview-remetente">${
                        ultima.remetente === meuNome
                          ? 'Você'
                          : ultima.remetente
                      }:</span> ${escapeHtml(ultima.texto).slice(0, 35)}${
                        ultima.texto.length > 35 ? '…' : ''
                      }`
                    : `<span class="conv-preview-vazio">${g.membros.length} membros</span>`
                }
              </div>
            </div>

            ${
              qtdNaoLidas > 0
                ? `<span class="conv-badge">${qtdNaoLidas}</span>`
                : ''
            }
          </div>
        `;
        })
        .join('')}
    `
        : ''
    }

    ${
      todasPrivadas.length > 0
        ? `
      <div class="conversas-section-sep">
        <span>Mensagens privadas</span>
        <span class="usuarios-count-badge">${outrosUsuarios.length}</span>
      </div>
    `
        : ''
    }

    ${todasPrivadas
      .map((u) => {
        const msgs = conversas.get(u.nome) || [];
        const ultima = msgs.length ? msgs[msgs.length - 1] : null;
        const qtdNaoLidas = naoLidas.get(u.nome) || 0;
        const ativo = conversaAtiva === u.nome;

        return `
        <div class="conversa-item ${ativo ? 'ativa' : ''} ${u.offline ? 'offline' : ''}"
             onclick="abrirConversa('${u.nome}')">

          <div class="conv-avatar usuario">${u.nome.charAt(0).toUpperCase()}</div>
          <div class="conv-status-dot ${u.offline ? 'offline' : 'online'}"></div>

          <div class="conv-info">
            <div class="conv-top">
              <span class="conv-nome">${escapeHtml(u.nome)}</span>
              ${
                ultima
                  ? `<span class="conv-hora">${formatarHora(ultima.timestamp)}</span>`
                  : ''
              }
            </div>

            <div class="conv-preview">
              ${
                ultima
                  ? `<span class="conv-preview-remetente">${
                      ultima.remetente === meuNome
                        ? 'Você'
                        : ultima.remetente
                    }:</span> ${escapeHtml(ultima.texto).slice(0, 35)}${
                      ultima.texto.length > 35 ? '…' : ''
                    }`
                  : '<span class="conv-preview-vazio">Iniciar conversa...</span>'
              }
            </div>
          </div>

          ${
            qtdNaoLidas > 0
              ? `<span class="conv-badge">${qtdNaoLidas}</span>`
              : ''
          }
        </div>
      `;
      })
      .join('')}

    ${
      !mostraGeral &&
      todasPrivadas.length === 0 &&
      meusGrupos.length === 0
        ? `
      <div class="conv-sem-resultado">🔍 Nenhuma conversa encontrada</div>
    `
        : ''
    }
  `;
}

// ─── Renderizar mensagens da conversa ativa ───────────────────────────────────
function renderizarMensagensAtuais() {
  const container =
    document.getElementById('messages-container');

  container.innerHTML = '';

  const msgs =
    conversas.get(conversaAtiva) || [];

  msgs.forEach((pacote) => renderizarMensagem(pacote));

  container.scrollTop =
    container.scrollHeight;
}

// ─── Header dinâmico ─────────────────────────────────────────────────────────
function atualizarHeader(id) {
  const iconEl = document.getElementById('header-icon');
  const nomeEl = document.getElementById('header-nome');
  const subEl = document.getElementById('header-sub');
  const badgeEl = document.getElementById('badge-estrategia');

  if (id === 'geral') {
    iconEl.textContent = '🌐';
    iconEl.className = 'chat-channel-icon geral';

    nomeEl.textContent = 'Canal Geral';
    subEl.textContent =
      'ServidorCentral (Observer) — todos os usuários';

    badgeEl.textContent = 'PÚBLICO';
    badgeEl.className =
      'badge-estrategia publico';
  } else if (grupos.has(id)) {
    const g = grupos.get(id);

    iconEl.textContent =
      g.nome.charAt(0).toUpperCase();

    iconEl.className =
      'chat-channel-icon privado-icon grupo-icon';

    nomeEl.textContent = g.nome;

    subEl.textContent =
      `👥 ${g.membros.length} membros · Criado por ${g.criador}`;

    badgeEl.textContent = 'GRUPO';
    badgeEl.className =
      'badge-estrategia grupo';
  } else {
    const online =
      usuariosOnline.find((u) => u.nome === id);

    iconEl.textContent =
      id.charAt(0).toUpperCase();

    iconEl.className =
      'chat-channel-icon privado-icon';

    nomeEl.textContent = id;

    subEl.textContent =
      online ? '🟢 Online agora' : '⚫ Offline';

    badgeEl.textContent = 'PRIVADO';
    badgeEl.className =
      'badge-estrategia privado';
  }
}

// ─── Renderização de Mensagem ─────────────────────────────────────────────────
function renderizarMensagem(pacote) {
  const container =
    document.getElementById('messages-container');

  const meuNome = celularUsuario?.nome;
  const isMeu = pacote.remetente === meuNome;
  const isSecreta = pacote.tipo === 'SISTEMA_SECRETO';
  const hora = formatarHora(pacote.timestamp);

  const bubble = document.createElement('div');

  if (isSecreta) {
    bubble.className =
      'message-wrapper mensagem-secreta-wrapper';

    bubble.innerHTML = `
      <div class="mensagem-secreta">
        <div class="mensagem-secreta-icon">🔐</div>

        <div class="mensagem-secreta-corpo">
          <div class="mensagem-secreta-titulo">
            Mensagem Secreta do Servidor
          </div>

          <div class="mensagem-secreta-texto">
            ${formatarTexto(
              pacote.texto.replace(
                '🔐 [Mensagem Secreta do Servidor] ',
                ''
              )
            )}
          </div>

          <div class="mensagem-secreta-hora">
            ${hora}
          </div>
        </div>
      </div>
    `;
  } else {
    bubble.className =
      `message-wrapper ${isMeu ? 'minha' : 'outro'}`;

    bubble.dataset.id = pacote.id;

    bubble.innerHTML = `
      <div class="message-bubble ${pacote.tipo.toLowerCase()} ${isMeu ? 'meu' : ''}">
        ${
          !isMeu
            ? `<div class="msg-remetente">${escapeHtml(pacote.remetente)}</div>`
            : ''
        }

        <div class="msg-texto">
          ${formatarTexto(pacote.texto)}
        </div>

        <div class="msg-meta">
          <span class="msg-hora">${hora}</span>

          ${
            isMeu
              ? `<svg class="msg-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
              : ''
          }
        </div>
      </div>
    `;
  }

  bubble.style.opacity = '0';
  bubble.style.transform = 'translateY(8px)';

  container.appendChild(bubble);

  requestAnimationFrame(() => {
    bubble.style.transition =
      'opacity 0.25s ease, transform 0.25s ease';

    bubble.style.opacity = '1';
    bubble.style.transform = 'translateY(0)';
  });

  container.scrollTop =
    container.scrollHeight;
}

// ─── Modal: Criar Grupo ───────────────────────────────────────────────────────
function setupModalGrupo() {
  // Também impede duplicação dos eventos do modal após reconexões.
  if (modalGrupoConfigurado) {
    return;
  }

  modalGrupoConfigurado = true;

  const btnCriar =
    document.getElementById('btn-criar-grupo');

  const modal =
    document.getElementById('modal-grupo');

  const btnFechar =
    document.getElementById('modal-fechar');

  const btnConfirmar =
    document.getElementById('modal-confirmar');

  btnCriar.addEventListener('click', () => {
    atualizarListaMembrosCriarGrupo();
    modal.classList.add('aberto');
  });

  btnFechar.addEventListener(
    'click',
    () => fecharModal()
  );

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      fecharModal();
    }
  });

  btnConfirmar.addEventListener(
    'click',
    criarGrupo
  );
}

function fecharModal() {
  document
    .getElementById('modal-grupo')
    .classList.remove('aberto');

  document
    .getElementById('modal-nome-grupo')
    .value = '';

  document
    .querySelectorAll('.modal-membro-check input')
    .forEach((cb) => {
      cb.checked = false;
    });

  document
    .querySelectorAll('.modal-membro-check')
    .forEach((el) => {
      el.classList.remove('selecionado');
    });
}

function atualizarListaMembrosCriarGrupo() {
  const lista =
    document.getElementById('modal-lista-membros');

  if (!lista) return;

  const meuNome = celularUsuario?.nome;

  const outros =
    usuariosOnline.filter((u) => u.nome !== meuNome);

  if (outros.length === 0) {
    lista.innerHTML =
      '<div class="modal-sem-usuarios">Nenhum usuário online no momento.</div>';

    return;
  }

  lista.innerHTML = outros
    .map(
      (u) => `
    <label class="modal-membro-check" id="check-${u.nome.replace(/\s+/g, '_')}">
      <input
        type="checkbox"
        value="${u.nome}"
        onchange="toggleMembroGrupo('${u.nome}', this)"
      >

      <div class="modal-membro-avatar">
        ${u.nome.charAt(0).toUpperCase()}
      </div>

      <span class="modal-membro-nome">
        ${escapeHtml(u.nome)}
      </span>

      <span class="modal-membro-status">
        Online
      </span>
    </label>
  `
    )
    .join('');
}

function toggleMembroGrupo(nome, checkbox) {
  const label = checkbox.closest('label');

  if (checkbox.checked) {
    label.classList.add('selecionado');
  } else {
    label.classList.remove('selecionado');
  }
}

function criarGrupo() {
  const nomeGrupo =
    document
      .getElementById('modal-nome-grupo')
      .value
      .trim();

  if (!nomeGrupo) {
    mostrarToast(
      'Digite um nome para o grupo!',
      'aviso'
    );

    document
      .getElementById('modal-nome-grupo')
      .focus();

    return;
  }

  const membros = [
    ...document.querySelectorAll(
      '.modal-membro-check input:checked'
    ),
  ].map((cb) => cb.value);

  if (membros.length === 0) {
    mostrarToast(
      'Selecione ao menos um membro!',
      'aviso'
    );

    return;
  }

  socket.emit('criar_grupo', {
    nome: nomeGrupo,
    membros,
  });

  fecharModal();
}

// ─── Mensagem do Sistema ──────────────────────────────────────────────────────
function adicionarMensagemSistema(texto, tipo = 'info') {
  const container =
    document.getElementById('messages-container');

  const div =
    document.createElement('div');

  div.className = `sistema-msg ${tipo}`;
  div.textContent = texto;

  container.appendChild(div);

  container.scrollTop =
    container.scrollHeight;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'info') {
  const toast =
    document.getElementById('toast');

  toast.textContent = msg;
  toast.className =
    `toast ${tipo} show`;

  setTimeout(
    () => toast.classList.remove('show'),
    3500
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarTexto(text) {
  const escaped = escapeHtml(text);

  return escaped.replace(
    /@(\w+)/g,
    '<span class="mencao-tag">@$1</span>'
  );
}

function formatarHora(timestamp) {
  return new Date(timestamp).toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}