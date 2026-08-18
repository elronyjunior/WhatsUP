const Observador = require('./interfaces/Observador');
const Pacote = require('./models/Pacote');

/**
 * ServidorCentral - Implementa Observador (Padrão Observer)
 *
 * Responsabilidades:
 *  - Receber notificações dos CelularUsuario via Socket.IO
 *  - Rotear mensagens conforme o tipo do Pacote (PUBLICO, PRIVADO, GRUPO)
 *  - Manter lista de usuários conectados
 *  - Gerenciar grupos criados pelos usuários
 *  - Persistir mensagens e grupos no Cassandra
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
            texto: `🔐 [Mensagem Secreta do Servidor] Olá, ${nome}! Bem-vindo ao ChatApp. Este sistema usa os padrões Observer + Strategy. Suas mensagens privadas são entregues com EnvioPrivado e nunca passam por outros usuários. Bom chat! 🎉`,
            remetente: '🤖 ServidorCentral',
            destinatarios: [nome],
            tipo: 'SISTEMA_SECRETO',
          });
          socket.emit('mensagem_secreta_geral', msgSecreta.toJSON());
        }, 800);
      });

      /**
       * Evento principal: CelularUsuario chama notificarServidor(pacote)
       */
      socket.on('notificar_servidor', async (dadosPacote) => {
        const pacote = new Pacote(dadosPacote);
        console.log(
          `📦 [ServidorCentral] Pacote recebido de "${pacote.remetente}" — Tipo: ${pacote.tipo}`
        );

        // Se for SECRETO com modoExceto, resolve a lista final de receptores
        if (pacote.tipo === 'SECRETO' && dadosPacote.modoExceto) {
          const todosOnline = Array.from(this.usuariosConectados.values());
          // Exclusivo: todos online exceto os selecionados (e exceto o próprio remetente)
          const receptoresFinais = todosOnline.filter(
            (nome) => !pacote.destinatarios.includes(nome) && nome !== pacote.remetente
          );
          pacote.destinatarios = receptoresFinais;
          console.log(`🔐 [ServidorCentral] SECRETO (modo EXCETO) — receptores finais: [${receptoresFinais.join(', ')}]`);
        }

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

      /**
       * Mensagem Secreta Custom — Painel de seleção de destinatários
       * Recebe: { texto, remetente, destinatarios[], modoExceto, conversaId }
       *  - modoExceto=false → só os selecionados recebem (inclusivo)
       *  - modoExceto=true  → todos EXCETO os selecionados recebem (exclusivo)
       * O remetente sempre recebe (para ver no próprio histórico).
       */
      socket.on('mensagem_secreta_custom', async (dados) => {
        const { texto, remetente, destinatarios = [], modoExceto = false, conversaId, contextoOrigem = 'geral' } = dados;
        const todosOnline = Array.from(this.usuariosConectados.values());

        // Resolve lista final de quem recebe (excluindo sempre o remetente — ele já recebe separado)
        let receptores;
        if (modoExceto) {
          // Exclusivo: todos online exceto os selecionados (e exceto o próprio remetente)
          receptores = todosOnline.filter(
            (nome) => !destinatarios.includes(nome) && nome !== remetente
          );
        } else {
          // Inclusivo: só os selecionados (excluindo o remetente da lista — ele recebe separado)
          receptores = destinatarios.filter((nome) => nome !== remetente);
        }

        const pacote = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          texto,
          remetente,
          destinatarios: receptores,
          tipo: 'SECRETO',
          modoExceto,
          contextoOrigem,
          timestamp: new Date().toISOString(),
        };

        console.log(
          `🔐 [ServidorCentral] Mensagem SECRETA CUSTOM de "${remetente}" — modo: ${modoExceto ? 'EXCETO' : 'INCLUSIVO'} — receptores: [${receptores.join(', ')}] — contexto: ${contextoOrigem}`
        );

        // Envia para o remetente (sempre vê a própria mensagem)
        socket.emit('mensagem_recebida', pacote);

        // Envia para os receptores resolvidos
        this.usuariosConectados.forEach((nome, socketId) => {
          if (receptores.includes(nome)) {
            this.io.to(socketId).emit('mensagem_recebida', pacote);
          }
        });

        // Persistir no Cassandra
        try {
          const idConversa = conversaId || 'geral';
          await this.mensagemRepo.salvarMensagem(pacote, idConversa);
        } catch (err) {
          console.error('[ServidorCentral] Erro ao salvar mensagem secreta custom:', err.message);
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
          // Entrega só para mencionados + remetente (que sejam membros do grupo)
          this.usuariosConectados.forEach((nome, socketId) => {
            if (grupo.membros.includes(nome) && (mencoes.includes(nome) || nome === dadosPacote.remetente)) {
              this.io.to(socketId).emit('mensagem_recebida', pacote);
            }
          });
        } else {
          console.log(`👥 [ServidorCentral] Mensagem de grupo "${grupo.nome}" de "${dadosPacote.remetente}"`);
          // Entrega só para membros do grupo
          this.usuariosConectados.forEach((nome, socketId) => {
            if (grupo.membros.includes(nome)) {
              this.io.to(socketId).emit('mensagem_recebida', pacote);
            }
          });
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
   * SECRETO  → entrega para destinatários selecionados (não para quem fica de fora), exceto se for privado
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
        this.usuariosConectados.forEach((nome, socketId) => {
          if (mencoes.includes(nome) && socketId !== socketRemetente.id) {
            this.io.to(socketId).emit('mensagem_recebida', pacoteSecreto);
          }
        });
      } else {
        console.log(`📢 [ServidorCentral] Roteando PÚBLICO → broadcast global`);
        this.io.emit('mensagem_recebida', pacote.toJSON());
      }

    } else if (pacote.tipo === 'PRIVADO') {
      console.log(
        `🔒 [ServidorCentral] Roteando PRIVADO → destinatários: [${pacote.destinatarios.join(', ')}]`
      );
      socketRemetente.emit('mensagem_recebida', pacote.toJSON());
      this.usuariosConectados.forEach((nome, socketId) => {
        if (pacote.destinatarios.includes(nome) && socketId !== socketRemetente.id) {
          this.io.to(socketId).emit('mensagem_recebida', pacote.toJSON());
        }
      });

    } else if (pacote.tipo === 'SECRETO') {
      // Mensagem secreta: entrega para os destinatários explicitamente selecionados + remetente
      // A pessoa que "fica de fora" não recebe (está em destinatarios quem RECEBE, não quem NÃO recebe)
      console.log(
        `🔐 [ServidorCentral] Roteando SECRETO → receptores: [${pacote.destinatarios.join(', ')}]`
      );
      socketRemetente.emit('mensagem_recebida', pacote.toJSON());
      this.usuariosConectados.forEach((nome, socketId) => {
        if (pacote.destinatarios.includes(nome) && socketId !== socketRemetente.id) {
          this.io.to(socketId).emit('mensagem_recebida', pacote.toJSON());
        }
      });
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
    }));
    this.io.emit('lista_usuarios', usuarios);
  }

  /** Serializa grupos para envio ao cliente — filtra apenas os do usuário */
  _serializarGrupos(username) {
    return Array.from(this.grupos.values()).filter(
      (g) => g.membros.includes(username)
    );
  }
}

module.exports = ServidorCentral;
