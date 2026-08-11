/**
 * EnvioPrivado — Estratégia Concreta (Padrão Strategy)
 *
 * Empacota a mensagem como privada: visível SOMENTE aos destinatários listados.
 * O ServidorCentral entregará o Pacote apenas aos sockets dos destinatários.
 */
class EnvioPrivado extends EstrategiaEnvio {
  /**
   * @param {string} remetente - Nome do usuário remetente
   */
  constructor(remetente) {
    super();
    this.remetente = remetente;
  }

  /**
   * Empacota a mensagem com tipo PRIVADO e lista de destinatários restrita.
   * @param {string} texto
   * @param {string[]} destinatarios - Nomes dos usuários que podem ver a mensagem
   * @returns {Pacote}
   */
  empacotarMensagem(texto, destinatarios = []) {
    if (destinatarios.length === 0) {
      throw new Error('[EnvioPrivado] Selecione ao menos um destinatário para mensagem privada.');
    }
    return new Pacote({
      texto,
      remetente: this.remetente,
      destinatarios,
      tipo: 'PRIVADO',
    });
  }
}
