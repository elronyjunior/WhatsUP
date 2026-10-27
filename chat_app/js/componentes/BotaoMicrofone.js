/**
 * BotaoMicrofone — liga/desliga o próprio microfone durante a chamada.
 * Só guarda e mostra o estado "mutado"; quem de fato corta o áudio é a
 * ConexaoChamada, acionada pelo mediador.
 */
class BotaoMicrofone extends ComponenteMediado {
  constructor(mediador, elemento) {
    super(mediador);
    this.elemento = elemento;
    this.mutado = false;
    this.elemento.addEventListener('click', () => {
      this.mutado = !this.mutado;
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
    this.mutado = false;
    this._atualizarVisual();
  }

  _atualizarVisual() {
    this.elemento.classList.toggle('desligado', this.mutado);
    this.elemento.title = this.mutado ? 'Ativar microfone' : 'Silenciar microfone';
  }
}
