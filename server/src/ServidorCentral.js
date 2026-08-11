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
 */
class ServidorCentral extends Observador {
  /**
   * @param {import('socket.io').Server} io - Instância do Socket.IO Server
   */
  constructor(io) {
    super();
    this.io = io;
    // Map<socketId, nome> — registro de usuários conectados
    this.usuariosConectados = new Map();
    // Map<grupoId, { nome, membros: string[], criador: string }> — grupos
    this.grupos = new Map();
    this._configurarEventos();
    console.log('✅ [ServidorCentral] Inicializado — aguardando conexões de CelularUsuario...');
  }

  /** Configura todos os eventos Socket.IO */
  _configurarEventos() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 [ServidorCentral] Conexão estabelecida: ${socket.id}`);

      // Registro de usuário ao entrar no chat
      socket.on('registrar_usuario', (nome) => {
        this.usuariosConectados.set(socket.id, nome);
        console.log(`👤 [ServidorCentral] Usuário registrado: "${nome}" (${socket.id})`);
        this._transmitirListaUsuarios();

        // Envia lista de grupos existentes para o novo usuário
        socket.emit('lista_grupos', this._serializarGrupos());

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
      socket.on('notificar_servidor', (dadosPacote) => {
        const pacote = new Pacote(dadosPacote);
        console.log(
          `📦 [ServidorCentral] Pacote recebido de "${pacote.remetente}" — Tipo: ${pacote.tipo}`
        );
        this.receberNotificacao(pacote, socket);
      });

      // Criar grupo
      socket.on('criar_grupo', ({ nome, membros }) => {
        const remetente = this.usuariosConectados.get(socket.id);
        if (!remetente) return;

        const grupoId = `grupo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const todosMembros = [...new Set([remetente, ...membros])];

        this.grupos.set(grupoId, {
          id: grupoId,
          nome,
          membros: todosMembros,
          criador: remetente,
          criadoEm: new Date().toISOString(),
        });

        console.log(`👥 [ServidorCentral] Grupo criado: "${nome}" — Membros: [${todosMembros.join(', ')}]`);

        // Notifica todos os membros do novo grupo
        const grupoInfo = this.grupos.get(grupoId);
        this.usuariosConectados.forEach((nomeMembro, socketId) => {
          if (todosMembros.includes(nomeMembro)) {
            this.io.to(socketId).emit('grupo_criado', grupoInfo);
          }
        });
      });

      // Mensagem de grupo
      socket.on('mensagem_grupo', (dadosPacote) => {
        const grupo = this.grupos.get(dadosPacote.grupoId);
        if (!grupo) return;

        const pacote = {
          ...dadosPacote,
          tipo: 'GRUPO',
          timestamp: new Date().toISOString(),
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        };

        console.log(`👥 [ServidorCentral] Mensagem de grupo "${grupo.nome}" de "${dadosPacote.remetente}"`);

        // Entrega só para membros do grupo
        this.usuariosConectados.forEach((nome, socketId) => {
          if (grupo.membros.includes(nome)) {
            this.io.to(socketId).emit('mensagem_recebida', pacote);
          }
        });
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
   */
  _rotearMensagem(pacote, socketRemetente) {
    if (pacote.tipo === 'PUBLICO') {
      console.log(`📢 [ServidorCentral] Roteando PÚBLICO → broadcast global`);
      this.io.emit('mensagem_recebida', pacote.toJSON());
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
    }
  }

  /** Emite a lista atualizada de usuários conectados para todos */
  _transmitirListaUsuarios() {
    const usuarios = Array.from(this.usuariosConectados.entries()).map(([socketId, nome]) => ({
      socketId,
      nome,
    }));
    this.io.emit('lista_usuarios', usuarios);
  }

  /** Serializa grupos para envio ao cliente */
  _serializarGrupos() {
    return Array.from(this.grupos.values());
  }
}

module.exports = ServidorCentral;
