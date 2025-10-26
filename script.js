const criarMeta = document.getElementById('criarMeta');
const formMeta = document.getElementById('formMeta');
const definirMeta = document.getElementById('definirMeta');
const nomeMeta = document.getElementById('nomeMeta');
const valorMeta = document.getElementById('valorMeta');
const metaTags = document.getElementById('metaTags');
const registrarMetaText = document.getElementById('registrarMetaText');
let metaAtual = ""
let registro = ""

// toggle form display
criarMeta.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = formMeta.style.display === 'flex' || formMeta.style.display === 'block';
    formMeta.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
        nomeMeta.focus();
    }
});

// create tag element and wire interactions
async function createMetaTag() {

    // essa a variável que guarda as metas q você pegou do backend. Se não lembra do backend VAI OLHAR. precisa usar async / await, se não onde está OLHE O CÓDIGO DIREITO
    const metas = await fetch("http://localhost:3333/metas").then(response => response.json())
    metaTags.textContent = ""

    // você precisar usar o map abaixo para colocar todo o histórico na tela
    metas.map(meta => {
        const { name, value, id } = meta

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

        // tag click: activate tag (except when clicking the close button)
        tag.addEventListener('click', (ev) => {
            if (ev.target === btn) return;
            setActiveTag(tag, name);
        });

        // keyboard activation
        tag.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                setActiveTag(tag, name);
            }
        });

        // close button
        btn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const wasActive = tag.classList.contains('active');

            const response = await fetch("http://localhost:3333/metas", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ id })
            }).then(response => response.json())

            alert(response.message)

            tag.remove();
            if (wasActive) {
                registrarMetaText.textContent = 'meta';
            }

            window.location.reload()
        });

        tag.appendChild(spanText);
        tag.appendChild(btn);
        metaTags.appendChild(tag);

        // make the new tag active immediately
        setActiveTag(tag, name);
    })
}

function setActiveTag(tagElement, name) {
    // remove active from all
    metaTags.querySelectorAll('.meta-tag').forEach(t => t.classList.remove('active'));
    tagElement.classList.add('active');
    registrarMetaText.textContent = name;
    registro = name
    metaAtual = name
    // ensure the "Economizar para meta" radio is selected
    const metaRadio = document.getElementById('radioMeta');
    if (metaRadio) metaRadio.checked = true;
    // show meta section if hidden
    showMetaSection(true);
}

// define meta button
definirMeta.addEventListener('click', async () => {
    const name = nomeMeta.value.trim();
    const value = valorMeta.value.trim();

    if (!name) {
        alert('Preencha o nome da meta!');
        nomeMeta.focus();
        return;
    }

    const meta = {
        name,
        value
    }

    const response = await fetch("http://localhost:3333/metas", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ meta })
    }).then(response => response.json())

    alert(response.message)

    createMetaTag();
    formMeta.style.display = 'none';
    nomeMeta.value = '';
    valorMeta.value = '';
});

// keyboard shortcuts inside meta form
[nomeMeta, valorMeta].forEach(inp => {
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            definirMeta.click();
        }
    });
});

// ctrl/cmd + Enter to submit when form open
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && (formMeta.style.display === 'flex' || formMeta.style.display === 'block')) {
        definirMeta.click();
    }
});

// show/hide meta section (reuses hrTop/hrBottom logic)
const metaSection = document.getElementById('metaSection');
const hrTop = document.getElementById('hrTop');
const hrBottom = document.getElementById('hrBottom');
const radios = document.querySelectorAll('input[name="opcao"]');

function showMetaSection(show) {
    if (show) {
        metaSection.style.display = 'block';
        hrBottom.style.display = '';
        metaSection.setAttribute('aria-hidden', 'false');
    } else {
        metaSection.style.display = 'none';
        hrBottom.style.display = 'none';
        metaSection.setAttribute('aria-hidden', 'true');
    }
}

radios.forEach(r => {
    r.addEventListener('change', (e) => {
        if (e.target.value === 'economizar') {
            registro = ""
            showMetaSection(false);
        } else {
            registro = metaAtual
            showMetaSection(true);
        }
    });
});

/* =======================
    Depositar / Sacar logic
    ======================= */
const depositBtn = document.getElementById('depositBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const depositForm = document.getElementById('depositForm');
const withdrawForm = document.getElementById('withdrawForm');
const depositInput = document.getElementById('depositValue');
const withdrawInput = document.getElementById('withdrawValue');

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
    depositInput.focus();
    depositInput.select();
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
    withdrawInput.focus();
    withdrawInput.select();
});

// Enter behavior for deposit/withdraw inputs (placeholder action)
depositInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = depositInput.valueAsNumber

        const operation = {
            value,
            operation: "deposit",
            meta: registro
        }

        const response = await fetch("http://localhost:3333/historico", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ operation })
        }).then(response => response.json())

        getTotalBalances()

        alert(response.message)

        depositInput.blur();
    }
});
withdrawInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = withdrawInput.valueAsNumber

        const operation = {
            value,
            operation: "withdraw",
            meta: registro
        }

        const response = await fetch("http://localhost:3333/historico", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ operation })
        }).then(response => response.json())

        getTotalBalances()

        alert(response.message)

        withdrawInput.blur();
    }
});

// pegando o saldo total guardado no banco
async function getTotalBalances() {
    const balances = await fetch("http://localhost:3333/saldo").then(response => response.json())

    console.log(balances)
}
/* =======================
    Init UI state
    ======================= */
(function init() {
    // keep hrTop visible
    hrTop.style.display = '';
    // form meta hidden by default
    formMeta.style.display = 'none';
    // deposit/withdraw forms hidden
    depositForm.classList.remove('active');
    withdrawForm.classList.remove('active');
    depositBtn.classList.remove('active');
    withdrawBtn.classList.remove('active');
    depositForm.setAttribute('aria-hidden', 'true');
    withdrawForm.setAttribute('aria-hidden', 'true');
    createMetaTag()
    getTotalBalances()

    // set meta section visibility according to checked radio
    const checked = document.querySelector('input[name="opcao"]:checked');
    if (checked && checked.value === 'economizar') {
        showMetaSection(false);
    } else {
        showMetaSection(true);
    }
})();