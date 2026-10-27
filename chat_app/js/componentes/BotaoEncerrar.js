/** BotaoEncerrar — desliga (ou cancela, enquanto ainda está chamando). */
class BotaoEncerrar extends ComponenteMediado {
  constructor(mediador, elemento) {
    super(mediador);
    this.elemento = elemento;
    this.elemento.addEventListener('click', () => this.mediador.notificar(this, 'clicou'));
  }

  mostrar(visivel) {
    this.elemento.classList.toggle('hidden', !visivel);
  }
}
