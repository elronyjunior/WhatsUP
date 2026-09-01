const EstadoMensagem = require('../interfaces/EstadoMensagem');
const EstadoEntregue = require('./EstadoEntregue');
const EstadoLida = require('./EstadoLida');

/**
 * EstadoEnviada — Estado Concreto (Padrão State)
 *
 * Estado inicial de toda mensagem PRIVADO: o servidor recebeu e persistiu
 * o pacote, mas ainda não confirmou que o destinatário a recebeu. Permite
 * avançar tanto para Entregue quanto direto para Lida (ex.: o destinatário
 * abriu a conversa antes de qualquer confirmação intermediária de entrega).
 */
class EstadoEnviada extends EstadoMensagem {
  avancarPara(rotulo) {
    if (rotulo === 'ENTREGUE') return new EstadoEntregue();
    if (rotulo === 'LIDA') return new EstadoLida();
    return this;
  }

  get rotulo() {
    return 'ENVIADA';
  }
}

module.exports = EstadoEnviada;
