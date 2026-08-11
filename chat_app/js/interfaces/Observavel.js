/**
 * Interface Observavel — Padrão Observer (lado cliente)
 *
 * Qualquer entidade que queira notificar o ServidorCentral
 * deve implementar notificarServidor().
 */
class Observavel {
  /**
   * Notifica o servidor com um pacote de mensagem.
   * @param {Pacote} pacote
   */
  notificarServidor(pacote) {
    throw new Error('[Observavel] notificarServidor() deve ser implementado');
  }
}
