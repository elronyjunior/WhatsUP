/**
 * EstadoEntregue — Estado Concreto (Padrão State)
 *
 * O destinatário recebeu a mensagem (entrega ao vivo confirmada, ou ele
 * carregou o histórico ao reconectar). Check duplo, cinza.
 */
class EstadoEntregue extends EstadoMensagem {
  renderizarCheck() {
    return `<svg class="msg-check msg-check-duplo" width="18" height="14" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 6 7 17 2 12"/><polyline points="24 6 13 17 8 12"/></svg>`;
  }

  get rotulo() {
    return 'ENTREGUE';
  }
}
