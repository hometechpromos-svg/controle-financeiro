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
// TROCA DE ABAS — 100% INLINE, NÃO PASSA POR NENHUMA FUNÇÃO PARA NÃO FALHAR!
function trocarAuthTab(tipo) {
    try {
        const ehLogin = (tipo === 'login');

        // ============== GET ELEMENTOS DIRETOS ==============
        const tabLogin     = document.getElementById('tabLogin');
        const tabCadastro  = document.getElementById('tabCadastro');
        const formLogin    = document.getElementById('formLogin');
        const formCadastro = document.getElementById('formCadastro');

        if (!tabLogin || !tabCadastro || !formLogin || !formCadastro) {
            alert('❌ ERRO CRÍTICO: Elementos da tela de login não encontrados! Recarregue a página.');
            return;
        }

        // ============== 1º PASSO: SEMPRE ESCONDE OS DOIS FORMULÁRIOS PRIMEIRO ==============
        // Assim não tem lógica de quem é quem, garante estado limpo.
        formLogin.hidden = true;
        formLogin.setAttribute('hidden', '');
        formLogin.style.setProperty('display', 'none', 'important');
        formLogin.style.setProperty('visibility', 'hidden', 'important');
        formLogin.style.setProperty('opacity', '0', 'important');
        formLogin.style.setProperty('height', '0', 'important');
        formLogin.style.setProperty('overflow', 'hidden', 'important');
        formLogin.className = 'auth-form';

        formCadastro.hidden = true;
        formCadastro.setAttribute('hidden', '');
        formCadastro.style.setProperty('display', 'none', 'important');
        formCadastro.style.setProperty('visibility', 'hidden', 'important');
        formCadastro.style.setProperty('opacity', '0', 'important');
        formCadastro.style.setProperty('height', '0', 'important');
        formCadastro.style.setProperty('overflow', 'hidden', 'important');
        formCadastro.className = 'auth-form';

        // ============== 2º PASSO: ABAS (sempre remove ativa primeiro) ==============
        tabLogin.className    = 'auth-tab';
        tabCadastro.className = 'auth-tab';
        tabLogin.style.removeProperty('background-color');
        tabCadastro.style.removeProperty('background-color');

        // ============== 3º PASSO: MOSTRA SOMENTE O QUE PEDIRAM ==============
        if (ehLogin) {
            tabLogin.className = 'auth-tab ativa';
            formLogin.hidden = false;
            formLogin.removeAttribute('hidden');
            formLogin.style.setProperty('display', 'block', 'important');
            formLogin.style.setProperty('visibility', 'visible', 'important');
            formLogin.style.setProperty('opacity', '1', 'important');
            formLogin.style.setProperty('height', 'auto', 'important');
            formLogin.style.setProperty('overflow', 'visible', 'important');
            formLogin.className = 'auth-form ativa';
        } else {
            tabCadastro.className = 'auth-tab ativa';
            formCadastro.hidden = false;
            formCadastro.removeAttribute('hidden');
            formCadastro.style.setProperty('display', 'block', 'important');
            formCadastro.style.setProperty('visibility', 'visible', 'important');
            formCadastro.style.setProperty('opacity', '1', 'important');
            formCadastro.style.setProperty('height', 'auto', 'important');
            formCadastro.style.setProperty('overflow', 'visible', 'important');
            formCadastro.className = 'auth-form ativa';
        }

        // ============== 4º: Limpa mensagens ==============
        const mLogin = document.getElementById('loginMsg');
        const mCad  = document.getElementById('cadastroMsg');
        if (mLogin) { mLogin.textContent = ''; mLogin.removeAttribute('style'); }
        if (mCad)   { mCad.textContent = '';   mCad.removeAttribute('style'); }

        console.log('[OK] Trocou para aba:', tipo);

    } catch(e) {
        console.warn('trocarAuthTab ERRO:', e);
        alert('❌ Erro ao trocar aba: ' + e.message);
    }
}

// ==================== CRIAR CONTA ADMIN (PRÉ-DEFINIDA — 1 clique)
async function criarContaAdmin() {
    const btn = document.getElementById('btnCriarAdmin');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '⏳ Criando conta admin...'; }
    const msg = document.getElementById('loginMsg');
    msg.textContent = '✨ Criando conta admin...';
    msg.style.color = '#34d399';

    const { data, error } = await supabase.auth.signUp({
        email: 'admin@financas.app',
        password: 'admin123',
        options: { data: { nome: 'Admin Finanças', telefone: '(11) 99999-9999', admin: true } }
    });

    if (error) {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '🚀 Criar minha conta Admin agora'; }
        if (error.message.includes('already') || error.message.includes('usuário') || error.message.includes('User')) {
            msg.textContent = '✅ Conta admin JÁ EXISTE! Use → admin@financas.app / admin123 para entrar.';
            msg.style.color = '#10b981';
            // Pré-preenche os campos
            document.getElementById('loginEmail').value = 'admin@financas.app';
            document.getElementById('loginSenha').value = 'admin123';
        } else {
            msg.textContent = '❌ Erro: ' + error.message;
            msg.style.color = '#f87171';
        }
        return;
    }

    // Sucesso
    if (data?.session?.user) {
        msg.textContent = '✅ Conta admin criada! Entrando automaticamente...';
        msg.style.color = '#10b981';
    } else {
        msg.textContent = '✅ Conta admin criada! Agora faça login: email=admin@financas.app / senha=admin123';
        msg.style.color = '#10b981';
        document.getElementById('loginEmail').value = 'admin@financas.app';
        document.getElementById('loginSenha').value = 'admin123';
        if (btn) {
            btn.textContent = '✅ Conta admin pronta! Já pode entrar.';
            btn.style.opacity = '1';
            btn.style.backgroundColor = '#052e1c';
            btn.disabled = true;
        }
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
    msg.textContent = '🔐 Entrando...';
    msg.style.color = '#34d399';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { msg.textContent = '❌ ' + error.message; msg.style.color = '#f87171'; }
    else msg.textContent = '';
});

document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome     = document.getElementById('cadastroNome').value.trim();
    const telefone = document.getElementById('cadastroTelefone').value.trim();
    const email    = document.getElementById('cadastroEmail').value.trim();
    const senha    = document.getElementById('cadastroSenha').value;
    const msg      = document.getElementById('cadastroMsg');

    // ===== Validações básicas =====
    if (nome.length < 3) {
        msg.textContent = '❌ Preencha seu nome (mínimo 3 letras)';
        msg.style.color = '#f87171';
        return;
    }
    if (telefone.length < 10) {
        msg.textContent = '❌ Preencha seu telefone completo (com DDD)';
        msg.style.color = '#f87171';
        return;
    }
    if (!email.includes('@') || !email.includes('.')) {
        msg.textContent = '❌ Digite um email válido';
        msg.style.color = '#f87171';
        return;
    }
    if (senha.length < 6) {
        msg.textContent = '❌ Senha deve ter pelo menos 6 caracteres';
        msg.style.color = '#f87171';
        return;
    }

    msg.style.color = '#34d399';
    msg.textContent = '✨ Criando sua conta...';

    // ===== Cria o usuário no Supabase (salva NOME + TELEFONE nos metadata!) =====
    const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
            data: {
                nome: nome,
                telefone: telefone
            }
        }
    });

    if (error) {
        msg.textContent = '❌ ' + error.message;
        msg.style.color = '#f87171';
        return;
    }

    // Conta criada com sucesso!
    if (data?.session?.user) {
        // Se o usuário já logou automaticamente (confirmação de email desligada)
        msg.textContent = '✅ Conta criada! Entrando...';
        msg.style.color = '#10b981';
    } else {
        msg.textContent = '✅ Conta criada! Verifique seu email para confirmar (ou já pode entrar se a confirmação estiver desativada no Supabase)';
        msg.style.color = '#10b981';
        setTimeout(() => trocarAuthTab('login'), 2500); // ← automaticamente VOLTA PRO LOGIN DEPOIS DE CRIAR!
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

    // ==================== ABAS DE AUTENTICAÇÃO — ATRELAMENTO DIRETO!
    // Faz o BOTÃO CHAMAR A FUNÇÃO. Zero intermediários.
    const tabLogin = document.getElementById('tabLogin');
    const tabCadastro = document.getElementById('tabCadastro');
    const btnAdmin = document.getElementById('btnCriarAdmin');

    if (tabLogin) {
        tabLogin.onclick = function() {
            try { trocarAuthTab('login'); } catch(e){ alert('Erro login: '+e.message); }
            return false;
        };
    }
    if (tabCadastro) {
        tabCadastro.onclick = function() {
            try { trocarAuthTab('cadastro'); } catch(e){ alert('Erro cadastro: '+e.message); }
            return false;
        };
    }
    if (btnAdmin) {
        btnAdmin.onclick = function() {
            try { criarContaAdmin(); } catch(e){ alert('Erro criar admin: '+e.message); }
            return false;
        };
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
