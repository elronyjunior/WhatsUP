const Observador = require('./interfaces/Observador');
const Pacote = require('./models/Pacote');

/**
 * ServidorCentral - Implementa Observador (Padrão Observer)
 *
 * Responsabilidades:
 *  - Receber notificações dos CelularUsuario via Socket.IO
 *  - Rotear mensagens conforme o tipo do Pacote (PUBLICO ou PRIVADO)
 *  - Manter lista de usuários conectados
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
        // Notifica demais usuários
        socket.broadcast.emit('sistema_mensagem', {
          texto: `${nome} entrou no chat`,
          tipo: 'ENTRADA',
          timestamp: new Date().toISOString(),
        });
      });

      /**
       * Evento principal: CelularUsuario chama notificarServidor(pacote)
       * O servidor recebe como 'notificar_servidor' e chama receberNotificacao()
       */
      socket.on('notificar_servidor', (dadosPacote) => {
        const pacote = new Pacote(dadosPacote);
        console.log(
          `📦 [ServidorCentral] Pacote recebido de "${pacote.remetente}" — Tipo: ${pacote.tipo}`
        );
        this.receberNotificacao(pacote, socket);
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
   * Ponto de entrada para todas as mensagens dos clientes
   *
   * @param {Pacote} pacote
   * @param {import('socket.io').Socket} socketRemetente
   */
  receberNotificacao(pacote, socketRemetente) {
    this._rotearMensagem(pacote, socketRemetente);
  }

  /**
   * Método privado — roteia o pacote conforme a estratégia aplicada pelo CelularUsuario
   *
   * PUBLICO  → broadcast para todos os usuários conectados
   * PRIVADO  → entrega somente para os destinatários listados no pacote
   *
   * @param {Pacote} pacote
   * @param {import('socket.io').Socket} socketRemetente
   */
  _rotearMensagem(pacote, socketRemetente) {
    if (pacote.tipo === 'PUBLICO') {
      console.log(`📢 [ServidorCentral] Roteando PÚBLICO → broadcast global`);
      this.io.emit('mensagem_recebida', pacote.toJSON());
    } else if (pacote.tipo === 'PRIVADO') {
      console.log(
        `🔒 [ServidorCentral] Roteando PRIVADO → destinatários: [${pacote.destinatarios.join(', ')}]`
      );
      // Envia confirmação ao remetente
      socketRemetente.emit('mensagem_recebida', pacote.toJSON());
      // Entrega a cada destinatário
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
}

module.exports = ServidorCentral;
