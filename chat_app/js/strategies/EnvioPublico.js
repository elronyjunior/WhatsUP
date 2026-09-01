/**
 * EnvioPublico — Estratégia Concreta (Padrão Strategy)
 *
 * Empacota a mensagem como pública: visível a TODOS os usuários conectados.
 * O ServidorCentral fará broadcast ao receber um Pacote do tipo PUBLICO.
 */
class EnvioPublico extends EstrategiaEnvio {
  /**
   * @param {string} remetente - Nome do usuário remetente
   */
  constructor(remetente) {
    super();
    this.remetente = remetente;
  }

  /**
   * Empacota a mensagem com tipo PUBLICO e sem destinatários específicos.
   * @param {string} texto
   * @param {string[]} destinatarios - Ignorado nesta estratégia (todos recebem)
   * @param {string} contextoOrigem - Onde a mensagem está sendo enviada (padrão: 'geral')
   * @returns {Pacote}
   */
  empacotarMensagem(texto, destinatarios = [], contextoOrigem = 'geral') {
    return new Pacote({
      texto,
      remetente: this.remetente,
      destinatarios: [],   // público = sem restrição de destinatários
      tipo: 'PUBLICO',
      contextoOrigem,
    });
  }
}
