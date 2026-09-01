/**
 * Interface EstadoMensagem — Padrão State (mensagem, lado cliente)
 *
 * O cliente nunca DECIDE uma transição de EstadoMensagem — quem decide é o
 * servidor, que é quem sabe se o destinatário está online, se entregou ou
 * se leu (evento `status_mensagem_atualizado`). Aqui cada estado concreto
 * só sabe desenhar o check correspondente (✓ cinza, ✓✓ cinza, ✓✓ azul),
 * substituindo o if/else que existiria em renderizarMensagem().
 */
class EstadoMensagem {
  /** @returns {string} HTML do ícone de check correspondente a este estado */
  renderizarCheck() {
    throw new Error('[EstadoMensagem] renderizarCheck() deve ser implementado');
  }

  /** Rótulo recebido do servidor (ex.: "ENVIADA", "ENTREGUE", "LIDA") */
  get rotulo() {
    throw new Error('[EstadoMensagem] rotulo deve ser implementado');
  }
}
