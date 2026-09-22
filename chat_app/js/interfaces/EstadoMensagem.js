
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
