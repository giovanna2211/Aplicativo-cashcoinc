// script.js (VERSÃO CORRIGIDA - sem declarações duplicadas)

// CONFIG
const ENDERECO_WS = "wss://ericka-unraisable-harrison.ngrok-free.dev/?from=site";

// ELEMENTOS (verifica existência antes de usar)
const statusConexao = document.getElementById("status");
const valorTemperatura = document.getElementById("temp");
const valorUmidade = document.getElementById("umid");
const logMensagens = document.getElementById("raw");

const botaoLigarLed = document.getElementById("btnOn");
const botaoDesligarLed = document.getElementById("btnOff");
const campoJson = document.getElementById("jsonInput");
const botaoEnviarJson = document.getElementById("btnEnviarJson");
const erroJson = document.getElementById("erroJson");

const criarMetaBtn = document.getElementById('criarMeta');
const formMeta = document.getElementById('formMeta');
const definirMetaBtn = document.getElementById('definirMeta');
const nomeMeta = document.getElementById('nomeMeta');
const valorMeta = document.getElementById('valorMeta');
const metaTags = document.getElementById('metaTags');
const registrarMetaText = document.getElementById('registrarMetaText');

const depositBtn = document.getElementById('depositBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const depositForm = document.getElementById('depositForm');
const withdrawForm = document.getElementById('withdrawForm');
const depositInput = document.getElementById('depositValue');
const withdrawInput = document.getElementById('withdrawValue');

const jogarBtn = document.querySelector('.footer .btn'); // se tiver outro, coloque id no HTML

const metaSection = document.getElementById('metaSection');
const hrTop = document.getElementById('hrTop');
const hrBottom = document.getElementById('hrBottom');
const radios = document.querySelectorAll('input[name="opcao"]');

let metaAtual = "";
let registro = "";

let conexaoWs = null;
let reconnectTimer = null;

/* =========================
   UI helpers
   ========================= */
function atualizarUiConectado() {
  if (statusConexao) {
    statusConexao.textContent = "Conectado";
    statusConexao.className = "ok";
  }
}
function atualizarUiDesconectado(texto = "Desconectado") {
  if (statusConexao) {
    statusConexao.textContent = texto;
    statusConexao.className = "bad";
  }
}

/* =========================
   WebSocket
   ========================= */
function conectarWS() {
  if (conexaoWs && conexaoWs.readyState === WebSocket.OPEN) return;

  try {
    conexaoWs = new WebSocket(ENDERECO_WS);
  } catch (err) {
    console.error("Erro ao criar WebSocket:", err);
    scheduleReconnectWS();
    return;
  }

  conexaoWs.onopen = () => {
    console.log("WS conectado");
    atualizarUiConectado();
    // pede estado inicial (o servidor pode enviar snapshot automaticamente)
    carregarMetas();
    buscarSaldo();
  };

  conexaoWs.onmessage = (evt) => {
    logMensagens && (logMensagens.textContent = evt.data);
    console.log("[WS RECEBIDO]", evt.data);

    try {
      const msg = JSON.parse(evt.data);

      // atualizações telemetria simples (mantive compatibilidade)
      if (typeof msg.temperatura === "number" && valorTemperatura) {
        valorTemperatura.textContent = msg.temperatura.toFixed(1) + " °C";
      }
      if (typeof msg.umidade === "number" && valorUmidade) {
        valorUmidade.textContent = msg.umidade.toFixed(1) + " %";
      }

      // mensagens por tipo
      if (msg.type) {
        switch (msg.type) {
          case "snapshot":
            if (Array.isArray(msg.metas)) montarMetaTags(msg.metas);
            if (msg.saldo) console.log("Saldo (snapshot):", msg.saldo);
            break;
          case "meta":
            carregarMetas();
            break;
          case "meta_deleted":
            carregarMetas();
            break;
          case "operation":
            buscarSaldo();
            break;
          case "play":
            console.log("Play recebido (debug):", msg);
            break;
          case "ack":
            console.log("ACK:", msg);
            break;
          default:
            console.log("Tipo desconhecido:", msg.type);
        }
      }
    } catch (e) {
      // mensagem não-JSON: apenas log
      console.log("Mensagem não JSON:", evt.data);
    }
  };

  conexaoWs.onerror = (e) => {
    console.error("WS erro:", e);
    atualizarUiDesconectado("Erro");
  };

  conexaoWs.onclose = () => {
    console.log("WS fechado — reconectando...");
    atualizarUiDesconectado();
    scheduleReconnectWS();
  };
}

function scheduleReconnectWS() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    conectarWS();
  }, 1500 + Math.random() * 1000);
}

function enviarViaWS(obj) {
  if (!conexaoWs || conexaoWs.readyState !== WebSocket.OPEN) {
    console.warn("WS não aberto — não enviou:", obj);
    return;
  }
  conexaoWs.send(JSON.stringify(obj));
}

/* =========================
   Backend HTTP helpers
   ========================= */
async function carregarMetas() {
  if (!metaTags) return;
  try {
    const resp = await fetch("http://localhost:3333/metas");
    const metas = await resp.json();
    montarMetaTags(metas);
  } catch (err) {
    console.error("Erro ao carregar metas:", err);
  }
}

function montarMetaTags(metas) {
  if (!metaTags) return;
  metaTags.textContent = "";
  if (!Array.isArray(metas)) return;

  metas.forEach(meta => {
    const { id, name, value } = meta;
    const tag = document.createElement('span');
    tag.className = 'meta-tag';
    tag.tabIndex = 0;

    const spanText = document.createElement('span');
    spanText.className = 'tag-text';
    spanText.textContent = name + (value ? ' — R$ ' + value : '');

    const btn = document.createElement('button');
    btn.className = 'tag-close';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Remover meta');
    btn.textContent = '✕';

    tag.appendChild(spanText);
    tag.appendChild(btn);
    metaTags.appendChild(tag);

    tag.addEventListener('click', (ev) => {
      if (ev.target === btn) return;
      setActiveTag(tag, name);
    });

    tag.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        setActiveTag(tag, name);
      }
    });

    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      try {
        const res = await fetch("http://localhost:3333/metas", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        const j = await res.json();
        alert(j.message || "Meta removida");
        await carregarMetas();
      } catch (err) {
        console.error("Erro deletando meta:", err);
        alert("Erro ao deletar meta");
      }
    });
  });

  // ativa a última meta por padrão se existir
  const last = metaTags.querySelector('.meta-tag:last-child');
  if (last) {
    const all = Array.from(metas);
    setActiveTag(last, all[all.length - 1].name);
  } else {
    // se não houver metas, limpa seleção
    registrarMetaText && (registrarMetaText.textContent = 'meta');
    metaAtual = "";
    registro = "";
  }
}

function setActiveTag(tagEl, name) {
  if (!metaTags) return;
  metaTags.querySelectorAll('.meta-tag').forEach(t => t.classList.remove('active'));
  tagEl.classList.add('active');
  registrarMetaText && (registrarMetaText.textContent = name);
  metaAtual = name;
  registro = name;
  const metaRadio = document.getElementById('radioMeta');
  if (metaRadio) metaRadio.checked = true;
  showMetaSection(true);
}

async function buscarSaldo() {
  try {
    const resp = await fetch("http://localhost:3333/saldo");
    const s = await resp.json();
    console.log("Saldo:", s);
    return s;
  } catch (err) {
    console.error("Erro ao buscar saldo:", err);
    return null;
  }
}

/* =========================
   Ações do usuário
   ========================= */

// criar meta
if (definirMetaBtn) {
  definirMetaBtn.addEventListener('click', async () => {
    const name = nomeMeta ? nomeMeta.value.trim() : "";
    const value = valorMeta ? valorMeta.value.trim() : "";
    if (!name) { alert("Preencha o nome da meta"); nomeMeta && nomeMeta.focus(); return; }
    const meta = { name, value };
    try {
      const res = await fetch("http://localhost:3333/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta })
      });
      const j = await res.json();
      alert(j.message || "Meta criada");
      await carregarMetas();
      if (formMeta) formMeta.style.display = 'none';
      if (nomeMeta) nomeMeta.value = '';
      if (valorMeta) valorMeta.value = '';
    } catch (err) {
      console.error("Erro criando meta:", err);
      alert("Erro ao criar meta");
    }
  });
}

// depositar
if (depositInput) {
  depositInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = depositInput.valueAsNumber;
    if (isNaN(value) || value <= 0) { alert("Informe um valor válido"); return; }
    const operation = { value, operation: "deposit", meta: registro };
    try {
      const res = await fetch("http://localhost:3333/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation })
      });
      const j = await res.json();
      alert(j.message || "Depósito registrado");
      depositInput.value = "";
      await buscarSaldo();
    } catch (err) {
      console.error("Erro no depósito:", err);
      alert("Erro ao registrar depósito");
    }
  });
}

// sacar
if (withdrawInput) {
  withdrawInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = withdrawInput.valueAsNumber;
    if (isNaN(value) || value <= 0) { alert("Informe um valor válido"); return; }
    const operation = { value, operation: "withdraw", meta: registro };
    try {
      const res = await fetch("http://localhost:3333/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation })
      });
      const j = await res.json();
      alert(j.message || "Saque registrado");
      withdrawInput.value = "";
      await buscarSaldo();
    } catch (err) {
      console.error("Erro no saque:", err);
      alert("Erro ao registrar saque");
    }
  });
}

// JOGAR
if (jogarBtn) {
  jogarBtn.addEventListener('click', async () => {
    const payload = { meta: metaAtual || null };
    const playMsg = { type: "play", content: "tela_jogo", payload };

    // envia por WS (se conectado)
    enviarViaWS(playMsg);

    // fallback HTTP
    try {
      await fetch("http://localhost:3333/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "tela_jogo", payload })
      });
    } catch (err) {
      console.warn("POST /play falhou:", err);
    }

    alert("Comando JOGAR enviado");
  });
}

/* =========================
   util UI (show/hide meta)
   ========================= */
function showMetaSection(show) {
  if (!metaSection) return;
  if (show) {
    metaSection.style.display = 'block';
    if (hrBottom) hrBottom.style.display = '';
    metaSection.setAttribute('aria-hidden', 'false');
  } else {
    metaSection.style.display = 'none';
    if (hrBottom) hrBottom.style.display = 'none';
    metaSection.setAttribute('aria-hidden', 'true');
  }
}

if (radios && radios.length) {
  radios.forEach(r => r.addEventListener('change', (e) => {
    if (e.target.value === 'economizar') {
      registro = "";
      showMetaSection(false);
    } else {
      registro = metaAtual;
      showMetaSection(true);
    }
  }));
}

/* =========================
   init
   ========================= */
(function init() {
  // keep hrTop visible
  if (hrTop) hrTop.style.display = '';

  // form meta hidden by default
  if (formMeta) formMeta.style.display = 'none';

  // deposit/withdraw initial state
  if (depositForm) depositForm.classList.remove('active');
  if (withdrawForm) withdrawForm.classList.remove('active');
  if (depositBtn) depositBtn.classList.remove('active');
  if (withdrawBtn) withdrawBtn.classList.remove('active');
  if (depositForm) depositForm.setAttribute('aria-hidden', 'true');
  if (withdrawForm) withdrawForm.setAttribute('aria-hidden', 'true');

  // conecta WS e carrega dados iniciais
  conectarWS();
  carregarMetas();
  buscarSaldo();
})();
