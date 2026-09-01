/**
 * Interface EstadoPresenca — Padrão State (lado servidor)
 *
 * O servidor não conhece o teclado nem a tela do usuário — mas precisa
 * decidir COMO um pacote chega até ele: entrega imediata via WebSocket ou
 * enfileiramento com fallback, conforme o estado de presença que o próprio
 * servidor mantém para cada usuário (Online, Não Perturbe, Ausente ou
 * Offline). Cada estado concreto implementa entregarMensagem().
 */
class EstadoPresenca {
  /**
   * Decide como entregar um pacote a um destinatário específico.
   * @param {Object} pacote - Pacote de mensagem (instância de Pacote ou objeto simples)
   * @param {Object} contexto
   * @param {import('socket.io').Server} contexto.io
   * @param {string|null} contexto.socketId - socket do destinatário, se conectado
   * @param {string} contexto.nomeDestino
   * @param {(pacote: Object, nomeDestino: string) => void} contexto.agendarFallbackOffline
   * @returns {boolean} true se a entrega ao vivo aconteceu (usado pelo Padrão
   *   State de EstadoMensagem para avançar ENVIADA → ENTREGUE)
   */
  entregarMensagem(pacote, contexto) {
    throw new Error('[EstadoPresenca] entregarMensagem() deve ser implementado pela subclasse');
  }

  /** Rótulo de exibição (deve bater com o rótulo usado pelo EstadoPresenca do cliente) */
  get rotulo() {
    throw new Error('[EstadoPresenca] rotulo deve ser implementado pela subclasse');
  }
}

module.exports = EstadoPresenca;
