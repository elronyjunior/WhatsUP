/**
 * Interface EstadoMensagem — Padrão State (mensagem, lado servidor)
 *
 * Modela o ciclo de vida de uma mensagem PRIVADO: Enviada → Entregue → Lida
 * (o famoso "check azul"). Cada estado concreto decide para quais estados
 * é válido avançar — assim a regra "leitura nunca regride" fica encapsulada
 * no próprio EstadoLida, em vez de virar um `if` espalhado pelo servidor.
 */
class EstadoMensagem {
  /**
   * @param {'ENTREGUE'|'LIDA'} rotulo - próximo estado desejado
   * @returns {EstadoMensagem} o novo estado (ou `this` se a transição não for válida)
   */
  avancarPara(rotulo) {
    throw new Error('[EstadoMensagem] avancarPara() deve ser implementado pela subclasse');
  }

  /** Rótulo persistido no Cassandra e enviado ao cliente (ex.: "ENVIADA") */
  get rotulo() {
    throw new Error('[EstadoMensagem] rotulo deve ser implementado pela subclasse');
  }
}

module.exports = EstadoMensagem;
