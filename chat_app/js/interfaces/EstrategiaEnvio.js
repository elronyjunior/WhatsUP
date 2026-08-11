/**
 * Interface EstrategiaEnvio — Padrão Strategy
 *
 * Define o contrato para empacotar mensagens antes de enviar ao servidor.
 * As implementações concretas são: EnvioPublico e EnvioPrivado.
 */
class EstrategiaEnvio {
  /**
   * Empacota a mensagem em um Pacote pronto para transmissão.
   * @param {string} texto - Conteúdo da mensagem
   * @param {string[]} destinatarios - Lista de nomes dos destinatários
   * @returns {Pacote}
   */
  empacotarMensagem(texto, destinatarios) {
    throw new Error('[EstrategiaEnvio] empacotarMensagem() deve ser implementado');
  }
}
