const EstadoMensagem = require('../interfaces/EstadoMensagem');

/**
 * EstadoLida — Estado Concreto (Padrão State)
 *
 * O destinatário abriu a conversa e viu a mensagem — o "check azul". Estado
 * terminal: uma vez lida, a mensagem nunca regride para Entregue/Enviada.
 */
class EstadoLida extends EstadoMensagem {
  avancarPara(_rotulo) {
    return this; // terminal
  }

  get rotulo() {
    return 'LIDA';
  }
}

module.exports = EstadoLida;
