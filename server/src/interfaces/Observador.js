/**
 * Interface Observador - Padrão Observer
 * Define o contrato para receber notificações do CelularUsuario
 */
class Observador {
  /**
   * @param {Pacote} pacote - O pacote de mensagem recebido
   * @param {Socket} socket - Socket do remetente
   */
  receberNotificacao(pacote, socket) {
    throw new Error('[Observador] receberNotificacao() deve ser implementado pela subclasse');
  }
}

module.exports = Observador;
