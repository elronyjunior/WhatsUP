/** RotuloStatusLigacao — texto de status ("Chamando…", "Em andamento"...). */
class RotuloStatusLigacao extends ComponenteMediado {
  constructor(mediador, elemento) {
    super(mediador);
    this.elemento = elemento;
  }

  exibir(texto) {
    this.elemento.textContent = texto;
  }
}
