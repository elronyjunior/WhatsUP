/**
 * BotaoIniciarLigacao — botão do header da conversa (📞 voz / 🎥 vídeo).
 * Não sabe com quem nem como ligar: só avisa a TelaLigacao que foi clicado.
 */
class BotaoIniciarLigacao extends ComponenteMediado {
  /**
   * @param {Mediador} mediador
   * @param {HTMLButtonElement} elemento
   * @param {'voz'|'video'} tipo
   */
  constructor(mediador, elemento, tipo) {
    super(mediador);
    this.elemento = elemento;
    this.tipo = tipo;
    this.elemento.addEventListener('click', () => this.mediador.notificar(this, 'clicou'));
  }

  mostrar(visivel) {
    this.elemento.classList.toggle('hidden', !visivel);
  }
}
