/**
 * EnvioSecreto — Estratégia Concreta (Padrão Strategy)
 *
 * Empacota a mensagem como secreta com destinatários explícitos.
 * Suporta dois modos:
 *  - Inclusivo (modoExceto=false): só os destinatarios[] recebem
 *  - Exclusivo (modoExceto=true):  todos EXCETO os destinatarios[] recebem
 *
 * O ServidorCentral resolve a lista final via evento 'mensagem_secreta_custom'.
 */
class EnvioSecreto extends EstrategiaEnvio {
  /**
   * @param {string} remetente - Nome do usuário remetente
   * @param {boolean} modoExceto - true = "todos exceto os selecionados"
   */
  constructor(remetente, modoExceto = false) {
    super();
    this.remetente = remetente;
    this.modoExceto = modoExceto;
  }

  /**
   * Empacota a mensagem com tipo SECRETO e os metadados de roteamento.
   * @param {string} texto
   * @param {string[]} destinatarios - Nomes selecionados no painel
   * @returns {Pacote}
   */
  empacotarMensagem(texto, destinatarios = []) {
    if (destinatarios.length === 0 && !this.modoExceto) {
      throw new Error('[EnvioSecreto] Selecione ao menos um destinatário para mensagem secreta.');
    }
    return new Pacote({
      texto,
      remetente: this.remetente,
      destinatarios,
      tipo: 'SECRETO',
      // modoExceto é enviado junto para o servidor resolver a lista final
      modoExceto: this.modoExceto,
    });
  }
}
