/**
 * CelularUsuario — Implementa Observavel (Padrão Observer)
 *                  Usa EstrategiaEnvio    (Padrão Strategy)
 *                  Usa EstadoPresenca     (Padrão State)
 *
 * Representa o dispositivo/cliente do usuário no chat.
 * Compõe uma estratégia de envio que pode ser trocada em tempo de execução,
 * e notifica o ServidorCentral (Observador) via Socket.IO. Também mantém o
 * estado de presença atual (Online/Não Perturbe/Ausente), que decide como
 * reagir a uma mensagem recebida — sem esse CelularUsuario precisar saber
 * os detalhes de cada reação.
 */
class CelularUsuario extends Observavel {
  /**
   * @param {string} nome - Nome do usuário
   * @param {import('socket.io-client').Socket} socket - Conexão com o ServidorCentral
   */
  constructor(nome, socket) {
    super();
    this.nome = nome;
    this.socket = socket; // Referência ao Observador (ServidorCentral)

    // Estratégia padrão: envio público
    this._estrategiaPrivacidade = new EnvioPublico(nome);

    // Estado padrão: Online (Padrão State)
    this._estadoPresenca = new EstadoOnline();

    // Ganchos de efeitos de UI (som, notificação nativa, toast...),
    // atribuídos pelo app.js para manter este núcleo livre de DOM —
    // os estados concretos chamam contexto.ganchosUI.<algo>?.(...).
    this.ganchosUI = null;
  }

  /**
   * mudarEstrategia() — troca a EstrategiaEnvio em tempo de execução
   * Permite alternar entre EnvioPublico e EnvioPrivado dinamicamente.
   *
   * @param {EstrategiaEnvio} novaEstrategia
   */
  mudarEstrategia(novaEstrategia) {
    this._estrategiaPrivacidade = novaEstrategia;
    console.log(
      `[CelularUsuario] Estratégia alterada para: ${novaEstrategia.constructor.name}`
    );
  }

  /**
   * escreverMensagem() — ponto de entrada para envio de mensagens
   *
   * 1. Delega para a estratégia atual o empacotamento da mensagem
   * 2. Chama notificarServidor() para transmitir ao ServidorCentral
   *
   * @param {string} texto - Conteúdo da mensagem
   * @param {string[]} destinatarios - Lista de destinatários (usado em EnvioPrivado)
   * @param {string} contextoOrigem - Onde a mensagem está sendo enviada ('geral', 'grupo_xxx', ou nome do usuário)
   */
  escreverMensagem(texto, destinatarios = [], contextoOrigem = 'geral') {
    if (!texto || texto.trim() === '') return;

    // Padrão Strategy: delega o empacotamento à estratégia ativa
    const pacote = this._estrategiaPrivacidade.empacotarMensagem(
      texto.trim(),
      destinatarios,
      contextoOrigem
    );

    // Padrão Observer: notifica o servidor com o pacote gerado
    this.notificarServidor(pacote);
  }

  /**
   * notificarServidor() — implementação de Observavel
   * Envia o pacote ao ServidorCentral (Observador) via WebSocket.
   *
   * @param {Pacote} pacote
   */
  notificarServidor(pacote) {
    console.log(
      `[CelularUsuario] Notificando servidor — Tipo: ${pacote.tipo}`,
      pacote.toJSON()
    );
    this.socket.emit('notificar_servidor', pacote.toJSON());
  }

  /** Retorna o nome da estratégia atual */
  getEstrategiaAtual() {
    return this._estrategiaPrivacidade.constructor.name;
  }

  /**
   * mudarEstadoPresenca() — troca o EstadoPresenca em tempo de execução.
   * Chamado tanto por transições internas (o próprio estado decide expirar,
   * ex.: Online → Ausente por inatividade) quanto externas (o usuário
   * escolhe um status no menu da interface).
   *
   * @param {EstadoPresenca} novoEstado
   */
  mudarEstadoPresenca(novoEstado) {
    const anterior = this._estadoPresenca.rotulo;
    this._estadoPresenca = novoEstado;
    console.log(`[CelularUsuario] Estado de presença: ${anterior} → ${novoEstado.rotulo}`);

    // Avisa o ServidorCentral, que também mantém um EstadoPresenca (do lado
    // dele) para decidir como rotear mensagens futuras até este usuário.
    this.socket.emit('mudar_estado_presenca', novoEstado.rotulo);
  }

  /** Retorna o EstadoPresenca atual */
  getEstadoPresenca() {
    return this._estadoPresenca;
  }

  /**
   * receberMensagem() — ponto de entrada do Padrão State.
   * Delega ao estado de presença atual a decisão de como reagir (som,
   * toast, notificação nativa, auto-resposta...).
   *
   * @param {Object} pacote - Pacote de mensagem recebido
   * @param {string} [chaveConversa] - Chave local da conversa correspondente
   */
  receberMensagem(pacote, chaveConversa) {
    this._estadoPresenca.aoReceberMensagem(pacote, this, chaveConversa);
  }
}
