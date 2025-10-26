// script.js (organizado e sem duplicações)
// --------------------------------------------------
// Seções:
// 1) Config / Consts
// 2) Cache do DOM
// 3) Helpers UI
// 4) WebSocket (conn / handlers / send)
// 5) HTTP helpers (fetch / montar UI)
// 6) Handlers de ações do usuário (meta / deposit / withdraw / play)
// 7) Init
// --------------------------------------------------

// 1) CONFIG
const ENDERECO_WS = "wss://ericka-unraisable-harrison.ngrok-free.dev/?from=site";
const API_BASE = "http://localhost:3333"; // ajuste se necessário

// 2) CACHE DO DOM (verifica existência antes de usar)
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

const jogarBtn = document.querySelector('.footer .btn'); // ou atribua id="btnJogar" no HTML

const metaSection = document.getElementById('metaSection');
const hrTop = document.getElementById('hrTop');
const hrBottom = document.getElementById('hrBottom');
const radios = document.querySelectorAll('input[name="opcao"]');

// estado local
let metaAtual = "";
let registro = "";

let conexaoWs = null;
let reconnectTimer = null;

// 3) HELPERS UI
function atualizarUiConectado() {
  if (!statusConexao) return;
  statusConexao.textContent = "Conectado";
  statusConexao.className = "ok";
}
function atualizarUiDesconectado(texto = "Desconectado") {
  if (!statusConexao) return;
  statusConexao.textContent = texto;
  statusConexao.className = "bad";
}
function showMetaSection(show) {
  if (!metaSection) return;
  metaSection.style.display = show ? 'block' : 'none';
  if (hrBottom) hrBottom.style.display = show ? '' : 'none';
  metaSection.setAttribute('aria-hidden', show ? 'false' : 'true');
}

// 4) WEBSOCKET (conexão, reconexão, envio)
function conectarWS() {
  if (conexaoWs && conexaoWs.readyState === WebSocket.OPEN) return;

  try {
    conexaoWs = new WebSocket(ENDERECO_WS);
  } catch (err) {
    console.error("Erro ao criar WS:", err);
    scheduleReconnectWS();
    return;
  }

  conexaoWs.onopen = () => {
    console.log("WS conectado");
    atualizarUiConectado();
    // carregamentos iniciais (o servidor pode enviar snapshot também)
    carregarMetas();
    solicitarSaldo();
  };

  conexaoWs.onmessage = (evt) => {
    logMensagens && (logMensagens.textContent = evt.data);
    // console.log("[WS RECEBIDO]", evt.data);

    try {
      const msg = JSON.parse(evt.data);

      // telemetria simples
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
          case "meta_deleted":
            // recarrega a lista para garantir consistência
            carregarMetas();
            break;
          case "operation":
            solicitarSaldo();
            break;
          case "play":
            // debug: navegador pode reagir se quiser
            console.log("PLAY recebido:", msg);
            break;
          default:
            console.log("WS msg tipo desconhecido:", msg.type);
        }
      }
    } catch (e) {
      // não-JSON
      console.log("WS texto:", evt.data);
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
    return false;
  }
  conexaoWs.send(JSON.stringify(obj));
  return true;
}

// 5) HTTP HELPERS (carregar / montar UI)
async function carregarMetas() {
  if (!metaTags) return;
  try {
    const resp = await fetch(`${API_BASE}/metas`);
    const metas = await resp.json();
    montarMetaTags(metas);
  } catch (err) {
    console.error("Erro carregar metas:", err);
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
        const res = await fetch(`${API_BASE}/metas`, {
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

  // ativa a última meta automaticamente (se houver)
  const last = metaTags.querySelector('.meta-tag:last-child');
  if (last) {
    const all = Array.from(metas);
    setActiveTag(last, all[all.length - 1].name);
  } else {
    registrarMetaText && (registrarMetaText.textContent = 'meta');
    metaAtual = "";
    registro = "";
  }
}

async function solicitarSaldo() {
  try {
    const resp = await fetch(`${API_BASE}/saldo`);
    const s = await resp.json();
    console.log("Saldo:", s);
    return s;
  } catch (err) {
    console.error("Erro buscar saldo:", err);
    return null;
  }
}

// 6) HANDLERS DE AÇÕES DO USUÁRIO

// Toggle do formulário de criar meta
if (criarMetaBtn && formMeta && nomeMeta) {
  criarMetaBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = formMeta.style.display === 'flex' || formMeta.style.display === 'block';
    formMeta.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) nomeMeta.focus();
  });
}

// Criar meta -> POST /metas
if (definirMetaBtn) {
  definirMetaBtn.addEventListener('click', async () => {
    const name = nomeMeta ? nomeMeta.value.trim() : "";
    const value = valorMeta ? valorMeta.value.trim() : "";
    if (!name) { alert("Preencha o nome da meta"); nomeMeta && nomeMeta.focus(); return; }

    const meta = { name, value };
    try {
      const res = await fetch(`${API_BASE}/metas`, {
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

// Set active tag
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

// Deposit / Withdraw UI toggles
if (depositBtn && withdrawBtn && depositForm && withdrawForm && depositInput && withdrawInput) {
  depositBtn.addEventListener('click', () => {
    const active = depositBtn.classList.contains('active');
    if (!active) {
      depositBtn.classList.add('active');
      withdrawBtn.classList.remove('active');
      depositForm.classList.add('active');
      withdrawForm.classList.remove('active');
      depositForm.setAttribute('aria-hidden', 'false');
      withdrawForm.setAttribute('aria-hidden', 'true');
    }
    depositInput.focus(); depositInput.select();
  });

  withdrawBtn.addEventListener('click', () => {
    const active = withdrawBtn.classList.contains('active');
    if (!active) {
      withdrawBtn.classList.add('active');
      depositBtn.classList.remove('active');
      withdrawForm.classList.add('active');
      depositForm.classList.remove('active');
      withdrawForm.setAttribute('aria-hidden', 'false');
      depositForm.setAttribute('aria-hidden', 'true');
    }
    withdrawInput.focus(); withdrawInput.select();
  });

  // deposit submit (Enter)
  depositInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = depositInput.valueAsNumber;
    if (isNaN(value) || value <= 0) { alert("Informe um valor válido"); return; }

    const operation = { value, operation: "deposit", meta: registro };
    try {
      const res = await fetch(`${API_BASE}/historico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation })
      });
      const j = await res.json();
      alert(j.message || "Depósito registrado");
      depositInput.value = "";
      await solicitarSaldo();
      // servidor realizará broadcast para ESPs
    } catch (err) {
      console.error("Erro no depósito:", err);
      alert("Erro ao registrar depósito");
    }
  });

  // withdraw submit (Enter)
  withdrawInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = withdrawInput.valueAsNumber;
    if (isNaN(value) || value <= 0) { alert("Informe um valor válido"); return; }

    const operation = { value, operation: "withdraw", meta: registro };
    try {
      const res = await fetch(`${API_BASE}/historico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation })
      });
      const j = await res.json();
      alert(j.message || "Saque registrado");
      withdrawInput.value = "";
      await solicitarSaldo();
    } catch (err) {
      console.error("Erro no saque:", err);
      alert("Erro ao registrar saque");
    }
  });
}

// JOGAR -> envia play via WS (e tenta POST /play como fallback)
if (jogarBtn) {
  jogarBtn.addEventListener('click', async () => {
    const payload = { meta: metaAtual || null };
    const playMsg = { type: "play", content: "tela_jogo", payload };

    const sent = enviarViaWS(playMsg);

    if (!sent) {
      // fallback HTTP
      try {
        await fetch(`${API_BASE}/play`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "tela_jogo", payload })
        });
      } catch (err) {
        console.warn("POST /play falhou:", err);
      }
    }

    alert("Comando JOGAR enviado");
  });
}

// radios change (economizar / meta)
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

// keyboard submit shortcuts inside meta form
if (nomeMeta && valorMeta && definirMetaBtn) {
  [nomeMeta, valorMeta].forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        definirMetaBtn.click();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' &&
        (formMeta && (formMeta.style.display === 'flex' || formMeta.style.display === 'block'))) {
      definirMetaBtn.click();
    }
  });
}

// 7) INIT
(function init() {
  // ajustes iniciais de UI
  if (hrTop) hrTop.style.display = '';
  if (formMeta) formMeta.style.display = 'none';

  if (depositForm) depositForm.classList.remove('active');
  if (withdrawForm) withdrawForm.classList.remove('active');
  if (depositBtn) depositBtn.classList.remove('active');
  if (withdrawBtn) withdrawBtn.classList.remove('active');
  if (depositForm) depositForm.setAttribute('aria-hidden', 'true');
  if (withdrawForm) withdrawForm.setAttribute('aria-hidden', 'true');

  // iniciar WS e carregar dados
  conectarWS();
  carregarMetas();
  solicitarSaldo();
})();

