/** BotaoCamera — liga/desliga a própria câmera numa chamada de vídeo. */
class BotaoCamera extends ComponenteMediado {
  constructor(mediador, elemento) {
    super(mediador);
    this.elemento = elemento;
    this.ligada = true;
    this.elemento.addEventListener('click', () => {
      this.ligada = !this.ligada;
      this._atualizarVisual();
      this.mediador.notificar(this, 'clicou');
    });
  }

  habilitar(ativo) {
    this.elemento.disabled = !ativo;
  }

  mostrar(visivel) {
    this.elemento.classList.toggle('hidden', !visivel);
  }

  zerar() {
    this.ligada = true;
    this._atualizarVisual();
  }

  _atualizarVisual() {
    this.elemento.classList.toggle('desligado', !this.ligada);
    this.elemento.title = this.ligada ? 'Desligar câmera' : 'Ligar câmera';
  }
}
