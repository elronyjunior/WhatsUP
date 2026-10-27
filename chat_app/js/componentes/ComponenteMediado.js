/**
 * ComponenteMediado — Componente base do Padrão Mediator
 *
 * Todo componente guarda uma referência APENAS ao seu mediador (nunca aos
 * outros componentes). Quando algo acontece com ele, chama
 * this.mediador.notificar(this, evento) e deixa o mediador decidir o resto.
 */
class ComponenteMediado {
  /** @param {Mediador} mediador */
  constructor(mediador) {
    this.mediador = mediador;
  }
}
