/**
 * Interface Iterador — Padrão Iterator
 *
 * Define o contrato que todo iterador concreto implementa. Esconde da
 * interface (UI) como a coleção percorrida está estruturada — se é um
 * array em memória, mensagens espalhadas entre memória/banco local, ou
 * fragmentadas por dia — a UI só chama next()/previous(), sem saber de
 * onde vêm os itens.
 */
class Iterador {
  /** Existe um próximo item a partir da posição atual? */
  hasNext() {
    throw new Error('[Iterador] hasNext() deve ser implementado');
  }

  /** Avança para o próximo item e o retorna */
  next() {
    throw new Error('[Iterador] next() deve ser implementado');
  }

  /** Existe um item anterior a partir da posição atual? */
  hasPrevious() {
    throw new Error('[Iterador] hasPrevious() deve ser implementado');
  }

  /** Volta para o item anterior e o retorna */
  previous() {
    throw new Error('[Iterador] previous() deve ser implementado');
  }

  /** Retorna o item na posição atual, sem mover o cursor */
  atual() {
    throw new Error('[Iterador] atual() deve ser implementado');
  }
}
