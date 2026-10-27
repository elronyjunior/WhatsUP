/**
 * ToqueChamada — som de chamada sintetizado via Web Audio API (sem arquivo
 * externo, igual ao "plim" de notificação). 'saida' é o "tuuu… tuuu" de
 * quem liga; 'entrada' é o toque mais agudo de quem recebe.
 */
class ToqueChamada extends ComponenteMediado {
  constructor(mediador) {
    super(mediador);
    this._ctx = null;
    this._intervalo = null;
  }

  tocar(tipo) {
    this.parar();
    const bipe = () => (tipo === 'entrada' ? this._bipeEntrada() : this._bipeSaida());
    bipe();
    this._intervalo = setInterval(bipe, tipo === 'entrada' ? 2000 : 3000);
  }

  parar() {
    clearInterval(this._intervalo);
    this._intervalo = null;
  }

  _bipeSaida() {
    this._som(425, 0, 1.0);
  }

  _bipeEntrada() {
    this._som(880, 0, 0.25);
    this._som(660, 0.3, 0.25);
  }

  _som(frequencia, atraso, duracao) {
    try {
      this._ctx = this._ctx || new (window.AudioContext || window.webkitAudioContext)();
      const inicio = this._ctx.currentTime + atraso;
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencia, inicio);
      gain.gain.setValueAtTime(0.12, inicio);
      gain.gain.setValueAtTime(0.12, inicio + duracao - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
      osc.connect(gain).connect(this._ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + duracao);
    } catch (err) {
      console.warn('[Ligação] Não foi possível tocar o toque de chamada:', err.message);
    }
  }
}
