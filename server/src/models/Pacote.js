const { v4: uuidv4 } = require('uuid');

/**
 * Modelo Pacote - Objeto de dados que trafega entre CelularUsuario e ServidorCentral
 */
class Pacote {
  constructor({
    texto,
    remetente,
    destinatarios = [],
    tipo = 'PUBLICO',
    modoExceto = false,
    contextoOrigem = 'geral',  // 'geral', 'grupo_xxx', ou nomeUsuario (privado)
    status = 'ENVIADA'
  }) {
    this.id = uuidv4();
    this.texto = texto;
    this.remetente = remetente;
    this.destinatarios = destinatarios;
    this.tipo = tipo;
    this.modoExceto = modoExceto; // Para mensagens SECRETO: indica "todos exceto"
    this.contextoOrigem = contextoOrigem; // Rastreia onde a mensagem foi enviada
    this.timestamp = new Date().toISOString();
    // Padrão State (EstadoMensagem) — só é relevante para mensagens PRIVADO;
    // avança ENVIADA → ENTREGUE → LIDA conforme ServidorCentral._avancarEstadoMensagem().
    this.status = status;
  }

  toJSON() {
    return {
      id: this.id,
      texto: this.texto,
      remetente: this.remetente,
      destinatarios: this.destinatarios,
      tipo: this.tipo,
      contextoOrigem: this.contextoOrigem,
      timestamp: this.timestamp,
      status: this.status,
    };
  }
}

module.exports = Pacote;
