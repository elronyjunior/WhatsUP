/**
 * TelaLigacao — Mediador Concreto (Padrão Mediator)
 *
 * Coordena todos os componentes de uma ligação de voz/vídeo: botões de
 * ligar, atender, recusar, microfone, câmera e encerrar, o cronômetro, o
 * rótulo de status, o toque e a ConexaoChamada (WebRTC). Nenhum desses
 * componentes conhece os outros — cada um só chama notificar(this, evento),
 * e é aqui que mora a regra "quando X acontece, Y e Z mudam". Ex.: quando a
 * conexão sobe, o toque para, o cronômetro começa, o status muda e os
 * botões de microfone/câmera passam a funcionar.
 *
 * Só conversas privadas (1-para-1) têm ligação, como no WhatsApp Web.
 */
class TelaLigacao extends Mediador {
  static TEMPO_LIMITE_CHAMANDO_MS = 30 * 1000;
  static TEMPO_EXIBIR_FIM_MS = 1800;

  /**
   * @param {Object} deps
   * @param {import('socket.io-client').Socket} deps.socket
   * @param {() => string} deps.obterContatoAtual - conversa aberta agora
   * @param {(contato: string) => boolean} deps.contatoEstaOnline
   * @param {(contato: string, texto: string) => void} deps.registrarChamada - grava o registro da chamada na conversa (vira um Pacote)
   * @param {(texto: string, tipo: string) => void} deps.avisar - toast
   */
  constructor({ socket, obterContatoAtual, contatoEstaOnline, registrarChamada, avisar }) {
    super();
    this.socket = socket;
    this._obterContatoAtual = obterContatoAtual;
    this._contatoEstaOnline = contatoEstaOnline;
    this._registrarChamada = registrarChamada;
    this._avisar = avisar;

    this._overlay = document.getElementById('tela-ligacao');
    this._elNome = document.getElementById('ligacao-nome');
    this._elAvatar = document.getElementById('ligacao-avatar');

    // Componentes — todos recebem só o mediador (this), nunca uns aos outros
    this.botaoLigarVoz = new BotaoIniciarLigacao(this, document.getElementById('btn-ligar-voz'), 'voz');
    this.botaoLigarVideo = new BotaoIniciarLigacao(this, document.getElementById('btn-ligar-video'), 'video');
    this.botaoAtender = new BotaoAtender(this, document.getElementById('btn-ligacao-atender'));
    this.botaoRecusar = new BotaoRecusar(this, document.getElementById('btn-ligacao-recusar'));
    this.botaoMicrofone = new BotaoMicrofone(this, document.getElementById('btn-ligacao-microfone'));
    this.botaoCamera = new BotaoCamera(this, document.getElementById('btn-ligacao-camera'));
    this.botaoEncerrar = new BotaoEncerrar(this, document.getElementById('btn-ligacao-encerrar'));
    this.cronometro = new CronometroLigacao(this, document.getElementById('ligacao-cronometro'));
    this.status = new RotuloStatusLigacao(this, document.getElementById('ligacao-status'));
    this.toque = new ToqueChamada(this);
    this.conexao = new ConexaoChamada(
      this,
      socket,
      document.getElementById('ligacao-video-local'),
      document.getElementById('ligacao-video-remoto')
    );

    // 'livre' | 'chamando' | 'recebendo' | 'conectando' | 'em_andamento'
    this.estado = 'livre';
    this.contato = null;
    this.tipo = 'voz';
    this.souQuemLigou = false;
    this._ofertaRecebida = null;
    this._timerSemResposta = null;
    this._timerFechar = null;

    this._ouvirSinalizacao();
  }

  /**
   * Ponto central do Padrão Mediator: todo componente cai aqui.
   * @param {ComponenteMediado} remetente
   * @param {string} evento
   */
  notificar(remetente, evento) {
    if (remetente === this.botaoLigarVoz || remetente === this.botaoLigarVideo) {
      this._iniciarChamada(remetente.tipo);

    } else if (remetente === this.botaoAtender) {
      this._atender();

    } else if (remetente === this.botaoRecusar) {
      this.socket.emit('ligacao_recusar', { para: this.contato, motivo: 'recusada' });
      this._encerrar('recusei');

    } else if (remetente === this.botaoEncerrar) {
      this.socket.emit('ligacao_encerrar', { para: this.contato });
      this._encerrar(this.estado === 'chamando' ? 'cancelada' : 'encerrada');

    } else if (remetente === this.botaoMicrofone) {
      this.conexao.alternarAudio(!this.botaoMicrofone.mutado);
      this.status.exibir(this.botaoMicrofone.mutado ? 'Microfone desligado' : 'Em andamento');

    } else if (remetente === this.botaoCamera) {
      this.conexao.alternarVideo(this.botaoCamera.ligada);
      this._overlay.classList.toggle('camera-desligada', !this.botaoCamera.ligada);

    } else if (remetente === this.conexao && evento === 'conectou') {
      this._conectar();

    } else if (remetente === this.conexao && evento === 'caiu') {
      this._encerrar('caiu');

    } else if (remetente === this.conexao && evento === 'falhou') {
      this.socket.emit('ligacao_encerrar', { para: this.contato });
      this._avisar(`📞 ${this.conexao.ultimoErro}`, 'erro');
      this._encerrar('falha');
    }
  }

  /** Chamado pelo app.js sempre que a conversa aberta muda */
  definirConversa(ehPrivada) {
    this.botaoLigarVoz.mostrar(ehPrivada);
    this.botaoLigarVideo.mostrar(ehPrivada);
  }

  // ─── Fluxo de quem liga ────────────────────────────────────────────────────

  _iniciarChamada(tipo) {
    if (this.estado !== 'livre') return;

    const contato = this._obterContatoAtual();
    if (!this._contatoEstaOnline(contato)) {
      this._avisar(`📞 ${contato} está offline — não dá pra ligar agora.`, 'aviso');
      return;
    }

    this.souQuemLigou = true;
    this._abrir(contato, tipo, 'chamando');
    this.status.exibir('Chamando…');
    this.toque.tocar('saida');
    this.botaoEncerrar.mostrar(true);
    this.conexao.criarOferta(contato, tipo);

    this._timerSemResposta = setTimeout(() => {
      this.socket.emit('ligacao_encerrar', { para: this.contato });
      this._encerrar('sem_resposta');
    }, TelaLigacao.TEMPO_LIMITE_CHAMANDO_MS);
  }

  _aoSerAceita(resposta) {
    if (this.estado !== 'chamando') return;
    clearTimeout(this._timerSemResposta);
    this.estado = 'conectando';
    this.toque.parar();
    this.status.exibir('Conectando…');
    this.conexao.aplicarResposta(resposta);
  }

  // ─── Fluxo de quem recebe ──────────────────────────────────────────────────

  _receberChamada(de, tipo, oferta) {
    if (this.estado !== 'livre') {
      this.socket.emit('ligacao_recusar', { para: de, motivo: 'ocupado' });
      return;
    }

    this.souQuemLigou = false;
    this._ofertaRecebida = oferta;
    this._abrir(de, tipo, 'recebendo');
    this.conexao.aguardar(de);
    this.status.exibir(tipo === 'video' ? 'Chamada de vídeo recebida' : 'Chamada de voz recebida');
    this.toque.tocar('entrada');
    this.botaoAtender.mostrar(true);
    this.botaoRecusar.mostrar(true);
  }

  _atender() {
    if (this.estado !== 'recebendo') return;
    this.estado = 'conectando';
    this.toque.parar();
    this.botaoAtender.mostrar(false);
    this.botaoRecusar.mostrar(false);
    this.botaoEncerrar.mostrar(true);
    this.status.exibir('Conectando…');
    this.conexao.responder(this.contato, this.tipo, this._ofertaRecebida);
  }

  // ─── Comum aos dois lados ──────────────────────────────────────────────────

  _conectar() {
    if (this.estado === 'em_andamento' || this.estado === 'livre') return;
    this.estado = 'em_andamento';
    this.status.exibir('Em andamento');
    this.cronometro.iniciar();
    this.botaoMicrofone.mostrar(true);
    this.botaoMicrofone.habilitar(true);
    this.botaoCamera.mostrar(this.tipo === 'video');
    this.botaoCamera.habilitar(this.tipo === 'video');
    this._overlay.classList.add('conectada');
  }

  _abrir(contato, tipo, estado) {
    clearTimeout(this._timerFechar);
    this.contato = contato;
    this.tipo = tipo;
    this.estado = estado;

    this._elNome.textContent = contato;
    this._elAvatar.textContent = contato.charAt(0).toUpperCase();

    this.botaoAtender.mostrar(false);
    this.botaoRecusar.mostrar(false);
    this.botaoEncerrar.mostrar(false);
    this.botaoMicrofone.zerar();
    this.botaoMicrofone.mostrar(false);
    this.botaoCamera.zerar();
    this.botaoCamera.mostrar(false);
    this.cronometro.zerar();

    this._overlay.classList.toggle('modo-video', tipo === 'video');
    this._overlay.classList.remove('conectada', 'camera-desligada', 'encerrando');
    this._overlay.classList.remove('hidden');
  }

  /**
   * Desfaz tudo de uma vez — é o caso em que o Mediator mais compensa: o
   * mesmo "encerrar" vale para quem desligou, recusou, não atendeu, caiu
   * ou falhou, e nenhum componente precisa saber dos outros pra isso.
   * @param {string} motivo
   */
  _encerrar(motivo) {
    if (this.estado === 'livre') return;

    const estavaEmAndamento = this.estado === 'em_andamento';
    clearTimeout(this._timerSemResposta);
    this.toque.parar();
    const duracao = this.cronometro.parar();
    this.conexao.fechar();

    const textos = {
      encerrada: 'Ligação encerrada',
      cancelada: 'Ligação cancelada',
      recusei: 'Ligação recusada',
      recusada: 'Ligação recusada',
      ocupado: `${this.contato} está em outra ligação`,
      sem_resposta: 'Sem resposta',
      indisponivel: `${this.contato} não está disponível`,
      perdida: 'Chamada perdida',
      caiu: 'A ligação caiu',
      falha: 'Não foi possível completar a ligação',
    };
    this.status.exibir(textos[motivo] || 'Ligação encerrada');

    // Só quem ligou grava o registro, pra não aparecer duplicado na conversa
    if (this.souQuemLigou && motivo !== 'falha' && motivo !== 'indisponivel') {
      const rotulo = this.tipo === 'video' ? 'Chamada de vídeo' : 'Chamada de voz';
      const texto = estavaEmAndamento
        ? `📞 ${rotulo} · ${CronometroLigacao.formatar(duracao)}`
        : `📞 ${rotulo} não atendida`;
      this._registrarChamada(this.contato, texto);
    }

    this.botaoAtender.mostrar(false);
    this.botaoRecusar.mostrar(false);
    this.botaoEncerrar.mostrar(false);
    this.botaoMicrofone.mostrar(false);
    this.botaoCamera.mostrar(false);
    this._overlay.classList.remove('conectada');
    this._overlay.classList.add('encerrando');

    this.estado = 'livre';
    this.contato = null;
    this._ofertaRecebida = null;

    this._timerFechar = setTimeout(() => {
      this._overlay.classList.add('hidden');
    }, TelaLigacao.TEMPO_EXIBIR_FIM_MS);
  }

  /** Eventos que o ServidorCentral repassa do outro participante */
  _ouvirSinalizacao() {
    this.socket.on('ligacao_recebida', ({ de, tipo, oferta }) => {
      this._receberChamada(de, tipo, oferta);
    });

    this.socket.on('ligacao_aceita', ({ de, resposta }) => {
      if (de === this.contato) this._aoSerAceita(resposta);
    });

    this.socket.on('ligacao_recusada', ({ de, motivo }) => {
      if (de === this.contato) this._encerrar(motivo === 'ocupado' ? 'ocupado' : 'recusada');
    });

    this.socket.on('ligacao_indisponivel', ({ de }) => {
      if (de === this.contato) this._encerrar('indisponivel');
    });

    this.socket.on('ligacao_encerrada', ({ de }) => {
      if (de !== this.contato) return;
      this._encerrar(this.estado === 'recebendo' ? 'perdida' : 'encerrada');
    });
  }
}
