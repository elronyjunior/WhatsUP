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
let socket        = null;
let celularUsuario = null;
let usuariosOnline = [];

let conversaAtiva = 'geral';           // 'geral' | nomeUsuario | grupoId
let conversas     = new Map();         // Map<string, mensagem[]>
let naoLidas      = new Map();         // Map<string, number>
let grupos        = new Map();         // Map<grupoId, { id, nome, membros, criador }>
let buscaQuery    = '';
let historicoCarregado = new Set();    // Conversas cujo histórico já foi carregado

// ─── Padrão State: Presença do Usuário ────────────────────────────────────────
const LIMITE_INATIVIDADE_MS = 3 * 60 * 1000; // 3 min sem interação → Ausente
let timerInatividade = null;
let audioCtxNotificacao = null;        // reaproveitado entre os "plins" p/ não recriar o contexto

conversas.set('geral', []);

// ─── Inicialização ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupLoginScreen();
});

// ─── Abas Login / Registro ────────────────────────────────────────────────────
function trocarAba(aba) {
  const tabLogin    = document.getElementById('tab-login');
  const tabRegistro = document.getElementById('tab-registro');
  const formLogin   = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');

  // Limpa erros
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
  const loginBtn   = document.getElementById('btn-entrar');
  const nomeInput  = document.getElementById('input-nome');
  const senhaInput = document.getElementById('input-senha');
  const regBtn     = document.getElementById('btn-registrar');

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
    if (e.key === 'Enter') document.getElementById('input-reg-senha').focus();
    document.getElementById('registro-error').classList.add('hidden');
  });
  document.getElementById('input-reg-senha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('input-reg-senha2').focus();
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

    // Login OK → conectar ao Socket.IO
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
  const nome  = document.getElementById('input-reg-nome').value.trim();
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

    // Registro OK → trocar para aba de login com mensagem de sucesso
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
    celularUsuario.ganchosUI = criarGanchosUI();
    socket.emit('registrar_usuario', nome);
    mostrarChat(nome);
  });

  socket.on('disconnect', () => {
    adicionarMensagemSistema('Conexão perdida. Tentando reconectar...', 'erro');
  });

  // Mensagem pública ou privada recebida
  socket.on('mensagem_recebida', (pacote) => {
    adicionarMensagemConversa(pacote);
  });

  // Mensagem secreta do servidor no Canal Geral
  socket.on('mensagem_secreta_geral', (pacote) => {
    if (!conversas.has('geral')) conversas.set('geral', []);
    conversas.get('geral').unshift(pacote);  // coloca no início
    if (conversaAtiva === 'geral') {
      renderizarMensagensAtuais();
    }
    renderizarConversas();
  });

  // Lista de usuários atualizada
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

  // Grupos existentes ao entrar
  socket.on('lista_grupos', (listaGrupos) => {
    listaGrupos.forEach((g) => {
      grupos.set(g.id, g);
      if (!conversas.has(g.id)) conversas.set(g.id, []);
    });
    renderizarConversas();
  });

  // Novo grupo criado (pelo próprio ou por outro membro)
  socket.on('grupo_criado', (grupo) => {
    grupos.set(grupo.id, grupo);
    if (!conversas.has(grupo.id)) conversas.set(grupo.id, []);
    renderizarConversas();
    mostrarToast(`👥 Grupo "${grupo.nome}" criado!`, 'info');
    // Abre automaticamente o grupo recém-criado se sou o criador
    if (grupo.criador === celularUsuario?.nome) {
      abrirConversa(grupo.id);
    }
  });

  // Histórico de mensagens carregado do Cassandra
  socket.on('historico_carregado', ({ conversaId, mensagens }) => {
    if (!mensagens || mensagens.length === 0) return;

    // Mapeia conversaId do banco para a chave local da conversa
    const chaveLocal = mapearConversaIdParaLocal(conversaId);
    if (!conversas.has(chaveLocal)) conversas.set(chaveLocal, []);

    const msgsAtuais = conversas.get(chaveLocal);
    const idsExistentes = new Set(msgsAtuais.map((m) => m.id));

    // Adiciona apenas mensagens que não existem ainda
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

  // Padrão State (EstadoMensagem): o servidor avisa que uma mensagem minha
  // avançou de estado (ENTREGUE ou LIDA) — atualiza o check na tela.
  socket.on('status_mensagem_atualizado', ({ id, status }) => {
    atualizarStatusMensagem(id, status);
  });
}

/**
 * Mapeia o conversaId do banco para a chave usada localmente nas conversas.
 * Ex: 'geral' → 'geral', 'priv_Alice_Bob' → 'Alice' ou 'Bob' (o outro), 'grupo_xxx' → 'grupo_xxx'
 */
function mapearConversaIdParaLocal(conversaId) {
  if (conversaId === 'geral') return 'geral';
  if (conversaId.startsWith('grupo_')) return conversaId;
  if (conversaId.startsWith('priv_')) {
    const meuNome = celularUsuario?.nome;
    const partes = conversaId.replace('priv_', '').split('_');
    // Retorna o nome do outro participante
    return partes.find((p) => p !== meuNome) || partes[0];
  }
  return conversaId;
}

/**
 * Gera o conversaId canônico para solicitar histórico ao servidor.
 * Deve corresponder à lógica do MensagemRepository.gerarConversaId()
 */
function gerarConversaIdParaHistorico(chaveLocal) {
  if (chaveLocal === 'geral') return 'geral';
  if (chaveLocal.startsWith('grupo_')) return chaveLocal;
  // Chat privado: ordena os nomes
  const meuNome = celularUsuario?.nome;
  const participantes = [meuNome, chaveLocal].sort();
  return `priv_${participantes.join('_')}`;
}

// ─── Chat Screen ──────────────────────────────────────────────────────────────
function mostrarChat(nome) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  document.getElementById('nome-usuario').textContent = nome;
  document.getElementById('avatar-inicial').textContent = nome.charAt(0).toUpperCase();

  atualizarHeader('geral');
  renderizarConversas();
  setupChatEvents();
  setupModalGrupo();
  setupMenuPresenca();
  iniciarMonitorInatividade();
  solicitarPermissaoNotificacaoSeNecessario();

  // Carrega histórico do Canal Geral
  carregarHistorico('geral');
}

function setupChatEvents() {
  const msgInput  = document.getElementById('msg-input');
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
  if (historicoCarregado.has(conversaId)) return;
  historicoCarregado.add(conversaId);
  socket.emit('carregar_historico', { conversaId, limite: 50 });
}

// ─── Envio de Mensagem ────────────────────────────────────────────────────────
function enviarMensagem() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !celularUsuario) return;

  try {
    if (conversaAtiva === 'geral') {
      // EnvioPublico → broadcast para todos
      celularUsuario.mudarEstrategia(new EnvioPublico(celularUsuario.nome));
      celularUsuario.escreverMensagem(texto, []);

    } else if (grupos.has(conversaAtiva)) {
      // Mensagem de grupo — enviada via evento dedicado
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
      // EnvioPrivado → só para o destinatário
      celularUsuario.mudarEstrategia(new EnvioPrivado(celularUsuario.nome));
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

  // Carrega histórico do Cassandra se ainda não foi carregado
  carregarHistorico(id);

  renderizarConversas();
  renderizarMensagensAtuais();
  atualizarHeader(id);
  marcarComoLidaSeNecessario(id);

  // Em telas de celular a lista de conversas e o chat ocupam a tela toda,
  // alternando como no WhatsApp. Em telas largas essa classe não tem efeito.
  document.getElementById('chat-screen').classList.add('conversa-aberta');

  // Evita abrir o teclado virtual automaticamente no celular (empurraria o
  // layout); em telas maiores o foco automático continua sendo útil.
  if (!ehTelaMobile()) {
    document.getElementById('msg-input').focus();
  }
}

/**
 * Volta da tela de chat para a lista de conversas (usado no botão "←" do
 * cabeçalho, visível apenas em telas de celular).
 */
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
    // Privada: chave = o outro participante
    chave = pacote.remetente === meuNome
      ? pacote.destinatarios[0]
      : pacote.remetente;
  }

  if (!conversas.has(chave)) conversas.set(chave, []);
  conversas.get(chave).push(pacote);

  // A conversa "em foco" é a que está aberta E com a aba/janela visível —
  // só nesse caso o usuário está mesmo olhando a mensagem chegar ao vivo.
  const conversaEmFoco = chave === conversaAtiva && !document.hidden;

  if (chave === conversaAtiva) {
    renderizarMensagem(pacote);
  } else {
    naoLidas.set(chave, (naoLidas.get(chave) || 0) + 1);
  }

  renderizarConversas();

  // Padrão State: a reação a uma mensagem recebida (som, toast, notificação
  // nativa, auto-resposta...) é decidida pelo EstadoPresenca atual — nunca
  // para mensagens ecoadas de volta por mim mesmo, nem para a conversa que
  // já está sendo olhada em primeiro plano.
  if (pacote.remetente !== meuNome && celularUsuario && !conversaEmFoco) {
    celularUsuario.receberMensagem(pacote, chave);
  }

  // Padrão State (EstadoMensagem): se a conversa já está aberta e em foco,
  // a mensagem acabou de ser vista — o check azul não espera eu reabrir a
  // conversa depois, avisa o servidor agora mesmo.
  if (pacote.tipo === 'PRIVADO' && pacote.remetente !== meuNome && conversaEmFoco) {
    socket.emit('marcar_como_lida', {
      mensagens: [{ id: pacote.id, remetente: pacote.remetente, timestamp: pacote.timestamp }],
    });
  }
}

// ─── Renderização do Sidebar ──────────────────────────────────────────────────
function renderizarConversas() {
  const lista   = document.getElementById('lista-conversas');
  const meuNome = celularUsuario?.nome;

  const geralMsgs    = conversas.get('geral') || [];
  const geralUltima  = geralMsgs.length ? geralMsgs[geralMsgs.length - 1] : null;
  const geralNaoLidas = naoLidas.get('geral') || 0;
  const geralAtivo   = conversaAtiva === 'geral';

  const mostraGeral = !buscaQuery || 'canal geral'.includes(buscaQuery);

  // Usuários online (exceto eu)
  const outrosUsuarios = usuariosOnline.filter((u) => u.nome !== meuNome);
  const nomesOnline    = new Set(outrosUsuarios.map((u) => u.nome));

  // Usuários offline com histórico
  const comHistorico = [...conversas.keys()].filter(
    (k) => k !== 'geral' && !k.startsWith('grupo_') && !nomesOnline.has(k)
  );

  const todasPrivadas = [
    ...outrosUsuarios,
    ...comHistorico.map((nome) => ({ nome, offline: true })),
  ].filter((u) => !buscaQuery || u.nome.toLowerCase().includes(buscaQuery));

  // Grupos do usuário atual
  const meusGrupos = [...grupos.values()].filter(
    (g) => g.membros.includes(meuNome) &&
           (!buscaQuery || g.nome.toLowerCase().includes(buscaQuery))
  );

  lista.innerHTML = `
    ${mostraGeral ? `
    <div class="conversa-item ${geralAtivo ? 'ativa' : ''}" id="conv-geral" onclick="abrirConversa('geral')">
      <div class="conv-avatar geral">🌐</div>
      <div class="conv-info">
        <div class="conv-top">
          <span class="conv-nome">Canal Geral</span>
          ${geralUltima ? `<span class="conv-hora">${formatarHora(geralUltima.timestamp)}</span>` : ''}
        </div>
        <div class="conv-preview">
          ${geralUltima
            ? `<span class="conv-preview-remetente">${geralUltima.remetente === meuNome ? 'Você' : geralUltima.remetente}:</span> ${escapeHtml(geralUltima.texto).slice(0, 35)}${geralUltima.texto.length > 35 ? '…' : ''}`
            : '<span class="conv-preview-vazio">Sem mensagens ainda</span>'}
        </div>
      </div>
      ${geralNaoLidas > 0 ? `<span class="conv-badge">${geralNaoLidas}</span>` : ''}
    </div>
    ` : ''}

    ${meusGrupos.length > 0 ? `
      <div class="conversas-section-sep">
        <span>Grupos</span>
        <span class="usuarios-count-badge">${meusGrupos.length}</span>
      </div>
      ${meusGrupos.map((g) => {
        const msgs        = conversas.get(g.id) || [];
        const ultima      = msgs.length ? msgs[msgs.length - 1] : null;
        const qtdNaoLidas = naoLidas.get(g.id) || 0;
        const ativo       = conversaAtiva === g.id;
        return `
          <div class="conversa-item grupo-item ${ativo ? 'ativa' : ''}" onclick="abrirConversa('${g.id}')">
            <div class="conv-avatar grupo">${g.nome.charAt(0).toUpperCase()}</div>
            <div class="conv-info">
              <div class="conv-top">
                <span class="conv-nome">👥 ${escapeHtml(g.nome)}</span>
                ${ultima ? `<span class="conv-hora">${formatarHora(ultima.timestamp)}</span>` : ''}
              </div>
              <div class="conv-preview">
                ${ultima
                  ? `<span class="conv-preview-remetente">${ultima.remetente === meuNome ? 'Você' : ultima.remetente}:</span> ${escapeHtml(ultima.texto).slice(0, 35)}${ultima.texto.length > 35 ? '…' : ''}`
                  : `<span class="conv-preview-vazio">${g.membros.length} membros</span>`}
              </div>
            </div>
            ${qtdNaoLidas > 0 ? `<span class="conv-badge">${qtdNaoLidas}</span>` : ''}
          </div>
        `;
      }).join('')}
    ` : ''}

    ${todasPrivadas.length > 0 ? `
      <div class="conversas-section-sep">
        <span>Mensagens privadas</span>
        <span class="usuarios-count-badge">${outrosUsuarios.length}</span>
      </div>
    ` : ''}

    ${todasPrivadas.map((u) => {
      const msgs        = conversas.get(u.nome) || [];
      const ultima      = msgs.length ? msgs[msgs.length - 1] : null;
      const qtdNaoLidas = naoLidas.get(u.nome) || 0;
      const ativo       = conversaAtiva === u.nome;
      const info        = infoEstadoPresenca(u.offline ? 'Offline' : u.estado);
      return `
        <div class="conversa-item ${ativo ? 'ativa' : ''} ${u.offline ? 'offline' : ''}"
             onclick="abrirConversa('${u.nome}')">
          <div class="conv-avatar usuario">${u.nome.charAt(0).toUpperCase()}</div>
          <div class="conv-status-dot ${info.cssClass}" title="${info.texto}"></div>
          <div class="conv-info">
            <div class="conv-top">
              <span class="conv-nome">${escapeHtml(u.nome)}</span>
              ${ultima ? `<span class="conv-hora">${formatarHora(ultima.timestamp)}</span>` : ''}
            </div>
            <div class="conv-preview">
              ${ultima
                ? `<span class="conv-preview-remetente">${ultima.remetente === meuNome ? 'Você' : ultima.remetente}:</span> ${escapeHtml(ultima.texto).slice(0, 35)}${ultima.texto.length > 35 ? '…' : ''}`
                : '<span class="conv-preview-vazio">Iniciar conversa...</span>'}
            </div>
          </div>
          ${qtdNaoLidas > 0 ? `<span class="conv-badge">${qtdNaoLidas}</span>` : ''}
        </div>
      `;
    }).join('')}

    ${!mostraGeral && todasPrivadas.length === 0 && meusGrupos.length === 0 ? `
      <div class="conv-sem-resultado">🔍 Nenhuma conversa encontrada</div>
    ` : ''}
  `;
}

// ─── Renderizar mensagens da conversa ativa ───────────────────────────────────
function renderizarMensagensAtuais() {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';
  const msgs = conversas.get(conversaAtiva) || [];
  msgs.forEach((pacote) => renderizarMensagem(pacote));
  container.scrollTop = container.scrollHeight;
}

// ─── Header dinâmico ─────────────────────────────────────────────────────────
function atualizarHeader(id) {
  const iconEl  = document.getElementById('header-icon');
  const nomeEl  = document.getElementById('header-nome');
  const subEl   = document.getElementById('header-sub');
  const badgeEl = document.getElementById('badge-estrategia');

  if (id === 'geral') {
    iconEl.textContent  = '🌐';
    iconEl.className    = 'chat-channel-icon geral';
    nomeEl.textContent  = 'Canal Geral';
    subEl.textContent   = 'ServidorCentral (Observer) — todos os usuários';
    badgeEl.textContent = 'PÚBLICO';
    badgeEl.className   = 'badge-estrategia publico';

  } else if (grupos.has(id)) {
    const g = grupos.get(id);
    iconEl.textContent  = g.nome.charAt(0).toUpperCase();
    iconEl.className    = 'chat-channel-icon privado-icon grupo-icon';
    nomeEl.textContent  = g.nome;
    subEl.textContent   = `👥 ${g.membros.length} membros · Criado por ${g.criador}`;
    badgeEl.textContent = 'GRUPO';
    badgeEl.className   = 'badge-estrategia grupo';

  } else {
    const online = usuariosOnline.find((u) => u.nome === id);
    const info   = infoEstadoPresenca(online?.estado || 'Offline');
    iconEl.textContent  = id.charAt(0).toUpperCase();
    iconEl.className    = 'chat-channel-icon privado-icon';
    nomeEl.textContent  = id;
    subEl.textContent   = `${info.emoji} ${info.texto}`;
    badgeEl.textContent = 'PRIVADO';
    badgeEl.className   = 'badge-estrategia privado';
  }
}

// ─── Renderização de Mensagem ─────────────────────────────────────────────────
function renderizarMensagem(pacote) {
  const container = document.getElementById('messages-container');
  const meuNome   = celularUsuario?.nome;
  const isMeu     = pacote.remetente === meuNome;
  const isSecreta = pacote.tipo === 'SISTEMA_SECRETO';
  const hora      = formatarHora(pacote.timestamp);

  const bubble = document.createElement('div');

  if (isSecreta) {
    bubble.className = 'message-wrapper mensagem-secreta-wrapper';
    bubble.innerHTML = `
      <div class="mensagem-secreta">
        <div class="mensagem-secreta-icon">🔐</div>
        <div class="mensagem-secreta-corpo">
          <div class="mensagem-secreta-titulo">Mensagem Secreta do Servidor</div>
          <div class="mensagem-secreta-texto">${formatarTexto(pacote.texto.replace('🔐 [Mensagem Secreta do Servidor] ', ''))}</div>
          <div class="mensagem-secreta-hora">${hora}</div>
        </div>
      </div>
    `;
  } else {
    bubble.className = `message-wrapper ${isMeu ? 'minha' : 'outro'}`;
    bubble.dataset.id = pacote.id;
    bubble.innerHTML = `
      <div class="message-bubble ${pacote.tipo.toLowerCase()} ${isMeu ? 'meu' : ''}">
        ${!isMeu ? `<div class="msg-remetente">${escapeHtml(pacote.remetente)}</div>` : ''}
        <div class="msg-texto">${formatarTexto(pacote.texto)}</div>
        <div class="msg-meta">
          <span class="msg-hora">${hora}</span>
          ${isMeu ? renderizarCheckMensagem(pacote) : ''}
        </div>
      </div>
    `;
  }

  bubble.style.opacity  = '0';
  bubble.style.transform = 'translateY(8px)';
  container.appendChild(bubble);

  requestAnimationFrame(() => {
    bubble.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    bubble.style.opacity    = '1';
    bubble.style.transform  = 'translateY(0)';
  });

  container.scrollTop = container.scrollHeight;
}

// ─── Modal: Criar Grupo ───────────────────────────────────────────────────────
function setupModalGrupo() {
  const btnCriar  = document.getElementById('btn-criar-grupo');
  const modal     = document.getElementById('modal-grupo');
  const btnFechar = document.getElementById('modal-fechar');
  const btnConfirmar = document.getElementById('modal-confirmar');

  btnCriar.addEventListener('click', () => {
    atualizarListaMembrosCriarGrupo();
    modal.classList.add('aberto');
  });

  btnFechar.addEventListener('click', () => fecharModal());

  modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal();
  });

  btnConfirmar.addEventListener('click', criarGrupo);
}

function fecharModal() {
  document.getElementById('modal-grupo').classList.remove('aberto');
  document.getElementById('modal-nome-grupo').value = '';
  // Desmarca todos
  document.querySelectorAll('.modal-membro-check input').forEach((cb) => (cb.checked = false));
  document.querySelectorAll('.modal-membro-check').forEach((el) => el.classList.remove('selecionado'));
}

function atualizarListaMembrosCriarGrupo() {
  const lista   = document.getElementById('modal-lista-membros');
  if (!lista) return;
  const meuNome = celularUsuario?.nome;
  const outros  = usuariosOnline.filter((u) => u.nome !== meuNome);

  if (outros.length === 0) {
    lista.innerHTML = '<div class="modal-sem-usuarios">Nenhum usuário online no momento.</div>';
    return;
  }

  lista.innerHTML = outros.map((u) => `
    <label class="modal-membro-check" id="check-${u.nome.replace(/\s+/g,'_')}">
      <input type="checkbox" value="${u.nome}" onchange="toggleMembroGrupo('${u.nome}', this)">
      <div class="modal-membro-avatar">${u.nome.charAt(0).toUpperCase()}</div>
      <span class="modal-membro-nome">${escapeHtml(u.nome)}</span>
      <span class="modal-membro-status">Online</span>
    </label>
  `).join('');
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
  const nomeGrupo = document.getElementById('modal-nome-grupo').value.trim();
  if (!nomeGrupo) {
    mostrarToast('Digite um nome para o grupo!', 'aviso');
    document.getElementById('modal-nome-grupo').focus();
    return;
  }

  const membros = [...document.querySelectorAll('.modal-membro-check input:checked')]
    .map((cb) => cb.value);

  if (membros.length === 0) {
    mostrarToast('Selecione ao menos um membro!', 'aviso');
    return;
  }

  socket.emit('criar_grupo', { nome: nomeGrupo, membros });
  fecharModal();
}

// ─── Padrão State: Presença do Usuário ────────────────────────────────────────

/**
 * Monta os "ganchos de UI" que os EstadoPresenca concretos usam para
 * produzir efeitos (som, toast, notificação nativa) sem que CelularUsuario
 * precise conhecer o DOM — mantém o núcleo (core/) livre de renderização,
 * do mesmo jeito que EstrategiaEnvio nunca toca a tela.
 */
function criarGanchosUI() {
  return {
    tocarSom: tocarSomNotificacao,
    janelaOculta: () => document.hidden,
    notificarNativo: (pacote, chaveConversa) => exibirNotificacaoNativa(pacote, chaveConversa),
    exibirToast: (pacote, chaveConversa) => {
      mostrarToast(`💬 ${rotuloRemetente(pacote, chaveConversa)}: ${pacote.texto.slice(0, 40)}`, 'info');
    },
  };
}

/** Monta o rótulo "Fulano (Contexto)" usado no toast e na notificação nativa */
function rotuloRemetente(pacote, chaveConversa) {
  if (pacote.tipo === 'PUBLICO') return `${pacote.remetente} (Geral)`;
  if (pacote.tipo === 'GRUPO')   return `${pacote.remetente} (${grupos.get(chaveConversa)?.nome || 'Grupo'})`;
  return pacote.remetente;
}

/**
 * Toca um som curto de notificação ("plim") sintetizado via Web Audio API —
 * evita depender de um arquivo de áudio externo.
 */
function tocarSomNotificacao() {
  try {
    audioCtxNotificacao = audioCtxNotificacao || new (window.AudioContext || window.webkitAudioContext)();
    const agora = audioCtxNotificacao.currentTime;
    const osc  = audioCtxNotificacao.createOscillator();
    const gain = audioCtxNotificacao.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, agora);
    osc.frequency.exponentialRampToValueAtTime(660, agora + 0.15);
    gain.gain.setValueAtTime(0.15, agora);
    gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.35);
    osc.connect(gain).connect(audioCtxNotificacao.destination);
    osc.start(agora);
    osc.stop(agora + 0.35);
  } catch (err) {
    console.warn('[Presença] Não foi possível tocar o som de notificação:', err.message);
  }
}

/** Solicita permissão de notificação nativa uma única vez, sob demanda */
function solicitarPermissaoNotificacaoSeNecessario() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

/**
 * Exibe uma notificação nativa do sistema operacional — usada pelo
 * EstadoOnline/EstadoAusente quando a janela está oculta/minimizada.
 */
function exibirNotificacaoNativa(pacote, chaveConversa) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const notif = new Notification(rotuloRemetente(pacote, chaveConversa), {
    body: pacote.texto.slice(0, 120),
    tag: chaveConversa, // agrupa notificações da mesma conversa
  });

  notif.onclick = () => {
    window.focus();
    abrirConversa(chaveConversa);
    notif.close();
  };
}

/** Liga os listeners que detectam atividade do mouse/teclado/toque */
function iniciarMonitorInatividade() {
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((evento) => {
    document.addEventListener(evento, registrarAtividade, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) registrarAtividade();
  });
  reiniciarTimerInatividade();
}

/**
 * Transição Interna (self-transitioning): atividade recente volta o estado
 * Ausente para Online automaticamente; qualquer atividade também reinicia
 * a contagem para a próxima expiração por inatividade. Não Perturbe é uma
 * escolha explícita do usuário — atividade (ou a falta dela) não a altera.
 */
function registrarAtividade() {
  if (celularUsuario?.getEstadoPresenca()?.rotulo === 'Ausente') {
    mudarEstadoPresenca(new EstadoOnline());
  }
  reiniciarTimerInatividade();
}

function reiniciarTimerInatividade() {
  clearTimeout(timerInatividade);
  timerInatividade = setTimeout(() => {
    if (celularUsuario?.getEstadoPresenca()?.rotulo === 'Online') {
      mudarEstadoPresenca(new EstadoAusente());
    }
  }, LIMITE_INATIVIDADE_MS);
}

/** Transição Externa (context-driven): troca de estado vinda da UI */
function mudarEstadoPresenca(novoEstado) {
  if (!celularUsuario) return;
  celularUsuario.mudarEstadoPresenca(novoEstado);
  atualizarIndicadorPresencaPropria(novoEstado);
}

function atualizarIndicadorPresencaPropria(estado) {
  const dot   = document.getElementById('status-dot-proprio');
  const label = document.getElementById('status-label-proprio');
  if (dot)   dot.className     = `status-dot ${estado.corCss}`;
  if (label) label.textContent = estado.rotulo;
}

/** Liga o botão de status e o menu dropdown (Online / Ausente / Não perturbe) */
function setupMenuPresenca() {
  const btn  = document.getElementById('btn-status-presenca');
  const menu = document.getElementById('menu-status-presenca');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const aberto = menu.classList.toggle('aberto');
    btn.setAttribute('aria-expanded', String(aberto));
  });

  menu.querySelectorAll('.status-opcao').forEach((opcao) => {
    opcao.addEventListener('click', () => {
      const estado = criarEstadoPresencaPorChave(opcao.dataset.estado);
      if (estado) mudarEstadoPresenca(estado);
      menu.classList.remove('aberto');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  // Fecha o menu ao clicar fora dele
  document.addEventListener('click', () => {
    menu.classList.remove('aberto');
    btn.setAttribute('aria-expanded', 'false');
  });
}

function criarEstadoPresencaPorChave(chave) {
  switch (chave) {
    case 'online':  return new EstadoOnline();
    case 'ausente': return new EstadoAusente();
    case 'dnd':     return new EstadoNaoPerturbe();
    default: return null;
  }
}

/** Traduz o rótulo de presença (vindo do servidor) em emoji + classe CSS + texto */
function infoEstadoPresenca(rotulo) {
  switch (rotulo) {
    case 'Ausente':      return { emoji: '🌙', cssClass: 'ausente', texto: 'Ausente' };
    case 'Não Perturbe': return { emoji: '⛔', cssClass: 'dnd',     texto: 'Não perturbe' };
    case 'Offline':      return { emoji: '⚫', cssClass: 'offline', texto: 'Offline' };
    default:             return { emoji: '🟢', cssClass: 'online',  texto: 'Online agora' };
  }
}

// ─── Padrão State: Status da Mensagem (check azul) ────────────────────────────
// Só se aplica a mensagens PRIVADO — Público/Grupo/Secreto mantêm o check
// único estático de sempre (leitura em 1-1 é o caso bem definido pelo pedido;
// "lido por todos" num grupo é uma semântica bem mais complexa, fora de escopo).

/** Fábrica de EstadoMensagem a partir do rótulo enviado pelo servidor */
function criarEstadoMensagemPorRotulo(rotulo) {
  switch (rotulo) {
    case 'ENTREGUE': return new EstadoEntregue();
    case 'LIDA':     return new EstadoLida();
    default:         return new EstadoEnviada();
  }
}

/** Monta o HTML do check de uma mensagem, de acordo com tipo + status atual */
function renderizarCheckMensagem(pacote) {
  if (pacote.tipo !== 'PRIVADO') {
    return new EstadoEnviada().renderizarCheck();
  }
  return criarEstadoMensagemPorRotulo(pacote.status).renderizarCheck();
}

/**
 * Avisa o servidor que as mensagens passadas (de uma conversa PRIVADO) foram
 * vistas agora — dispara a transição para EstadoLida (check azul). Chamado
 * ao abrir a conversa; mensagens que chegam com a conversa já aberta e em
 * foco são marcadas na hora, direto em adicionarMensagemConversa().
 */
function marcarComoLidaSeNecessario(chaveLocal) {
  if (chaveLocal === 'geral' || grupos.has(chaveLocal)) return; // só 1-1 tem check azul
  const meuNome = celularUsuario?.nome;
  const msgs = conversas.get(chaveLocal) || [];
  const paraMarcar = msgs
    .filter((m) => m.tipo === 'PRIVADO' && m.remetente !== meuNome && m.status !== 'LIDA')
    .map((m) => ({ id: m.id, remetente: m.remetente, timestamp: m.timestamp }));

  if (paraMarcar.length > 0) {
    socket.emit('marcar_como_lida', { mensagens: paraMarcar });
  }
}

/**
 * Aplica uma atualização de status (ENTREGUE/LIDA) vinda do servidor: guarda
 * no objeto em memória (para sobreviver a re-renderizações futuras) e, se o
 * balão dessa mensagem estiver na tela agora, troca o check ali mesmo.
 */
function atualizarStatusMensagem(id, status) {
  let pacoteAtualizado = null;
  for (const msgs of conversas.values()) {
    const alvo = msgs.find((m) => m.id === id);
    if (alvo) {
      alvo.status = status;
      pacoteAtualizado = alvo;
      break;
    }
  }
  if (!pacoteAtualizado) return;

  const bubble = document.querySelector(`.message-wrapper[data-id="${id}"]`);
  const checkAntigo = bubble?.querySelector('.msg-check');
  if (checkAntigo) {
    checkAntigo.outerHTML = renderizarCheckMensagem(pacoteAtualizado);
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

// ─── Toast ────────────────────────────────────────────────────────────────────
function mostrarToast(msg, tipo = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${tipo} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
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
  return escaped.replace(/@(\w+)/g, '<span class="mencao-tag">@$1</span>');
}

function formatarHora(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
