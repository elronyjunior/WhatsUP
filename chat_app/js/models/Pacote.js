/**
 * Modelo Pacote — Objeto de dados transportado entre CelularUsuario e ServidorCentral
 */
class Pacote {
  /**
   * @param {string} texto
   * @param {string} remetente
   * @param {string[]} destinatarios
   * @param {'PUBLICO'|'PRIVADO'} tipo
   */
  constructor({ texto, remetente, destinatarios = [], tipo = 'PUBLICO' }) {
    this.id = crypto.randomUUID();
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
