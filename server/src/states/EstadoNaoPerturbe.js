const EstadoPresenca = require('../interfaces/EstadoPresenca');

/**
 * EstadoNaoPerturbe — Estado Concreto (Padrão State)
 *
 * O usuário pediu explicitamente para não ser interrompido, mas o socket
 * continua ativo — o transporte da mensagem é idêntico ao EstadoOnline.
 * A supressão de som/pop-ups/notificação nativa acontece no cliente
 * (EstadoNaoPerturbe do CelularUsuario), que decide não reagir a ela;
 * aqui no servidor não há nada a suprimir, só a entrega em si.
 */
class EstadoNaoPerturbe extends EstadoPresenca {
  entregarMensagem(pacote, { io, socketId }) {
    if (!socketId) return false;
    io.to(socketId).emit('mensagem_recebida', pacote.toJSON ? pacote.toJSON() : pacote);
    return true;
  }

  get rotulo() {
    return 'Não Perturbe';
  }
}

module.exports = EstadoNaoPerturbe;
