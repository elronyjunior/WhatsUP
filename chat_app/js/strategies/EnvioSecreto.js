/**
 * EnvioSecreto — Estratégia Concreta (Padrão Strategy)
 *
 * Empacota a mensagem como secreta com destinatários explícitos.
 * Diferente do Privado, a mensagem secreta é uma CATEGORIA de envio:
 *  - Pode ser enviada em qualquer contexto (geral, grupo, privado)
 *  - Apenas os destinatários selecionados recebem
 *  - A pessoa que "fica de fora" não recebe a mensagem (não está na lista de destinatários)
 *
 * Suporta dois modos:
 *  - Inclusivo (modoExceto=false): só os destinatarios[] recebem
 *  - Exclusivo (modoExceto=true):  todos EXCETO os destinatarios[] recebem
 *
 * O ServidorCentral entrega apenas para a lista final de receptores resolvida.
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
      throw new Error('[EnvioSecreto] Selecione ao menos um destinatário para mensagem secreta inclusiva.');
    }
    return new Pacote({
      texto,
      remetente: this.remetente,
      destinatarios,
      tipo: 'SECRETO',
      // modoExceto é enviado junto para o servidor resolver a lista final (modo "todos exceto")
      modoExceto: this.modoExceto,
    });
  }
}
