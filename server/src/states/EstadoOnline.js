const EstadoPresenca = require('../interfaces/EstadoPresenca');

/**
 * EstadoOnline — Estado Concreto (Padrão State)
 *
 * Usuário com a aplicação aberta, em foco, ou com atividade recente.
 * Entrega o pacote instantaneamente via WebSocket — a reação (som, balão,
 * notificação nativa) fica a cargo do EstadoPresenca do CelularUsuario, no
 * cliente, que é quem tem acesso à janela e ao sistema operacional.
 */
class EstadoOnline extends EstadoPresenca {
  entregarMensagem(pacote, { io, socketId }) {
    if (!socketId) return false; // segurança: sem socket ativo, não há o que fazer aqui
    io.to(socketId).emit('mensagem_recebida', pacote.toJSON ? pacote.toJSON() : pacote);
    return true;
  }

  get rotulo() {
    return 'Online';
  }
}

module.exports = EstadoOnline;
