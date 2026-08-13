// 🔴 =============== TRATA QUALQUER ERRO DE JAVASCRIPT NA PÁGINA ===============
window.onerror = function(message, source, lineno, colno, error) {
    try {
        alert(
            '❌ ERRO NO JAVASCRIPT:\n\n' +
            'Mensagem: ' + message + '\n' +
            'Linha: ' + lineno + ' | Coluna: ' + colno + '\n\n' +
            'Por favor: tire um print dessa tela e me envie.\n\n' +
            'Dica: provavelmente eh o Supabase que nao foi configurado ainda.'
        );
    } catch(e) {}
    console.error('ERRO JS:', message, source, lineno, colno, error);
};
window.addEventListener('unhandledrejection', function(promiseErr) {
    try {
        alert('❌ ERRO ASSINCRONO (Promise):\n\n' + (promiseErr.reason?.message || promiseErr.reason || promiseErr));
    } catch(e){}
});

// ==================== CONFIGURAÇÕES SUPABASE ====================
const SUPABASE_URL = "https://wcoxenaodhqnugrbmflk.supabase.co";
const SUPABASE_KEY = "sb_publishable_aqgSyFe4DNHLDepj03BAvQ_f9GzjNDL";

// ==================== DADOS EM MEMÓRIA ====================
let transacoes = [];
let previsoes = [];
let usuarioAtual = null;
let supabase = null;

// ==================== 1. AUTENTICAÇÃO ====================

// 👉 Alterna para BLOCO DE LOGIN (esconde cadastro, mostra login)
function mostrarLogin(e) {
    if (e) { try { e.preventDefault(); } catch(x){} try { e.stopPropagation(); } catch(x){} }
    try {
        document.getElementById('blocoLogin').style.display    = 'block';
        document.getElementById('blocoCadastro').style.display = 'none';
        // limpa msgs
        const mL = document.getElementById('loginMsg');
        const mC = document.getElementById('cadastroMsg');
        if (mL) { mL.textContent=''; mL.removeAttribute('style'); }
        if (mC) { mC.textContent=''; mC.removeAttribute('style'); }
    } catch(err) {
        alert('Erro mostrarLogin: ' + err.message);
    }
    return false;
}

// 👉 Alterna para BLOCO DE CADASTRO (esconde login, mostra cadastro)
function mostrarCadastro(e) {
    if (e) { try { e.preventDefault(); } catch(x){} try { e.stopPropagation(); } catch(x){} }
    try {
        document.getElementById('blocoLogin').style.display    = 'none';
        document.getElementById('blocoCadastro').style.display = 'block';
        const mL = document.getElementById('loginMsg');
        const mC = document.getElementById('cadastroMsg');
        if (mL) { mL.textContent=''; mL.removeAttribute('style'); }
        if (mC) { mC.textContent=''; mC.removeAttribute('style'); }
    } catch(err) {
        alert('Erro mostrarCadastro: ' + err.message);
    }
    return false;
}

// 👉 MOSTRA A TELA DE LOGIN (esconde app)
function mostrarAuth() {
    const telaAuth = document.getElementById('telaAuth');
    const telaApp = document.getElementById('telaApp');
    if (!telaAuth || !telaApp) return;
    telaAuth.style.display = '';
    telaAuth.classList.remove('oculto');
    telaApp.style.display = 'none';
    telaApp.classList.add('oculto');
}

// 👉 MOSTRA A TELA DO APP (esconde login)
function mostrarApp() {
    const telaAuth = document.getElementById('telaAuth');
    const telaApp = document.getElementById('telaApp');
    if (!telaAuth || !telaApp) return;
    telaAuth.style.display = 'none';
    telaAuth.classList.add('oculto');
    telaApp.style.display = '';
    telaApp.classList.remove('oculto');
    const elUser = document.getElementById('userEmail');
    if (elUser) elUser.textContent = usuarioAtual?.email || '';
}

// 👉 Submit do formLogin
async function submitLogin(e) {
    e.preventDefault();
    if (!supabase) return alert('❌ Supabase não iniciou. Recarregue a página.');
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const msg = document.getElementById('loginMsg');
    if (!email || !senha) return;
    msg.textContent = '🔐 Entrando...';
    msg.style.color = '#34d399';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
        msg.textContent = '❌ ' + error.message;
        msg.style.color = '#f87171';
    } else {
        msg.textContent = '';
    }
}

// 👉 Submit do formCadastro
async function submitCadastro(e) {
    e.preventDefault();
    if (!supabase) return alert('❌ Supabase não iniciou. Recarregue a página.');
    const nome     = document.getElementById('cadastroNome').value.trim();
    const telefone = document.getElementById('cadastroTelefone').value.trim();
    const email    = document.getElementById('cadastroEmail').value.trim();
    const senha    = document.getElementById('cadastroSenha').value;
    const msg      = document.getElementById('cadastroMsg');

    // Validações
    if (nome.length < 3) {
        msg.textContent = '❌ Preencha seu nome (mínimo 3 letras)';
        msg.style.color = '#f87171'; return;
    }
    if (telefone.length < 10) {
        msg.textContent = '❌ Preencha seu telefone completo (com DDD)';
        msg.style.color = '#f87171'; return;
    }
    if (!email.includes('@') || !email.includes('.')) {
        msg.textContent = '❌ Digite um email válido';
        msg.style.color = '#f87171'; return;
    }
    if (senha.length < 6) {
        msg.textContent = '❌ Senha deve ter pelo menos 6 caracteres';
        msg.style.color = '#f87171'; return;
    }

    msg.style.color = '#34d399';
    msg.textContent = '✨ Criando sua conta...';

    const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, telefone } }
    });

    if (error) {
        msg.textContent = '❌ ' + error.message;
        msg.style.color = '#f87171';
        return;
    }

    if (data?.session?.user) {
        msg.textContent = '✅ Conta criada com sucesso! Entrando...';
        msg.style.color = '#10b981';
    } else {
        msg.textContent = '✅ Conta criada! Agora faça login com seus dados ali em cima. (Se pediu confirmação de email, desligue no Supabase)';
        msg.style.color = '#10b981';
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginSenha').value = senha;
        // Automaticamente mostra o login depois de 2 segundos
        setTimeout(mostrarLogin, 2000);
    }
}

async function fazerLogout() {
    if (supabase) await supabase.auth.signOut();
}

// ==================== 2. CARREGAR DADOS DA NUVEM ====================
async function carregarDados() {
    if (!usuarioAtual || !supabase) return;

    try {
        const { data: tData, error: tErr } = await supabase
            .from('transacoes')
            .select('*')
            .order('data', { ascending: false });
        if (!tErr) transacoes = tData || [];

        const { data: pData, error: pErr } = await supabase
            .from('previsoes')
            .select('*')
            .order('data', { ascending: false });
        if (!pErr) previsoes = pData || [];
    } catch(e) {
        console.warn('carregarDados excecao:', e);
    }

    atualizarUI();
}

function nextId(array) {
    const max = array.reduce((m, x) => Math.max(m, x.id || 0), 0);
    return max + 1;
}

// ==================== 3. UI ====================
function inicializarUI() {
    try { document.getElementById('data').valueAsDate = new Date(); } catch(e){}
    try { document.getElementById('dataPrevisao').valueAsDate = new Date(); } catch(e){}

    // ====== FORMS DE LOGIN / CADASTRO ======
    const fLogin = document.getElementById('formLogin');
    if (fLogin) fLogin.addEventListener('submit', submitLogin);

    const fCad = document.getElementById('formCadastro');
    if (fCad) fCad.addEventListener('submit', submitCadastro);

    // ====== LINKS P/ ALTERNAR ENTRE LOGIN E CADASTRO ======
    const linkLogin = document.getElementById('linkIrLogin');
    const linkCad   = document.getElementById('linkIrCadastro');
    if (linkLogin) {
        linkLogin.onclick = mostrarLogin;
        try { linkLogin.addEventListener('click', mostrarLogin, true); } catch(e){}
    }
    if (linkCad) {
        linkCad.onclick = mostrarCadastro;
        try { linkCad.addEventListener('click', mostrarCadastro, true); } catch(e){}
    }

    // Abas do app (Transações / Previsões / Investimentos)
    document.querySelectorAll('.aba').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aba').forEach(b => b.classList.remove('ativa'));
            document.querySelectorAll('.conteudo-aba').forEach(c => c.classList.remove('ativa'));
            btn.classList.add('ativa');
            try {
                document.getElementById('aba-' + btn.dataset.aba).classList.add('ativa');
            } catch(e) {}
        });
    });

    // Filtros
    const filtro = document.getElementById('filtro');
    if (filtro) filtro.addEventListener('change', renderTransacoes);
    const filtroPrev = document.getElementById('filtroPrevisoes');
    if (filtroPrev) filtroPrev.addEventListener('change', renderPrevisoes);

    // Formulários do app
    const formT = document.getElementById('formTransacao');
    if (formT) formT.addEventListener('submit', adicionarTransacao);
    const formP = document.getElementById('formPrevisao');
    if (formP) formP.addEventListener('submit', adicionarPrevisao);
    const formE = document.getElementById('formEdicao');
    if (formE) formE.addEventListener('submit', salvarEdicao);
    const btnSim = document.getElementById('btnSimular');
    if (btnSim) btnSim.addEventListener('click', simularInvestimento);
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
    try { document.getElementById('totalEntradas').textContent = formatarMoeda(entradas); } catch(e){}
    try { document.getElementById('totalSaidas').textContent = formatarMoeda(saidas); } catch(e){}
    try { document.getElementById('saldoTotal').textContent = formatarMoeda(entradas - saidas); } catch(e){}

    const eP = previsoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0);
    const sP = previsoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0);
    try { document.getElementById('totalEntradasPrevistas').textContent = formatarMoeda(eP); } catch(e){}
    try { document.getElementById('totalSaidasPrevistas').textContent = formatarMoeda(sP); } catch(e){}
    try { document.getElementById('saldoPrevisto').textContent = formatarMoeda(eP - sP); } catch(e){}
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
    if (error) { alert('Erro: ' + error.message); return; }
    transacoes.unshift(nova);
    e.target.reset();
    document.getElementById('data').valueAsDate = new Date();
    atualizarResumo();
    renderTransacoes();
}

function renderTransacoes() {
    const filtroEl = document.getElementById('filtro');
    let lista = transacoes.slice();
    let filtro = filtroEl?.value || 'todas';

    if (filtro === 'entradas') lista = lista.filter(t => t.tipo === 'entrada');
    else if (filtro === 'saidas') lista = lista.filter(t => t.tipo === 'saida');
    else if (filtro === 'fixos') lista = lista.filter(t => t.categoria === 'fixo');
    else if (filtro === 'variaveis') lista = lista.filter(t => t.categoria === 'variavel');

    const ul = document.getElementById('listaTransacoes');
    if (!ul) return;
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
    const filtroEl = document.getElementById('filtroPrevisoes');
    let lista = previsoes.slice();
    let filtro = filtroEl?.value || 'todas';

    if (filtro === 'entradas') lista = lista.filter(t => t.tipo === 'entrada');
    else if (filtro === 'saidas') lista = lista.filter(t => t.tipo === 'saida');
    else if (filtro === 'fixos') lista = lista.filter(t => t.categoria === 'fixo');
    else if (filtro === 'variaveis') lista = lista.filter(t => t.categoria === 'variavel');

    const ul = document.getElementById('listaPrevisoes');
    if (!ul) return;
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
    const tipoEnt = document.getElementById('editTipoEntrada');
    const tipoSai = document.getElementById('editTipoSaida');
    if (item.tipo === 'entrada' && tipoEnt) tipoEnt.checked = true;
    if (item.tipo === 'saida' && tipoSai) tipoSai.checked = true;
    const catFixo = document.getElementById('editCategoriaFixo');
    const catVar = document.getElementById('editCategoriaVariavel');
    if (item.categoria === 'fixo' && catFixo) catFixo.checked = true;
    if (item.categoria === 'variavel' && catVar) catVar.checked = true;

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

try {
    document.querySelector('.modal-fundo').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-fundo')) fecharModal();
    });
} catch(e) {}

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
    if (!tbody) return;
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

    try { document.getElementById('valorFinal').textContent = formatarMoeda(saldo); } catch(e){}
    try { document.getElementById('totalInvestido').textContent = formatarMoeda(totalInvestido); } catch(e){}
    try { document.getElementById('totalRendimento').textContent = formatarMoeda(saldo - totalInvestido); } catch(e){}
    try { document.getElementById('resultadoInvestimento').style.display = 'block'; } catch(e){}
}

function escape(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// =============================================
// START
// =============================================
async function inicializarApp() {
    try {
        console.log('▶️ inicializarApp() executando...');

        if (!window.supabase || !window.supabase.createClient) {
            alert(
                '❌ ERRO: Biblioteca Supabase não foi carregada!\n\n'
                + 'Possiveis causas:\n'
                + '1) Voce esta sem internet\n'
                + '2) O CDN do Supabase (cdn.jsdelivr.net) esta bloqueado na sua rede\n\n'
                + 'Recarregue a pagina (F5) ou tente em outra rede.'
            );
            return;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true }
        });

        if ('serviceWorker' in navigator) {
            try { await navigator.serviceWorker.register('service-worker.js'); }
            catch(e) { console.warn('SW não carregou:', e); }
        }

        inicializarUI();

        let sessaoExiste = false;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                usuarioAtual = session.user;
                mostrarApp();
                sessaoExiste = true;
                await carregarDados();
            } else {
                mostrarAuth();
            }
        } catch (eSession) {
            console.warn('getSession erro:', eSession);
            mostrarAuth();
        }

        try {
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔄 Supabase auth evento:', event, '| usuario:', session?.user?.email || null);
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
        } catch (eListen) {
            console.warn('onAuthStateChange erro:', eListen);
        }

        console.log('✅ inicializarApp() finalizado. | sessao:', sessaoExiste);
    } catch (eGeral) {
        alert(
            '❌ ERRO GERAL NO inicializarApp:\n\n'
            + (eGeral?.message || String(eGeral)) + '\n\n'
            + 'Recarregue a pagina. Se persistir, me mande print desse erro!'
        );
        console.error('inicializarApp geral:', eGeral);
    }
}

document.addEventListener('DOMContentLoaded', inicializarApp);
