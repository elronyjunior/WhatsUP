/**
 * EstadoEnviada — Estado Concreto (Padrão State)
 *
 * O servidor recebeu a mensagem, mas o destinatário ainda não a recebeu
 * (ou não há confirmação disso). Um único check, cinza.
 */
class EstadoEnviada extends EstadoMensagem {
  renderizarCheck() {
    return `<svg class="msg-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  }

  get rotulo() {
    return 'ENVIADA';
  }
}
