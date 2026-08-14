const { v4: uuidv4 } = require('uuid');

/**
 * Modelo Pacote - Objeto de dados que trafega entre CelularUsuario e ServidorCentral
 */
class Pacote {
  constructor({
    texto,
    remetente,
    destinatarios = [],
    tipo = 'PUBLICO'
  }) {
    this.id = uuidv4();
    this.texto = texto;
    this.remetente = remetente;
    this.destinatarios = destinatarios;
    this.tipo = tipo;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      texto: this.texto,
      remetente: this.remetente,
      destinatarios: this.destinatarios,
      tipo: this.tipo,
      timestamp: this.timestamp,
    };
  }
}

module.exports = Pacote;
