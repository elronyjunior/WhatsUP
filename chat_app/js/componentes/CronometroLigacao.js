/** CronometroLigacao — mostra o tempo de chamada (mm:ss) depois que conecta. */
class CronometroLigacao extends ComponenteMediado {
  constructor(mediador, elemento) {
    super(mediador);
    this.elemento = elemento;
    this.inicio = null;
    this._intervalo = null;
  }

  iniciar() {
    this.inicio = Date.now();
    this.elemento.classList.remove('hidden');
    this._renderizar();
    this._intervalo = setInterval(() => this._renderizar(), 1000);
  }

  /** Para o cronômetro e devolve a duração em segundos (0 se nunca começou) */
  parar() {
    clearInterval(this._intervalo);
    this._intervalo = null;
    const duracao = this.inicio ? Math.round((Date.now() - this.inicio) / 1000) : 0;
    this.inicio = null;
    return duracao;
  }

  zerar() {
    this.parar();
    this.elemento.textContent = '00:00';
    this.elemento.classList.add('hidden');
  }

  _renderizar() {
    const segundos = Math.floor((Date.now() - this.inicio) / 1000);
    this.elemento.textContent = CronometroLigacao.formatar(segundos);
  }

  static formatar(segundos) {
    const mm = String(Math.floor(segundos / 60)).padStart(2, '0');
    const ss = String(segundos % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }
}
