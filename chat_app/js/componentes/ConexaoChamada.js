/**
 * ConexaoChamada — encapsula o WebRTC (RTCPeerConnection + getUserMedia) e
 * a sinalização pelo socket. O áudio/vídeo trafega direto entre os dois
 * navegadores; o ServidorCentral só repassa oferta, resposta e candidatos
 * ICE ('ligacao_convite', 'ligacao_resposta', 'ligacao_ice').
 *
 * Também é um componente do Mediator: não sabe nada de botões, toque ou
 * cronômetro. Quando a conexão sobe, cai ou falha, só avisa a TelaLigacao
 * ('conectou' / 'caiu' / 'falhou') e ela decide o que a tela faz.
 */
class ConexaoChamada extends ComponenteMediado {
  /**
   * @param {Mediador} mediador
   * @param {import('socket.io-client').Socket} socket
   * @param {HTMLVideoElement} videoLocal
   * @param {HTMLVideoElement} videoRemoto
   */
  constructor(mediador, socket, videoLocal, videoRemoto) {
    super(mediador);
    this.socket = socket;
    this.videoLocal = videoLocal;
    this.videoRemoto = videoRemoto;
    this.peer = null;
    this.streamLocal = null;
    this.contato = null;
    this.ultimoErro = null;
    // Candidatos ICE podem chegar antes da descrição remota (ex.: quem
    // recebe ainda nem clicou em Atender) — ficam guardados até lá.
    this._candidatosPendentes = [];
    // Incrementa a cada fechar(): uma captura de mídia que ainda estava
    // esperando a permissão do navegador descobre que a chamada já acabou.
    this._sessao = 0;

    // Candidatos que chegaram antes até do convite (contato ainda null)
    this._candidatosSemContato = [];

    this.socket.on('ligacao_ice', ({ de, candidato }) => {
      if (de === this.contato) {
        this.adicionarCandidato(candidato);
      } else if (this.contato === null) {
        this._candidatosSemContato.push({ de, candidato });
      }
    });
  }

  /** Quem liga: captura a mídia, cria a oferta e manda o convite */
  async criarOferta(para, tipo) {
    try {
      this.contato = para;
      await this._prepararPeer(tipo, this._sessao);
      const oferta = await this.peer.createOffer();
      await this.peer.setLocalDescription(oferta);
      this.socket.emit('ligacao_convite', { para, tipo, oferta });
    } catch (err) {
      this._falhar(err);
    }
  }

  /** Quem recebe: captura a mídia, aplica a oferta e devolve a resposta */
  async responder(para, tipo, oferta) {
    try {
      this.contato = para;
      await this._prepararPeer(tipo, this._sessao);
      await this.peer.setRemoteDescription(oferta);
      this._aplicarCandidatosPendentes();
      const resposta = await this.peer.createAnswer();
      await this.peer.setLocalDescription(resposta);
      this.socket.emit('ligacao_resposta', { para, resposta });
    } catch (err) {
      this._falhar(err);
    }
  }

  /** Quem ligou: o outro lado atendeu e mandou a resposta */
  async aplicarResposta(resposta) {
    try {
      await this.peer.setRemoteDescription(resposta);
      this._aplicarCandidatosPendentes();
    } catch (err) {
      this._falhar(err);
    }
  }

  /** Chamado ao receber uma chamada, antes de atender, só pra já aceitar candidatos dela */
  aguardar(contato) {
    this.contato = contato;
    this._candidatosSemContato
      .filter((c) => c.de === contato)
      .forEach((c) => this.adicionarCandidato(c.candidato));
    this._candidatosSemContato = [];
  }

  adicionarCandidato(candidato) {
    if (!this.peer || !this.peer.remoteDescription) {
      this._candidatosPendentes.push(candidato);
      return;
    }
    this.peer.addIceCandidate(candidato).catch((err) => {
      console.warn('[Ligação] Candidato ICE rejeitado:', err.message);
    });
  }

  alternarAudio(ativo) {
    this.streamLocal?.getAudioTracks().forEach((t) => { t.enabled = ativo; });
  }

  alternarVideo(ativo) {
    this.streamLocal?.getVideoTracks().forEach((t) => { t.enabled = ativo; });
  }

  /** Encerra a conexão e libera câmera/microfone */
  fechar() {
    this._sessao++;
    if (this.peer) {
      this.peer.onconnectionstatechange = null;
      this.peer.close();
    }
    this.streamLocal?.getTracks().forEach((t) => t.stop());
    this.peer = null;
    this.streamLocal = null;
    this.contato = null;
    this._candidatosPendentes = [];
    this.videoLocal.srcObject = null;
    this.videoRemoto.srcObject = null;
  }

  async _prepararPeer(tipo, sessao) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador não libera microfone/câmera aqui (é preciso HTTPS ou localhost).');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: tipo === 'video',
    });
    if (sessao !== this._sessao) {
      stream.getTracks().forEach((t) => t.stop());
      throw Object.assign(new Error('Chamada encerrada antes de conectar'), { cancelada: true });
    }
    this.streamLocal = stream;
    this.videoLocal.srcObject = this.streamLocal;

    this.peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.streamLocal.getTracks().forEach((t) => this.peer.addTrack(t, this.streamLocal));

    this.peer.ontrack = (e) => {
      this.videoRemoto.srcObject = e.streams[0];
    };

    this.peer.onicecandidate = (e) => {
      if (e.candidate && this.contato) {
        this.socket.emit('ligacao_ice', { para: this.contato, candidato: e.candidate });
      }
    };

    this.peer.onconnectionstatechange = () => {
      const estado = this.peer?.connectionState;
      if (estado === 'connected') this.mediador.notificar(this, 'conectou');
      if (estado === 'failed') this.mediador.notificar(this, 'caiu');
    };
  }

  _aplicarCandidatosPendentes() {
    const pendentes = this._candidatosPendentes;
    this._candidatosPendentes = [];
    pendentes.forEach((c) => this.adicionarCandidato(c));
  }

  _falhar(err) {
    // A chamada já foi encerrada por outro motivo (ex.: desligou enquanto o
    // navegador pedia permissão) — não há o que avisar.
    if (err.cancelada || (!this.peer && !this.streamLocal && this.contato === null)) return;
    console.error('[Ligação] Falha na conexão:', err);
    this.ultimoErro = err.name === 'NotAllowedError'
      ? 'Permissão de microfone/câmera negada.'
      : err.message;
    this.mediador.notificar(this, 'falhou');
  }
}
