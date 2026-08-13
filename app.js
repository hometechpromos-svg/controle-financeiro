// ==================== CONFIGURAÇÕES SUPABASE ====================
const SUPABASE_URL = "https://wcoxenaodhqnugrbmflk.supabase.co";
const SUPABASE_KEY = "sb_publishable_aqgSyFe4DNHLDepj03BAvQ_f9GzjNDL";
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
    });
} catch(e) {
    console.error("Erro ao iniciar Supabase:", e);
}

// ==================== DADOS EM MEMÓRIA ====================
let transacoes = [];
let previsoes = [];
let usuarioAtual = null;

// ==================== 1. AUTENTICAÇÃO ====================
function trocarAuthTab(tipo) {
    try {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('ativa'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('ativa'));
        const idTab = tipo === 'login' ? 'tabLogin' : 'tabCadastro';
        const idForm = tipo === 'login' ? 'formLogin' : 'formCadastro';
        const elTab = document.getElementById(idTab);
        const elForm = document.getElementById(idForm);
        if (elTab) elTab.classList.add('ativa');
        if (elForm) elForm.classList.add('ativa');
        const elLoginMsg = document.getElementById('loginMsg');
        const elCadMsg = document.getElementById('cadastroMsg');
        if (elLoginMsg) elLoginMsg.textContent = '';
        if (elCadMsg) elCadMsg.textContent = '';
    } catch(e) {
        console.warn('trocarAuthTab erro:', e);
    }
}

async function inicializarApp() {
    // Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        try { await navigator.serviceWorker.register('service-worker.js'); }
        catch(e) { console.warn('SW não carregou:', e); }
    }

    // Verifica sessão
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        usuarioAtual = session.user;
        mostrarApp();
        await carregarDados();
    } else {
        mostrarAuth();
    }

    // Listener para mudanças de login/logout
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            usuarioAtual = session.user;
            mostrarApp();
            await carregarDados();
        } else if (event === 'SIGNED_OUT') {
            usuarioAtual = null;
            transacoes = [];
            previsoes = [];
            mostrarAuth();
        }
    });

    inicializarUI();
}

function mostrarAuth() {
    const telaAuth = document.getElementById('telaAuth');
    const telaApp = document.getElementById('telaApp');
    telaAuth.style.display = '';
    telaAuth.classList.remove('oculto');
    telaApp.style.display = 'none';
    telaApp.classList.add('oculto');
}

function mostrarApp() {
    const telaAuth = document.getElementById('telaAuth');
    const telaApp = document.getElementById('telaApp');
    telaAuth.style.display = 'none';
    telaAuth.classList.add('oculto');
    telaApp.style.display = '';
    telaApp.classList.remove('oculto');
    document.getElementById('userEmail').textContent = usuarioAtual?.email || '';
}

document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    msg.textContent = 'Entrando...';
    msg.style.color = '#667eea';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { msg.textContent = '❌ ' + error.message; msg.style.color = '#e74c3c'; }
    else msg.textContent = '';
});

document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('cadastroEmail').value.trim();
    const senha = document.getElementById('cadastroSenha').value;
    const senha2 = document.getElementById('cadastroSenha2').value;
    const msg = document.getElementById('cadastroMsg');
    msg.style.color = '#667eea';
    if (senha !== senha2) { msg.textContent = '❌ Senhas diferentes!'; msg.style.color = '#e74c3c'; return; }
    if (senha.length < 6) { msg.textContent = '❌ Senha deve ter pelo menos 6 caracteres'; msg.style.color = '#e74c3c'; return; }
    msg.textContent = 'Criando conta...';
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    if (error) { msg.textContent = '❌ ' + error.message; msg.style.color = '#e74c3c'; }
    else {
        msg.textContent = '✅ Conta criada! Verifique seu email (ou já pode logar se a confirmação estiver desativada)';
        msg.style.color = '#10b981';
    }
});

async function fazerLogout() {
    await supabase.auth.signOut();
}

// ==================== 2. CARREGAR DADOS DA NUVEM ====================
async function carregarDados() {
    if (!usuarioAtual) return;

    // Carrega transações
    const { data: tData, error: tErr } = await supabase
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false });
    if (!tErr) transacoes = tData || [];

    // Carrega previsões
    const { data: pData, error: pErr } = await supabase
        .from('previsoes')
        .select('*')
        .order('data', { ascending: false });
    if (!pErr) previsoes = pData || [];

    atualizarUI();
}

// Gerar ID seguro
function nextId(array) {
    const max = array.reduce((m, x) => Math.max(m, x.id || 0), 0);
    return max + 1;
}

// ==================== 3. UI ====================
function inicializarUI() {
    document.getElementById('data').valueAsDate = new Date();
    document.getElementById('dataPrevisao').valueAsDate = new Date();

    // ==================== ABAS DE AUTENTICAÇÃO (FALLBACK OBRIGATÓRIO!)
    // Clica na aba, não confia no onclick inline do HTML
    const tabLogin = document.getElementById('tabLogin');
    const tabCadastro = document.getElementById('tabCadastro');
    if (tabLogin) {
        tabLogin.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            trocarAuthTab('login');
        }, { capture: true, passive: false });
    }
    if (tabCadastro) {
        tabCadastro.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            trocarAuthTab('cadastro');
        }, { capture: true, passive: false });
    }

    // Abas do app
    document.querySelectorAll('.aba').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aba').forEach(b => b.classList.remove('ativa'));
            document.querySelectorAll('.conteudo-aba').forEach(c => c.classList.remove('ativa'));
            btn.classList.add('ativa');
            document.getElementById('aba-' + btn.dataset.aba).classList.add('ativa');
        });
    });

    // Filtros
    document.getElementById('filtro').addEventListener('change', renderTransacoes);
    document.getElementById('filtroPrevisoes').addEventListener('change', renderPrevisoes);

    // Formulários
    document.getElementById('formTransacao').addEventListener('submit', adicionarTransacao);
    document.getElementById('formPrevisao').addEventListener('submit', adicionarPrevisao);
    document.getElementById('formEdicao').addEventListener('submit', salvarEdicao);
    document.getElementById('btnSimular').addEventListener('click', simularInvestimento);
}

function formatarMoeda(v) {
    const num = Number(v) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarUI() {
    atualizarResumo();
    renderTransacoes();
    renderPrevisoes();
}

function atualizarResumo() {
    const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0);
    const saidas = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0);
    document.getElementById('totalEntradas').textContent = formatarMoeda(entradas);
    document.getElementById('totalSaidas').textContent = formatarMoeda(saidas);
    document.getElementById('saldoTotal').textContent = formatarMoeda(entradas - saidas);

    const eP = previsoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0);
    const sP = previsoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0);
    document.getElementById('totalEntradasPrevistas').textContent = formatarMoeda(eP);
    document.getElementById('totalSaidasPrevistas').textContent = formatarMoeda(sP);
    document.getElementById('saldoPrevisto').textContent = formatarMoeda(eP - sP);
}

// ==================== 4. TRANSAÇÕES ====================
async function adicionarTransacao(e) {
    e.preventDefault();
    if (!usuarioAtual) return alert('Faça login primeiro!');

    const nova = {
        id: nextId(transacoes),
        user_id: usuarioAtual.id,
        descricao: document.getElementById('descricao').value.trim(),
        valor: Number(document.getElementById('valor').value),
        tipo: document.querySelector('input[name="tipo"]:checked').value,
        categoria: document.querySelector('input[name="categoria"]:checked').value,
        data: document.getElementById('data').value
    };

    const { error } = await supabase.from('transacoes').insert([nova]);
    if (error) {
        alert('Erro: ' + error.message);
        return;
    }
    transacoes.unshift(nova);
    e.target.reset();
    document.getElementById('data').valueAsDate = new Date();
    atualizarResumo();
    renderTransacoes();
}

function renderTransacoes() {
    const filtro = document.getElementById('filtro').value;
    let lista = transacoes.slice();

    if (filtro === 'entradas') lista = lista.filter(t => t.tipo === 'entrada');
    else if (filtro === 'saidas') lista = lista.filter(t => t.tipo === 'saida');
    else if (filtro === 'fixos') lista = lista.filter(t => t.categoria === 'fixo');
    else if (filtro === 'variaveis') lista = lista.filter(t => t.categoria === 'variavel');

    const ul = document.getElementById('listaTransacoes');
    ul.innerHTML = lista.length === 0
        ? '<li class="vazio">Nenhuma transação cadastrada</li>'
        : lista.map(itemHtml).join('');
}

function itemHtml(t) {
    const dataBrasil = new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR');
    return `<li class="item-transacao">
        <div class="item-col1">
            <span class="item-descricao">${escape(t.descricao)}</span>
            <div class="item-tags">
                <span class="tag tipo-${t.tipo}">${t.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</span>
                <span class="tag cat-${t.categoria}">${t.categoria === 'fixo' ? '🔒 Fixo' : '🔄 Variável'}</span>
                <span class="tag data">📅 ${dataBrasil}</span>
            </div>
        </div>
        <div class="item-col2">
            <span class="item-valor ${t.tipo}">${t.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(t.valor)}</span>
            <div class="item-acoes">
                <button class="btn-edit" onclick="abrirEdicao(${t.id}, 'transacao')">✏️</button>
                <button class="btn-del" onclick="excluirItem(${t.id}, 'transacao')">🗑️</button>
            </div>
        </div>
    </li>`;
}

async function excluirItem(id, origem) {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    const tabela = origem === 'transacao' ? 'transacoes' : 'previsoes';
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) return alert('Erro: ' + error.message);

    if (origem === 'transacao') transacoes = transacoes.filter(t => t.id !== id);
    else previsoes = previsoes.filter(t => t.id !== id);
    atualizarResumo();
    renderTransacoes();
    renderPrevisoes();
}

// ==================== 5. PREVISÕES ====================
async function adicionarPrevisao(e) {
    e.preventDefault();
    if (!usuarioAtual) return alert('Faça login primeiro!');

    const nova = {
        id: nextId(previsoes),
        user_id: usuarioAtual.id,
        descricao: document.getElementById('descricaoPrevisao').value.trim(),
        valor: Number(document.getElementById('valorPrevisao').value),
        tipo: document.querySelector('input[name="tipoPrevisao"]:checked').value,
        categoria: document.querySelector('input[name="categoriaPrevisao"]:checked').value,
        data: document.getElementById('dataPrevisao').value
    };

    const { error } = await supabase.from('previsoes').insert([nova]);
    if (error) { alert('Erro: ' + error.message); return; }
    previsoes.unshift(nova);
    e.target.reset();
    document.getElementById('dataPrevisao').valueAsDate = new Date();
    atualizarResumo();
    renderPrevisoes();
}

function renderPrevisoes() {
    const filtro = document.getElementById('filtroPrevisoes').value;
    let lista = previsoes.slice();

    if (filtro === 'entradas') lista = lista.filter(t => t.tipo === 'entrada');
    else if (filtro === 'saidas') lista = lista.filter(t => t.tipo === 'saida');
    else if (filtro === 'fixos') lista = lista.filter(t => t.categoria === 'fixo');
    else if (filtro === 'variaveis') lista = lista.filter(t => t.categoria === 'variavel');

    const ul = document.getElementById('listaPrevisoes');
    ul.innerHTML = lista.length === 0
        ? '<li class="vazio">Nenhuma previsão cadastrada</li>'
        : lista.map(itemHtml).join('');
}

// ==================== 6. EDIÇÃO ====================
function abrirEdicao(id, origem) {
    const arr = origem === 'transacao' ? transacoes : previsoes;
    const item = arr.find(x => x.id === id);
    if (!item) return;

    document.getElementById('modalTitulo').textContent = origem === 'transacao' ? 'Editar Transação' : 'Editar Previsão';
    document.getElementById('editId').value = id;
    document.getElementById('editOrigem').value = origem;
    document.getElementById('editDescricao').value = item.descricao;
    document.getElementById('editValor').value = item.valor;
    document.getElementById('editData').value = item.data;
    document.getElementById('editTipo' + (item.tipo === 'entrada' ? 'Entrada' : 'Saida')).checked = true;
    document.getElementById('editCategoria' + (item.categoria === 'fixo' ? 'Fixo' : 'Variavel')).checked = true;

    document.getElementById('modalEdicao').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modalEdicao').style.display = 'none';
}

async function salvarEdicao(e) {
    e.preventDefault();
    const id = Number(document.getElementById('editId').value);
    const origem = document.getElementById('editOrigem').value;
    const tabela = origem === 'transacao' ? 'transacoes' : 'previsoes';

    const dados = {
        descricao: document.getElementById('editDescricao').value.trim(),
        valor: Number(document.getElementById('editValor').value),
        tipo: document.querySelector('input[name="editTipo"]:checked').value,
        categoria: document.querySelector('input[name="editCategoria"]:checked').value,
        data: document.getElementById('editData').value
    };

    const { error } = await supabase.from(tabela).update(dados).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }

    let arr = origem === 'transacao' ? transacoes : previsoes;
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...dados };

    fecharModal();
    atualizarResumo();
    renderTransacoes();
    renderPrevisoes();
}

document.querySelector('.modal-fundo').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-fundo')) fecharModal();
});

// ==================== 7. INVESTIMENTOS ====================
function simularInvestimento() {
    const inicial = Number(document.getElementById('valorInicial').value) || 0;
    const aporte = Number(document.getElementById('aporteMensal').value) || 0;
    const percCdi = Number(document.getElementById('percentualCDI').value) || 100;
    const cdiAnual = Number(document.getElementById('cdiAnual').value) || 11.75;
    const meses = Number(document.getElementById('mesesRendimento').value) || 1;

    const taxaCdiMensal = Math.pow(1 + (cdiAnual / 100), 1 / 12) - 1;
    const taxaReal = taxaCdiMensal * (percCdi / 100);

    const tbody = document.querySelector('#tabelaMeses tbody');
    tbody.innerHTML = '';
    let saldo = inicial;
    let totalInvestido = inicial;

    for (let m = 1; m <= meses; m++) {
        const inicialMes = saldo;
        const rendimento = saldo * taxaReal;
        saldo += rendimento + aporte;
        totalInvestido += aporte;

        tbody.innerHTML += `<tr>
            <td>${m}º</td>
            <td>${formatarMoeda(inicialMes)}</td>
            <td>${formatarMoeda(aporte)}</td>
            <td class="positivo">+ ${formatarMoeda(rendimento)}</td>
            <td><strong>${formatarMoeda(saldo)}</strong></td>
        </tr>`;
    }

    document.getElementById('valorFinal').textContent = formatarMoeda(saldo);
    document.getElementById('totalInvestido').textContent = formatarMoeda(totalInvestido);
    document.getElementById('totalRendimento').textContent = formatarMoeda(saldo - totalInvestido);
    document.getElementById('resultadoInvestimento').style.display = 'block';
}

// ==================== UTILS ====================
function escape(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Start
inicializarApp();
