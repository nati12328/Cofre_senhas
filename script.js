
const STORAGE_KEY = "cofre_digital_demo_v1";

const form = document.getElementById("formCadastro");
const lista = document.getElementById("lista");
const total = document.getElementById("total");
const toast = document.getElementById("toast");
const limparTudo = document.getElementById("limparTudo");

let registros = carregarRegistros();
let toastTimer;

function carregarRegistros() {
    try {
        const dados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

        if (!Array.isArray(dados)) return [];

        return dados.filter(item =>
            item &&
            typeof item.id === "string" &&
            typeof item.servico === "string" &&
            typeof item.usuario === "string" &&
            typeof item.salt === "string" &&
            typeof item.hash === "string"
        );
    } catch {
        return [];
    }
}

function salvarRegistros() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
        return true;
    } catch {
        mostrarMensagem(
            "Não foi possível salvar os dados neste navegador.",
            true
        );
        return false;
    }
}

function mostrarMensagem(mensagem, erro = false) {
    clearTimeout(toastTimer);

    toast.textContent = mensagem;
    toast.classList.toggle("error", erro);
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function gerarSalt() {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    return Array.from(salt, byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

function textoParaBytes(texto) {
    return new TextEncoder().encode(texto);
}

function bytesParaHex(bytes) {
    return Array.from(bytes, byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

async function gerarHash(senha, saltHex) {
    const salt = new Uint8Array(
        saltHex.match(/.{2}/g).map(byte => parseInt(byte, 16))
    );

    const chave = await crypto.subtle.importKey(
        "raw",
        textoParaBytes(senha),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );

    const resultado = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 600000,
            hash: "SHA-256"
        },
        chave,
        256
    );

    return bytesParaHex(new Uint8Array(resultado));
}

async function cadastrar(evento) {
    evento.preventDefault();

    if (!crypto.subtle) {
        mostrarMensagem(
            "Abra o projeto em localhost ou HTTPS para usar a Web Crypto API.",
            true
        );
        return;
    }

    const servico = document.getElementById("servico").value.trim();
    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value;

    if (!servico || !usuario || !senha) {
        mostrarMensagem("Preencha todos os campos.", true);
        return;
    }

    const duplicado = registros.some(
        item => item.servico.toLocaleLowerCase("pt-BR") ===
            servico.toLocaleLowerCase("pt-BR")
    );

    if (duplicado) {
        mostrarMensagem("Esse serviço já está cadastrado.", true);
        return;
    }

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = "Gerando hash...";

    try {
        const salt = gerarSalt();
        const hash = await gerarHash(senha, salt);

        const novoRegistro = {
            id: crypto.randomUUID(),
            servico,
            usuario,
            salt,
            hash
        };

        registros.push(novoRegistro);

        if (!salvarRegistros()) {
            registros.pop();
            return;
        }

        form.reset();
        renderizarRegistros();
        mostrarMensagem("Cadastro realizado com sucesso!");
    } catch (erro) {
        mostrarMensagem("Não foi possível gerar o hash.", true);
    } finally {
        botao.disabled = false;
        botao.innerHTML = 'Gerar hash e cadastrar <span>→</span>';
    }
}

async function verificarRegistro(id) {
    const registro = registros.find(item => item.id === id);

    if (!registro) return;

    const senha = prompt(
        `Digite a senha para verificar o serviço "${registro.servico}":`
    );

    if (senha === null) return;

    try {
        const hashCalculado = await gerarHash(senha, registro.salt);

        if (hashCalculado === registro.hash) {
            mostrarMensagem("Senha correta! Hash confirmado.");
        } else {
            mostrarMensagem("Senha incorreta.", true);
        }
    } catch {
        mostrarMensagem("Erro ao verificar a senha.", true);
    }
}

function excluirRegistro(id) {
    const registro = registros.find(item => item.id === id);

    if (!registro) return;

    const confirmar = window.confirm(
        `Deseja excluir o cadastro "${registro.servico}"?`
    );

    if (!confirmar) return;

    const anteriores = registros;
    registros = registros.filter(item => item.id !== id);

    if (!salvarRegistros()) {
        registros = anteriores;
        return;
    }

    renderizarRegistros();
    mostrarMensagem("Cadastro excluído.");
}

function criarBotao(texto, classe, acao) {
    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = `small-button ${classe}`;
    botao.textContent = texto;
    botao.addEventListener("click", acao);

    return botao;
}

function renderizarRegistros() {
    total.textContent = registros.length;
    lista.replaceChildren();

    if (registros.length === 0) {
        const vazio = document.createElement("div");
        vazio.className = "empty-state";

        const icone = document.createElement("span");
        icone.className = "empty-icon";
        icone.textContent = "🔒";

        const titulo = document.createElement("h3");
        titulo.textContent = "Seu cofre está vazio";

        const descricao = document.createElement("p");
        descricao.textContent = "Cadastre um serviço para começar.";

        vazio.append(icone, titulo, descricao);
        lista.appendChild(vazio);
        return;
    }

    for (const registro of registros) {
        const cartao = document.createElement("article");
        cartao.className = "entry";

        const topo = document.createElement("div");
        topo.className = "entry-top";

        const informacoes = document.createElement("div");

        const titulo = document.createElement("h3");
        titulo.textContent = registro.servico;

        const usuario = document.createElement("p");
        usuario.className = "username";
        usuario.textContent = registro.usuario;

        informacoes.append(titulo, usuario);
        topo.appendChild(informacoes);

        const selo = document.createElement("span");
        selo.className = "section-label";
        selo.textContent = "SHA-256";
        topo.appendChild(selo);

        const legenda = document.createElement("span");
        legenda.className = "hash-label";
        legenda.textContent = "HASH ARMAZENADO";

        const hash = document.createElement("code");
        hash.className = "hash-value";
        hash.textContent = registro.hash;

        const acoes = document.createElement("div");
        acoes.className = "entry-actions";

        acoes.append(
            criarBotao("Verificar senha", "", () =>
                verificarRegistro(registro.id)
            ),
            criarBotao("Excluir", "delete", () =>
                excluirRegistro(registro.id)
            )
        );

        cartao.append(topo, legenda, hash, acoes);
        lista.appendChild(cartao);
    }
}

form.addEventListener("submit", cadastrar);

limparTudo.addEventListener("click", () => {
    if (registros.length === 0) {
        mostrarMensagem("O cofre já está vazio.", true);
        return;
    }

    if (!window.confirm("Deseja excluir todos os registros?")) {
        return;
    }

    const anteriores = registros;
    registros = [];

    if (!salvarRegistros()) {
        registros = anteriores;
        return;
    }

    renderizarRegistros();
    mostrarMensagem("Todos os registros foram excluídos.");
});

document.querySelectorAll(".toggle-password").forEach(botao => {
    botao.addEventListener("click", () => {
        const campo = document.getElementById(botao.dataset.target);
        const mostrar = campo.type === "password";

        campo.type = mostrar ? "text" : "password";
        botao.textContent = mostrar ? "Ocultar" : "Mostrar";
        botao.setAttribute(
            "aria-label",
            mostrar ? "Ocultar senha" : "Mostrar senha"
        );
    });
});

renderizarRegistros();
