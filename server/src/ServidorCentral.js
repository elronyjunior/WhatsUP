const Observador = require('./interfaces/Observador');
const Pacote = require('./models/Pacote');
const EstadoOnline = require('./states/EstadoOnline');
const EstadoNaoPerturbe = require('./states/EstadoNaoPerturbe');
const EstadoAusente = require('./states/EstadoAusente');
const EstadoOffline = require('./states/EstadoOffline');
const EstadoEnviada = require('./states/EstadoEnviada');

/**
 * ServidorCentral - Implementa Observador (Padrão Observer)
 *
 * Responsabilidades:
 *  - Receber notificações dos CelularUsuario via Socket.IO
 *  - Rotear mensagens conforme o tipo do Pacote (PUBLICO, PRIVADO, GRUPO)
 *  - Manter lista de usuários conectados
 *  - Gerenciar grupos criados pelos usuários
 *  - Persistir mensagens e grupos no Cassandra
 *  - Manter o EstadoPresenca (Padrão State) de cada usuário e delegar a
 *    ele a decisão de como entregar cada pacote (entrega imediata ou
 *    fallback de usuário offline)
 *  - Manter o EstadoMensagem (Padrão State) de cada mensagem PRIVADO —
 *    ENVIADA → ENTREGUE → LIDA — e avisar o remetente quando ela avança
 *    (o "check azul" de visualizado)
 */
class ServidorCentral extends Observador {
  /**
   * @param {import('socket.io').Server} io - Instância do Socket.IO Server
   * @param {Object} repositorios - Repositórios de acesso ao banco
   * @param {import('./repositories/MensagemRepository')} repositorios.mensagemRepo
   * @param {import('./repositories/GrupoRepository')} repositorios.grupoRepo
   */
  constructor(io, { mensagemRepo, grupoRepo }) {
    super();
    this.io = io;
    this.mensagemRepo = mensagemRepo;
    this.grupoRepo = grupoRepo;
    // Map<socketId, nome> — registro de usuários conectados
    this.usuariosConectados = new Map();
    // Map<grupoId, { nome, membros: string[], criador: string }> — grupos em memória
    this.grupos = new Map();
    // Map<nome, EstadoPresenca> — estado de presença atual de cada usuário
    // (sobrevive à desconexão do socket: é assim que sabemos que alguém
    // está Offline em vez de simplesmente "não registrado")
    this.estadosPresenca = new Map();
    // Map<messageId, EstadoMensagem> — status de entrega/leitura de cada
    // mensagem PRIVADO (ENVIADA/ENTREGUE/LIDA). Cresce sem limite ao longo
    // da vida do processo — aceitável neste protótipo; uma versão de
    // produção precisaria de expiração/LRU para não vazar memória.
    this.estadosMensagem = new Map();
    this._configurarEventos();
    console.log('✅ [ServidorCentral] Inicializado — aguardando conexões de CelularUsuario...');
  }

  /** Configura todos os eventos Socket.IO */
  _configurarEventos() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 [ServidorCentral] Conexão estabelecida: ${socket.id}`);

      // Registro de usuário ao entrar no chat
      socket.on('registrar_usuario', async (nome) => {
        this.usuariosConectados.set(socket.id, nome);
        // Toda (re)conexão começa como Online — reset do Padrão State,
        // mesmo que o usuário tenha ficado Offline/Ausente/Não Perturbe antes.
        this.estadosPresenca.set(nome, new EstadoOnline());
        console.log(`👤 [ServidorCentral] Usuário registrado: "${nome}" (${socket.id})`);
        this._transmitirListaUsuarios();

        // Carrega grupos do usuário do banco
        try {
          const gruposDoBanco = await this.grupoRepo.buscarGruposDoUsuario(nome);
          gruposDoBanco.forEach((g) => {
            if (!this.grupos.has(g.id)) {
              this.grupos.set(g.id, g);
            }
          });
        } catch (err) {
          console.error(`[ServidorCentral] Erro ao carregar grupos de "${nome}":`, err.message);
        }

        // Envia lista de grupos existentes para o novo usuário
        socket.emit('lista_grupos', this._serializarGrupos(nome));

        // Notifica demais usuários
        socket.broadcast.emit('sistema_mensagem', {
          texto: `${nome} entrou no chat`,
          tipo: 'ENTRADA',
          timestamp: new Date().toISOString(),
        });

        // Mensagem secreta de boas-vindas no Canal Geral
        setTimeout(() => {
          const msgSecreta = new Pacote({
            texto: `🔐 [Mensagem Secreta do Servidor] Olá, ${nome}! Bem-vindo ao ChatApp. Este sistema usa os padrões Observer + Strategy + State. Suas mensagens privadas são entregues com EnvioPrivado e nunca passam por outros usuários. Bom chat! 🎉`,
            remetente: '🤖 ServidorCentral',
            destinatarios: [nome],
            tipo: 'SISTEMA_SECRETO',
          });
          socket.emit('mensagem_secreta_geral', msgSecreta.toJSON());
        }, 800);
      });

      /**
       * Transição Externa do Padrão State: o usuário escolheu um novo status
       * de presença no menu da interface (Online / Ausente / Não Perturbe).
       * "Offline" nunca chega por aqui — só é atribuído internamente no
       * evento 'disconnect', porque exige a ausência de socket ativo.
       */
      socket.on('mudar_estado_presenca', (rotulo) => {
        const nome = this.usuariosConectados.get(socket.id);
        if (!nome) return;

        const novoEstado = this._criarEstadoPorRotulo(rotulo);
        if (!novoEstado) {
          console.warn(`[ServidorCentral] Rótulo de presença inválido recebido de "${nome}": "${rotulo}"`);
          return;
        }

        this.estadosPresenca.set(nome, novoEstado);
        console.log(`🔄 [ServidorCentral] "${nome}" mudou o estado de presença para: ${novoEstado.rotulo}`);
        this._transmitirListaUsuarios();
      });

      /**
       * Padrão State (EstadoMensagem): o destinatário abriu a conversa e viu
       * a(s) mensagem(ns) — avança para LIDA (o "check azul") e avisa quem
       * enviou, se estiver conectado.
       */
      socket.on('marcar_como_lida', ({ mensagens }) => {
        const leitor = this.usuariosConectados.get(socket.id);
        if (!leitor || !Array.isArray(mensagens)) return;

        mensagens.forEach(({ id, remetente, timestamp }) => {
          if (!id || !remetente) return;
          this._avancarEstadoMensagem({ id, remetente, destinatarios: [leitor], timestamp }, 'LIDA');
        });
      });

      /**
       * Evento principal: CelularUsuario chama notificarServidor(pacote)
       */
      socket.on('notificar_servidor', async (dadosPacote) => {
        const pacote = new Pacote(dadosPacote);
        console.log(
          `📦 [ServidorCentral] Pacote recebido de "${pacote.remetente}" — Tipo: ${pacote.tipo}`
        );
        this.receberNotificacao(pacote, socket);

        // Persistir no Cassandra (usa o tipo real para conversaId)
        try {
          const tipoParaConversa = pacote.tipo === 'SECRETO' ? 'PUBLICO' : pacote.tipo;
          const conversaId = this.mensagemRepo.gerarConversaId(
            tipoParaConversa,
            pacote.remetente,
            pacote.destinatarios
          );
          await this.mensagemRepo.salvarMensagem(pacote.toJSON(), conversaId);
        } catch (err) {
          console.error('[ServidorCentral] Erro ao salvar mensagem:', err.message);
        }
      });

      // Criar grupo
      socket.on('criar_grupo', async ({ nome, membros }) => {
        const remetente = this.usuariosConectados.get(socket.id);
        if (!remetente) return;

        const grupoId = `grupo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const todosMembros = [...new Set([remetente, ...membros])];

        const grupoInfo = {
          id: grupoId,
          nome,
          membros: todosMembros,
          criador: remetente,
          criadoEm: new Date().toISOString(),
        };

        this.grupos.set(grupoId, grupoInfo);

        console.log(`👥 [ServidorCentral] Grupo criado: "${nome}" — Membros: [${todosMembros.join(', ')}]`);

        // Persistir no Cassandra
        try {
          await this.grupoRepo.criarGrupo(grupoInfo);
        } catch (err) {
          console.error('[ServidorCentral] Erro ao salvar grupo:', err.message);
        }

        // Notifica todos os membros do novo grupo
        this.usuariosConectados.forEach((nomeMembro, socketId) => {
          if (todosMembros.includes(nomeMembro)) {
            this.io.to(socketId).emit('grupo_criado', grupoInfo);
          }
        });
      });

      // Mensagem de grupo
      socket.on('mensagem_grupo', async (dadosPacote) => {
        const grupo = this.grupos.get(dadosPacote.grupoId);
        if (!grupo) return;

        // Detecta @menções para mensagem secreta dentro do grupo
        const mencoes = this._extrairMencoes(dadosPacote.texto);
        const isSecreto = mencoes.length > 0;

        const pacote = {
          ...dadosPacote,
          tipo: isSecreto ? 'SECRETO' : 'GRUPO',
          destinatarios: isSecreto ? mencoes : dadosPacote.destinatarios,
          timestamp: new Date().toISOString(),
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        };

        if (isSecreto) {
          console.log(`🔐 [ServidorCentral] Mensagem SECRETA no grupo "${grupo.nome}" → mencionados: [${mencoes.join(', ')}]`);
          // Entrega só para mencionados + remetente (que sejam membros do grupo).
          // Passa por _entregarPara() (Padrão State) para que um mencionado
          // offline também receba o fallback simulado, e não só silêncio.
          grupo.membros
            .filter((nome) => mencoes.includes(nome) || nome === dadosPacote.remetente)
            .forEach((nome) => this._entregarPara(nome, pacote));
        } else {
          console.log(`👥 [ServidorCentral] Mensagem de grupo "${grupo.nome}" de "${dadosPacote.remetente}"`);
          // Entrega para todos os membros do grupo — cada um recebe conforme
          // seu próprio EstadoPresenca (Padrão State), incluindo os offline.
          grupo.membros.forEach((nome) => this._entregarPara(nome, pacote));
        }

        // Persistir no Cassandra
        try {
          await this.mensagemRepo.salvarMensagem(pacote, dadosPacote.grupoId);
        } catch (err) {
          console.error('[ServidorCentral] Erro ao salvar mensagem de grupo:', err.message);
        }
      });

      // Carregar histórico de uma conversa
      socket.on('carregar_historico', async ({ conversaId, limite }) => {
        try {
          const nome = this.usuariosConectados.get(socket.id);
          let mensagens = await this.mensagemRepo.buscarMensagens(conversaId, limite || 50);
          // Filtra mensagens secretas: só mostra se o usuário é remetente ou mencionado
          mensagens = mensagens.filter((m) => {
            if (m.tipo !== 'SECRETO') return true;
            return m.remetente === nome || (m.destinatarios && m.destinatarios.includes(nome));
          });

          // Padrão State (EstadoMensagem): se este usuário só recebeu a
          // mensagem agora (via histórico, não ao vivo), ela nunca teve
          // socket ativo antes — é o momento certo de avançar para ENTREGUE.
          mensagens
            .filter((m) => m.tipo === 'PRIVADO' && m.remetente !== nome && m.status === 'ENVIADA')
            .forEach((m) => this._avancarEstadoMensagem(
              { id: m.id, remetente: m.remetente, destinatarios: [nome], timestamp: m.timestamp },
              'ENTREGUE'
            ));

          socket.emit('historico_carregado', { conversaId, mensagens });
        } catch (err) {
          console.error(`[ServidorCentral] Erro ao carregar histórico de "${conversaId}":`, err.message);
          socket.emit('historico_carregado', { conversaId, mensagens: [] });
        }
      });

      // Desconexão
      socket.on('disconnect', () => {
        const nome = this.usuariosConectados.get(socket.id);
        if (nome) {
          this.usuariosConectados.delete(socket.id);
          // Transição Interna do Padrão State: sem socket ativo, o único
          // estado possível é Offline — é o próprio servidor quem retém isso.
          this.estadosPresenca.set(nome, new EstadoOffline());
          console.log(`👋 [ServidorCentral] Usuário desconectado: "${nome}"`);
          this._transmitirListaUsuarios();
          this.io.emit('sistema_mensagem', {
            texto: `${nome} saiu do chat`,
            tipo: 'SAIDA',
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  }

  /**
   * receberNotificacao(pacote) — implementação da interface Observador
   */
  receberNotificacao(pacote, socketRemetente) {
    this._rotearMensagem(pacote, socketRemetente);
  }

  /**
   * Roteia o pacote conforme a estratégia aplicada pelo CelularUsuario
   * PUBLICO  → broadcast para todos
   * PRIVADO  → entrega somente para os destinatários
   * Se a mensagem PUBLICA contém @menções → vira SECRETO (só mencionados veem)
   */
  _rotearMensagem(pacote, socketRemetente) {
    // Detecta @menções em mensagens públicas
    if (pacote.tipo === 'PUBLICO') {
      const mencoes = this._extrairMencoes(pacote.texto);

      if (mencoes.length > 0) {
        // Mensagem secreta: só entrega para mencionados + remetente
        const pacoteSecreto = { ...pacote.toJSON(), tipo: 'SECRETO', destinatarios: mencoes };
        // Atualiza o pacote original para persistência correta
        pacote.tipo = 'SECRETO';
        pacote.destinatarios = mencoes;

        console.log(`🔐 [ServidorCentral] Roteando SECRETO (Canal Geral) → mencionados: [${mencoes.join(', ')}]`);
        socketRemetente.emit('mensagem_recebida', pacoteSecreto);
        // Padrão State: cada mencionado recebe conforme seu EstadoPresenca —
        // inclusive um mencionado offline, que agora cai no fallback simulado
        // em vez de simplesmente não saber que foi citado.
        mencoes
          .filter((nome) => nome !== pacote.remetente)
          .forEach((nome) => this._entregarPara(nome, pacoteSecreto));
      } else {
        console.log(`📢 [ServidorCentral] Roteando PÚBLICO → broadcast global`);
        this.io.emit('mensagem_recebida', pacote.toJSON());
      }

    } else if (pacote.tipo === 'PRIVADO') {
      console.log(
        `🔒 [ServidorCentral] Roteando PRIVADO → destinatários: [${pacote.destinatarios.join(', ')}]`
      );
      socketRemetente.emit('mensagem_recebida', pacote.toJSON());
      // Padrão State: delega a cada destinatário a decisão de como recebê-la.
      // Um destinatário offline não é mais silêncio total — cai no fallback
      // simulado de EstadoOffline (push + e-mail-resumo). Se a entrega for
      // ao vivo, também avança o EstadoMensagem para ENTREGUE (check duplo).
      pacote.destinatarios
        .filter((nome) => nome !== pacote.remetente)
        .forEach((nome) => this._processarEntregaPrivada(pacote, nome));
    }
  }

  /**
   * Extrai @menções do texto da mensagem.
   * @param {string} texto
   * @returns {string[]} Lista de nomes mencionados que existem como usuários conectados
   */
  _extrairMencoes(texto) {
    const regex = /@(\w+)/g;
    const mencoes = [];
    const nomesConectados = new Set(this.usuariosConectados.values());
    let match;
    while ((match = regex.exec(texto)) !== null) {
      if (nomesConectados.has(match[1])) {
        mencoes.push(match[1]);
      }
    }
    return [...new Set(mencoes)]; // remove duplicatas
  }

  /** Emite a lista atualizada de usuários conectados para todos */
  _transmitirListaUsuarios() {
    const usuarios = Array.from(this.usuariosConectados.entries()).map(([socketId, nome]) => ({
      socketId,
      nome,
      // Padrão State: inclui o rótulo do EstadoPresenca atual, para que a UI
      // de todo mundo mostre Online/Ausente/Não Perturbe corretamente.
      estado: this.estadosPresenca.get(nome)?.rotulo || 'Online',
    }));
    this.io.emit('lista_usuarios', usuarios);
  }

  /** Serializa grupos para envio ao cliente — filtra apenas os do usuário */
  _serializarGrupos(username) {
    return Array.from(this.grupos.values()).filter(
      (g) => g.membros.includes(username)
    );
  }

  /**
   * Entrega um pacote a um único destinatário, delegando ao EstadoPresenca
   * atual desse destinatário a decisão de COMO entregar — Padrão State.
   * É o mesmo pacote (mesma referência) para todos os destinatários; cada
   * estado decide independentemente, sem alterar o conteúdo da mensagem.
   * @param {string} nomeDestino
   * @param {Object} pacote
   * @returns {boolean} true se a entrega foi ao vivo (repassado do EstadoPresenca)
   */
  _entregarPara(nomeDestino, pacote) {
    const estado = this.estadosPresenca.get(nomeDestino) || new EstadoOffline();
    const socketId = this._socketIdDoUsuario(nomeDestino);
    return estado.entregarMensagem(pacote, {
      io: this.io,
      socketId,
      nomeDestino,
      agendarFallbackOffline: (p, dest) => this._agendarFallbackOffline(p, dest),
    });
  }

  /** Busca reversa: nome de usuário → socketId ativo (null se não conectado) */
  _socketIdDoUsuario(nome) {
    for (const [socketId, nomeConectado] of this.usuariosConectados.entries()) {
      if (nomeConectado === nome) return socketId;
    }
    return null;
  }

  /**
   * Entrega uma mensagem PRIVADO a um destinatário e, se a entrega foi ao
   * vivo (o EstadoPresenca dele confirmou), avança o EstadoMensagem dela
   * para ENTREGUE — o "check duplo cinza". Une os dois padrões State do
   * projeto: presença decide COMO entregar, e o resultado disso alimenta
   * o estado da própria mensagem.
   * @param {Object} pacote
   * @param {string} nomeDestino
   */
  _processarEntregaPrivada(pacote, nomeDestino) {
    const entregueAoVivo = this._entregarPara(nomeDestino, pacote);
    if (entregueAoVivo) {
      this._avancarEstadoMensagem(pacote, 'ENTREGUE');
    }
  }

  /**
   * Avança o EstadoMensagem de uma mensagem (Padrão State) e, se o rótulo
   * realmente mudou, avisa o remetente original (se conectado) para
   * atualizar o check na tela, além de persistir o novo status no Cassandra
   * (best-effort — não bloqueia o fluxo em tempo real).
   * @param {{id: string, remetente: string, destinatarios: string[], timestamp: string}} pacoteRef
   * @param {'ENTREGUE'|'LIDA'} novoRotulo
   */
  _avancarEstadoMensagem(pacoteRef, novoRotulo) {
    const { id, remetente, destinatarios, timestamp } = pacoteRef;
    const atual = this.estadosMensagem.get(id) || new EstadoEnviada();
    const novo = atual.avancarPara(novoRotulo);
    this.estadosMensagem.set(id, novo);

    if (novo.rotulo === atual.rotulo) return; // já estava lá, ou a transição foi bloqueada (sem regressão)

    console.log(`✓ [ServidorCentral] Mensagem "${id}": ${atual.rotulo} → ${novo.rotulo}`);

    const socketRemetente = this._socketIdDoUsuario(remetente);
    if (socketRemetente) {
      this.io.to(socketRemetente).emit('status_mensagem_atualizado', { id, status: novo.rotulo });
    }

    if (timestamp) {
      const conversaId = this.mensagemRepo.gerarConversaId('PRIVADO', remetente, destinatarios || []);
      this.mensagemRepo.atualizarStatus(conversaId, timestamp, id, novo.rotulo)
        .catch((err) => console.error('[ServidorCentral] Erro ao persistir status da mensagem:', err.message));
    }
  }

  /**
   * Fallback do EstadoOffline: a mensagem já foi persistida no Cassandra
   * (fila/buffer natural de "pendente") por quem chamou receberNotificacao().
   * Aqui apenas simulamos os gatilhos de reengajamento — este protótipo não
   * tem credenciais reais de Firebase Cloud Messaging nem de um servidor de
   * e-mail, então os dois disparos abaixo são só logs ilustrando o fluxo.
   * @param {Object} pacote
   * @param {string} nomeDestino
   */
  _agendarFallbackOffline(pacote, nomeDestino) {
    console.log(`📭 [ServidorCentral] "${nomeDestino}" está offline — mensagem de "${pacote.remetente}" enfileirada como pendente.`);
    console.log(`🔔 [Fallback Offline] (simulado) Push FCM disparado para "${nomeDestino}".`);

    const TEMPO_RESUMO_EMAIL_MS = 15 * 60 * 1000; // 15 minutos, conforme especificação
    setTimeout(() => {
      const continuaOffline = this.estadosPresenca.get(nomeDestino) instanceof EstadoOffline;
      if (continuaOffline) {
        console.log(`📧 [Fallback Offline] (simulado) E-mail-resumo enviado para "${nomeDestino}" — mensagem perdida de "${pacote.remetente}".`);
      }
    }, TEMPO_RESUMO_EMAIL_MS);
  }

  /**
   * Fábrica de EstadoPresenca a partir do rótulo escolhido pelo usuário na UI.
   * "Offline" é propositalmente omitido: só o evento 'disconnect' pode
   * atribuí-lo, já que ele representa a ausência de socket ativo.
   * @param {string} rotulo
   * @returns {import('./interfaces/EstadoPresenca')|null}
   */
  _criarEstadoPorRotulo(rotulo) {
    switch (rotulo) {
      case 'Online': return new EstadoOnline();
      case 'Ausente': return new EstadoAusente();
      case 'Não Perturbe': return new EstadoNaoPerturbe();
      default: return null;
    }
  }
}

module.exports = ServidorCentral;
