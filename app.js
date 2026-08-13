// ==========================================================
// 🔴 CONTROLE FINANCEIRO — TELEFONE + SENHA (SISTEMA PROPRIO, SEM SUPABASE AUTH)
// Sincroniza em nuvem via Supabase + header customizado "x-telefone-usuario"
// RLS no banco compara user_id (telefone) com o header
// ==========================================================

window.onerror = function(message, source, lineno, colno, error) {
    try {
        alert('❌ ERRO NO JAVASCRIPT:\n\n' +
            'Mensagem: ' + message + '\n' +
            'Linha: ' + lineno + ' | Coluna: ' + colno + '\n\n' +
            'Por favor tire print e me envie.');
    } catch(e) {}
    console.error('ERRO JS:', message, source, lineno, colno, error);
};
window.addEventListener('unhandledrejection', function(p) {
    try { alert('❌ ERRO ASSINCRONO:\n\n' + (p.reason?.message || p.reason || p)); } catch(e){}
});

// ==================== CONFIG ====================
const SUPABASE_URL = "https://wcoxenaodhqnugrbmflk.supabase.co";
const SUPABASE_KEY = "sb_publishable_aqgSyFe4DNHLDepj03BAvQ_f9GzjNDL";
let transacoes = [];
let previsoes = [];
let usuarioAtual = null;  // { telefone: "11987654321", nomeFormatado: "📱 (11) 98765-4321" }
let supabase = null;

// ==================================================
// FUNÇÕES AUXILIARES GLOBAIS
// ==================================================
function limparTelefone(t) {
    return String(t || '').replace(/\D/g, '');
}

function formatarTelefoneParaMostrar(apenasNumeros) {
    const t = String(apenasNumeros || '');
    if (t.length < 10) return t;
    const ddd = t.slice(0, 2);
    const meio = t.slice(2, t.length - 4);
    const fim = t.slice(-4);
    return '📱 (' + ddd + ') ' + meio + '-' + fim;
}

// SHA-256 nativo do navegador (crypto.subtle) — gera hash hex
async function hashSHA256(texto) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(texto || ''));
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const array = Array.from(new Uint8Array(buffer));
    return array.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Wrapper do Supabase que SEMPRE envia o header "x-telefone-usuario"
// (esse header é usado pelas funções do SQL: telefone_usuario_logado / eh_proprio_usuario)
function sb() {
    if (!supabase) return null;
    const t = usuarioAtual?.telefone || '';
    // Cria um cliente "temporario" com os headers customizados
    // A API rpc / select nao deixa passar custom headers diretamente,
    // mas nos INSERTs/UPDATEs podemos incluir user_id = t tambem.
    // Usamos "postgrest.addHeader" hack: setamos globalmente ANTES de cada chamada.
    try {
        supabase.auth.headers = supabase.auth.headers || {};
    } catch(e) {}
    return supabase;
}

// ==================================================
// TROCA DE TELAS (simples e rápido)
// ==================================================
function esconderTodasAsTelasAuth() {
    try {
        const t1 = document.getElementById('tela1Telefone');
        const t2 = document.getElementById('tela2Senha');
        const ta = document.getElementById('telaApp');
        if (t1) { t1.classList.add('oculto'); t1.style.display = 'none'; }
        if (t2) { t2.classList.add('oculto'); t2.style.display = 'none'; }
        if (ta) { ta.classList.add('oculto'); ta.style.display = 'none'; }
    } catch(e) {}
}

window.mostrarTela1Telefone = function mostrarTela1Telefone() {
    esconderTodasAsTelasAuth();
    const t1 = document.getElementById('tela1Telefone');
    if (!t1) return;
    t1.classList.remove('oculto');
    t1.style.display = '';
    try { document.getElementById('telefoneAcesso').focus(); } catch(e){}
};

window.mostrarTela2Senha = function mostrarTela2Senha() {
    esconderTodasAsTelasAuth();
    const t2 = document.getElementById('tela2Senha');
    if (!t2) return;
    t2.classList.remove('oculto');
    t2.style.display = '';
};

window.mostrarTelaApp = function mostrarTelaApp() {
    esconderTodasAsTelasAuth();
    const ta = document.getElementById('telaApp');
    if (!ta) return;
    ta.classList.remove('oculto');
    ta.style.display = '';
    const elUser = document.getElementById('userEmail');
    if (elUser && usuarioAtual) elUser.textContent = usuarioAtual.nomeFormatado || usuarioAtual.telefone;
};

window.voltarParaTelefone = function voltarParaTelefone() {
    // Limpa msgs e campos da senha
    try { document.getElementById('senhaLogin').value = ''; } catch(e){}
    try { document.getElementById('senhaNova1').value = ''; } catch(e){}
    try { document.getElementById('senhaNova2').value = ''; } catch(e){}
    try { document.getElementById('msgSenhaLogin').textContent = ''; document.getElementById('msgSenhaLogin').removeAttribute('style'); } catch(e){}
    try { document.getElementById('msgSenhaCadastro').textContent = ''; document.getElementById('msgSenhaCadastro').removeAttribute('style'); } catch(e){}
    mostrarTela1Telefone();
};

// ==================================================
// ETAPA 1: USUÁRIO DIGITA TELEFONE → VERIFICA SE EXISTE NO SUPABASE
// - Se EXISTE  → Mostra Tela 2A (pede SENHA / login)
// - Se NÃO EXISTE → Mostra Tela 2B (cadastrar SENHA NOVA)
// ==================================================
let telefoneTemporario = '';  // armazena o telefone entre etapa 1 e 2

window.etapa1_verificarTelefone = async function etapa1_verificarTelefone(e) {
    try { if (e && e.preventDefault) e.preventDefault(); } catch(x){}

    if (!supabase) {
        try { document.getElementById('msgTelefone').textContent = '⏳ Carregando sistema... tente novamente em 2s'; } catch(x){}
        return false;
    }

    const inputTel = document.getElementById('telefoneAcesso');
    const msg      = document.getElementById('msgTelefone');
    const telLimpo = limparTelefone(inputTel.value);

    if (telLimpo.length < 10) {
        msg.textContent = '❌ Digite seu telefone completo (com DDD)';
        msg.style.color = '#f87171';
        return false;
    }

    msg.style.color = '#34d399';
    msg.textContent = '🔍 Verificando...';

    try {
        // IMPORTANTE: NÃO TEMOS header ainda (usuario n logado)
        // Então fazemos um SELECT com eq() direto, mas vamos passar o header
        // por meio de um fetch customizado se necessario. Porém:
        // Como temos uma POLITICA que PERMITE INSERT de usuarios pra todos,
        // mas SELECT é só próprio, para VERIFICAR existencia vamos usar RPC
        // ou fazer um "select telefone where telefone = X" — mas RLS vai bloquear.
        //
        // SOLUÇÃO SIMPLES: Criamos uma função SQL "existe_telefone(text)" SECURITY DEFINER
        // que ignora RLS. Mas para não ter que rodar SQL a mais, vamos fazer o seguinte:
        // Tentamos fazer SELECT * de usuarios where telefone = X LIMIT 1.
        // - Se retornar 1 linha → usuário existe (mostra login)
        // - Se retornar 0 linhas → usuário NÃO existe (mostra cadastro de senha)
        // - Se der erro "violação RLS" (pode acontecer) → assumimos que NÃO existe e vamos pro cadastro.
        //
        // MAS MESMO MELHOR: Já que temos POLÍTICA DE INSERT LIBERADA para todos,
        // vamos tentar INSERT com um telefone fake teste? NÃO, vamos implementar:
        // TENTAMOS SELECT, se falhar por qq motivo inclusive RLS,
        // tentamos inserir um registro "placeholder" → se der erro UNIQUE VIOLATION
        // de telefone, então usuário já existe. Se der certo, deletamos e sabemos q é novo.
        //
        // MAS AINDA MAIS SIMPLES (o que vamos fazer aqui):
        // Criamos uma FUNÇÃO RPC no SQL (security definer) = public.verificar_telefone(tel).
        // Mas como queremos que o usuário só rode 1 SQL, usamos o método:
        // SELECT count(*) da view pública → mas por simplicidade, vamos adicionar
        // UM "fallback": tentamos SELECT no Supabase. Se der 1 linha → existe.
        // Se der 0 linhas ou erro RLS → Vamos criar o usuário com hash temporario
        // depois o usuario vai atualizar a senha. Não, melhor:
        //
        // VAMOS FAZER ASSIM (DEFINITIVO):
        // No nosso app, sempre que o usuario digitar telefone,
        // Enviamos um FETCH DIRETO ao endpoint rpc, mas para simplificar,
        // vamos TENTAR SELECT com headers custom. Se retornar linha → existe.
        // Qualquer outro caso → não existe. O cadastro de senha vai tentar INSERT.
        // Se o INSERT falhar com UNIQUE (telefone já existe), tentamos login.

        const tentativa = await tentarSelectUsuarioPorTelefone(telLimpo);

        telefoneTemporario = telLimpo;

        // Preparar tela 2
        const blocoLogin = document.getElementById('blocoSenhaLogin');
        const blocoCad   = document.getElementById('blocoSenhaCadastro');
        const subtitulo  = document.getElementById('txtSubtituloSenha');
        const telFormat  = formatarTelefoneParaMostrar(telLimpo);

        if (tentativa.existe) {
            // USUÁRIO EXISTE → mostra tela de LOGIN com senha
            if (blocoLogin) blocoLogin.style.display = 'block';
            if (blocoCad)   blocoCad.style.display = 'none';
            if (subtitulo)  subtitulo.textContent = telFormat + ' • Digite sua senha';
            try { setTimeout(() => document.getElementById('senhaLogin').focus(), 100); } catch(e){}
        } else {
            // USUÁRIO NOVO → mostra tela de CRIAR SENHA
            if (blocoLogin) blocoLogin.style.display = 'none';
            if (blocoCad)   blocoCad.style.display = 'block';
            if (subtitulo)  subtitulo.textContent = telFormat + ' • Crie sua senha';
            try { setTimeout(() => document.getElementById('senhaNova1').focus(), 100); } catch(e){}
        }

        msg.textContent = '';
        mostrarTela2Senha();
        return false;

    } catch (err) {
        msg.textContent = '❌ Erro: ' + (err?.message || err);
        msg.style.color = '#f87171';
        return false;
    }
};

// Função auxiliar: tenta buscar usuário por telefone
// Retorna { existe: true/false, usuario: {...} ou null }
async function tentarSelectUsuarioPorTelefone(telLimpo) {
    if (!supabase) return { existe: false };
    try {
        // Para esta consulta (verificar se o telefone existe), NÃO queremos RLS
        // Então não enviamos header de usuário logado. A política "Qualquer pessoa pode cadastrar usuário novo"
        // não ajuda no SELECT. Então usamos rpc (função que criamos se existir) ou
        // alternativa: criamos no SQL uma função security definer.
        //
        // Por garantia, vamos tentar os 2 métodos:
        // 1. RPC public.verificar_telefone(tel) - se existir
        // 2. Fallback: SELECT direto +, se falhar, assume não existe, e o INSERT diz se já tem

        try {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('verificar_telefone', { tel: telLimpo });
            if (!rpcErr && (rpcData === true || rpcData === 1 || rpcData === 't')) {
                return { existe: true };
            }
        } catch(erpc) { /* não tem a função, ok */ }

        // Fallback: select direto
        const { data, error } = await supabase
            .from('usuarios')
            .select('telefone, id')
            .eq('telefone', telLimpo)
            .limit(1);

        if (!error && data && data.length > 0) {
            return { existe: true, usuario: data[0] };
        }

        // Se chegar aqui, ou não tem, ou RLS bloqueou → assume NÃO EXISTE
        // No etapa2_cadastrarSenha, se der UNIQUE VIOLATION, sabemos que existe e pedimos login.
        return { existe: false };

    } catch (e) {
        return { existe: false };
    }
}

// ==================================================
// ETAPA 2 - LOGIN: Usuário já existe, digita senha → verificamos hash
// ==================================================
window.etapa2_loginSenha = async function etapa2_loginSenha(e) {
    try { if (e && e.preventDefault) e.preventDefault(); } catch(x){}
    if (!telefoneTemporario) { voltarParaTelefone(); return false; }

    const senhaDigitada = document.getElementById('senhaLogin').value;
    const msg = document.getElementById('msgSenhaLogin');

    if (!senhaDigitada || senhaDigitada.length < 6) {
        msg.textContent = '❌ Senha inválida (mínimo 6 caracteres)';
        msg.style.color = '#f87171';
        return false;
    }

    msg.style.color = '#34d399';
    msg.textContent = '🔐 Verificando senha...';

    try {
        // Hash da senha digitada
        const hashDigitado = await hashSHA256(senhaDigitada);

        // Loga o usuário (define usuarioAtual ANTES do select para passar no RLS)
        usuarioAtual = {
            telefone: telefoneTemporario,
            nomeFormatado: formatarTelefoneParaMostrar(telefoneTemporario)
        };

        // Agora faz SELECT com header custom (via truque: setamos headers globais do PostgREST)
        // Como não temos como adicionar header a cada chamada do client do Supabase,
        // usamos o fetch API DIRETO no endpoint do PostgREST (melhor e mais confiável).
        //
        // Mas para o login, precisamos do select sem header também (vamos por função rpc):
        // Tenta primeiro RPC public.login_senha(tel, hash)
        let loginOk = false;
        try {
            const { data: rpc, error: rErr } = await supabase.rpc('login_senha', { tel: telefoneTemporario, hash_senha: hashDigitado });
            if (!rErr && (rpc === true || rpc === 1 || rpc === 't')) {
                loginOk = true;
            }
        } catch(e) { /* rpc não existe */ }

        if (!loginOk) {
            // Fallback: select direto (provavelmente RLS bloqueia, mas já que o usuarioAtual
            // está definido, podemos tentar um fetch com header customizado)
            loginOk = await loginViaFetchDireto(telefoneTemporario, hashDigitado);
        }

        if (!loginOk) {
            usuarioAtual = null;
            msg.textContent = '❌ Senha incorreta! Tente novamente.';
            msg.style.color = '#f87171';
            return false;
        }

        // DEU CERTO — salva no localStorage e entra no app
        try {
            localStorage.setItem('cf_usuario_atual', JSON.stringify(usuarioAtual));
        } catch(e) {}

        msg.textContent = '✅ Login realizado! Entrando...';
        await carregarDados();
        setTimeout(() => { msg.textContent = ''; mostrarTelaApp(); }, 400);
        return true;

    } catch (err) {
        usuarioAtual = null;
        msg.textContent = '❌ Erro: ' + (err?.message || err);
        msg.style.color = '#f87171';
        return false;
    }
};

// ==================================================
// ETAPA 2 - CADASTRAR: Usuário novo, cria senha, salva hash, faz login automatico
// ==================================================
window.etapa2_cadastrarSenha = async function etapa2_cadastrarSenha(e) {
    try { if (e && e.preventDefault) e.preventDefault(); } catch(x){}
    if (!telefoneTemporario) { voltarParaTelefone(); return false; }

    const s1 = document.getElementById('senhaNova1').value;
    const s2 = document.getElementById('senhaNova2').value;
    const msg = document.getElementById('msgSenhaCadastro');

    if (!s1 || s1.length < 6) {
        msg.textContent = '❌ Senha muito curta (mínimo 6 caracteres)';
        msg.style.color = '#f87171'; return false;
    }
    if (s1 !== s2) {
        msg.textContent = '❌ As senhas estão diferentes!';
        msg.style.color = '#f87171'; return false;
    }

    msg.style.color = '#34d399';
    msg.textContent = '✨ Criando sua conta...';

    try {
        const hashGerado = await hashSHA256(s1);

        // Tenta INSERT. A política permite INSERT para todos (sem header)
        const { data, error } = await supabase
            .from('usuarios')
            .insert([{ telefone: telefoneTemporario, senha_hash: hashGerado }])
            .select('id');

        if (error) {
            // Se for UNIQUE VIOLATION → usuário já existia (provavelmente o SELECT do etapa1 bloqueou por RLS)
            if (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate') || String(error.message || '').toLowerCase().includes('unique')) {
                msg.textContent = '⚠️ Esse telefone já tem cadastro! Digite sua senha:';
                msg.style.color = '#f59e0b';
                // Mostra o bloco de login automaticamente
                setTimeout(() => {
                    const blocoLogin = document.getElementById('blocoSenhaLogin');
                    const blocoCad   = document.getElementById('blocoSenhaCadastro');
                    if (blocoLogin) blocoLogin.style.display = 'block';
                    if (blocoCad)   blocoCad.style.display = 'none';
                    try { document.getElementById('senhaLogin').focus(); } catch(e){}
                }, 900);
                return false;
            }
            throw error;
        }

        // CADASTROU OK → loga automaticamente
        usuarioAtual = {
            telefone: telefoneTemporario,
            nomeFormatado: formatarTelefoneParaMostrar(telefoneTemporario)
        };
        try { localStorage.setItem('cf_usuario_atual', JSON.stringify(usuarioAtual)); } catch(e) {}

        msg.textContent = '✅ Conta criada com sucesso! Entrando...';
        await carregarDados();
        setTimeout(() => { msg.textContent = ''; mostrarTelaApp(); }, 500);
        return true;

    } catch (err) {
        msg.textContent = '❌ Erro ao cadastrar: ' + (err?.message || err);
        msg.style.color = '#f87171';
        return false;
    }
};

// ==================================================
// LOGOUT
// ==================================================
window.fazerLogout = function fazerLogout() {
    if (!confirm('Tem certeza que quer sair?')) return;
    usuarioAtual = null;
    telefoneTemporario = '';
    transacoes = [];
    previsoes = [];
    try { localStorage.removeItem('cf_usuario_atual'); } catch(e){}
    // Limpa inputs
    try { document.getElementById('telefoneAcesso').value = ''; } catch(e){}
    try { document.getElementById('senhaLogin').value = ''; } catch(e){}
    try { document.getElementById('senhaNova1').value = ''; } catch(e){}
    try { document.getElementById('senhaNova2').value = ''; } catch(e){}
    mostrarTela1Telefone();
};

// ==================================================
// FETCH DIRETO (custom headers) para Supabase
// Usamos isso quando precisamos passar o HEADER "x-telefone-usuario"
// (o client JS do Supabase não oferece maneira fácil de adicionar headers custom por requisição)
// ==================================================
async function sbFetch(path, options = {}) {
    const url = SUPABASE_URL + '/rest/v1' + path;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options.headers || {})
    };
    if (usuarioAtual?.telefone) {
        headers['x-telefone-usuario'] = String(usuarioAtual.telefone);
    }
    try {
        const res = await fetch(url, { ...options, headers });
        let body = null;
        try { body = await res.json(); } catch(e) { body = null; }
        if (!res.ok) {
            const errMsg = (body && (body.message || body.error)) || ('HTTP ' + res.status);
            return { data: null, error: { message: errMsg, status: res.status, body: body } };
        }
        return { data: body, error: null };
    } catch (eFetch) {
        return { data: null, error: { message: eFetch?.message || String(eFetch), status: 0 } };
    }
}

async function loginViaFetchDireto(telefone, hashSenha) {
    // Faz SELECT com o header de telefone (para RLS permitir).
    // Se o RLS bloquear SELECT onde telefone != header,
    // vai retornar 0 linhas → sabemos que deu erro se não bateu hash.
    try {
        const t = encodeURIComponent(telefone);
        const r = await sbFetch('/usuarios?telefone=eq.' + t + '&select=senha_hash&limit=1', {
            method: 'GET',
            headers: { 'x-telefone-usuario': String(telefone) }
        });
        if (!r.error && r.data && r.data.length > 0) {
            return String(r.data[0]?.senha_hash || '') === String(hashSenha);
        }
    } catch(e) {}
    return false;
}

// ==================================================
// CARREGAR / SALVAR DADOS (sempre via FETCH DIRETO com header custom!)
// ==================================================
function chaveLocal(arrNome) {
    if (!usuarioAtual) return '';
    return 'cf_' + arrNome + '_' + usuarioAtual.telefone;
}

async function carregarDados() {
    if (!usuarioAtual) return;
    let achouDadosCloud = false;

    try {
        // Carrega transacoes (via fetch direto = header x-telefone-usuario funciona)
        const rT = await sbFetch('/transacoes?select=*&order=data.desc', { method: 'GET' });
        if (!rT.error && Array.isArray(rT.data)) {
            transacoes = rT.data || [];
            achouDadosCloud = true;
        }
    } catch(e) { /* cloud falhou, vai local */ }

    try {
        const rP = await sbFetch('/previsoes?select=*&order=data.desc', { method: 'GET' });
        if (!rP.error && Array.isArray(rP.data)) {
            previsoes = rP.data || [];
            achouDadosCloud = true;
        }
    } catch(e) {}

    if (!achouDadosCloud) {
        try { transacoes = JSON.parse(localStorage.getItem(chaveLocal('transacoes')) || '[]'); } catch(e) { transacoes = []; }
        try { previsoes = JSON.parse(localStorage.getItem(chaveLocal('previsoes')) || '[]'); } catch(e) { previsoes = []; }
    }
    atualizarUI();
}

function salvarLocal() {
    if (!usuarioAtual) return;
    try { localStorage.setItem(chaveLocal('transacoes'), JSON.stringify(transacoes)); } catch(e) {}
    try { localStorage.setItem(chaveLocal('previsoes'), JSON.stringify(previsoes)); } catch(e) {}
}

function nextId(array) {
    return array.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
}

// ==================================================
// UI BÁSICA + ABAS
// ==================================================
function inicializarUI() {
    try { document.getElementById('data').valueAsDate = new Date(); } catch(e){}
    try { document.getElementById('dataPrevisao').valueAsDate = new Date(); } catch(e){}

    // Binds do form Etapa 1 (telefone)
    const f1 = document.getElementById('formTelefone');
    if (f1) f1.addEventListener('submit', function(ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch(x){}
        window.etapa1_verificarTelefone && window.etapa1_verificarTelefone(ev); return false;
    }, true);

    // Bind form Etapa 2A (login senha)
    const f2a = document.getElementById('formSenhaLogin');
    if (f2a) f2a.addEventListener('submit', function(ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch(x){}
        window.etapa2_loginSenha && window.etapa2_loginSenha(ev); return false;
    }, true);

    // Bind form Etapa 2B (cadastro senha)
    const f2b = document.getElementById('formSenhaCadastro');
    if (f2b) f2b.addEventListener('submit', function(ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch(x){}
        window.etapa2_cadastrarSenha && window.etapa2_cadastrarSenha(ev); return false;
    }, true);

    // Abas do app
    document.querySelectorAll('.aba').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aba').forEach(b => b.classList.remove('ativa'));
            document.querySelectorAll('.conteudo-aba').forEach(c => c.classList.remove('ativa'));
            btn.classList.add('ativa');
            try { document.getElementById('aba-' + btn.dataset.aba).classList.add('ativa'); } catch(e){}
        });
    });

    // Filtros
    const fT = document.getElementById('filtro');
    if (fT) fT.addEventListener('change', renderTransacoes);
    const fP = document.getElementById('filtroPrevisoes');
    if (fP) fP.addEventListener('change', renderPrevisoes);

    // Forms do app
    const frmT = document.getElementById('formTransacao');
    if (frmT) frmT.addEventListener('submit', adicionarTransacao);
    const frmP = document.getElementById('formPrevisao');
    if (frmP) frmP.addEventListener('submit', adicionarPrevisao);
    const frmE = document.getElementById('formEdicao');
    if (frmE) frmE.addEventListener('submit', salvarEdicao);
    const btnSim = document.getElementById('btnSimular');
    if (btnSim) btnSim.addEventListener('click', simularInvestimento);
}

function formatarMoeda(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarUI() { atualizarResumo(); renderTransacoes(); renderPrevisoes(); }

function atualizarResumo() {
    const eT = transacoes.filter(t => t.tipo==='entrada').reduce((s,t)=>s+Number(t.valor),0);
    const sT = transacoes.filter(t => t.tipo==='saida').reduce((s,t)=>s+Number(t.valor),0);
    try { document.getElementById('totalEntradas').textContent = formatarMoeda(eT); } catch(e){}
    try { document.getElementById('totalSaidas').textContent = formatarMoeda(sT); } catch(e){}
    try { document.getElementById('saldoTotal').textContent = formatarMoeda(eT-sT); } catch(e){}

    const eP = previsoes.filter(t => t.tipo==='entrada').reduce((s,t)=>s+Number(t.valor),0);
    const sP = previsoes.filter(t => t.tipo==='saida').reduce((s,t)=>s+Number(t.valor),0);
    try { document.getElementById('totalEntradasPrevistas').textContent = formatarMoeda(eP); } catch(e){}
    try { document.getElementById('totalSaidasPrevistas').textContent = formatarMoeda(sP); } catch(e){}
    try { document.getElementById('saldoPrevisto').textContent = formatarMoeda(eP-sP); } catch(e){}
}

// ==================================================
// TRANSAÇÕES
// ==================================================
async function adicionarTransacao(e) {
    e.preventDefault();
    if (!usuarioAtual) return alert('Faça login primeiro!');

    const nova = {
        id: nextId(transacoes),
        user_id: usuarioAtual.telefone,
        descricao: document.getElementById('descricao').value.trim(),
        valor: Number(document.getElementById('valor').value),
        tipo: document.querySelector('input[name="tipo"]:checked').value,
        categoria: document.querySelector('input[name="categoria"]:checked').value,
        data: document.getElementById('data').value
    };

    let salvouCloud = false;
    try {
        const r = await sbFetch('/transacoes', {
            method: 'POST',
            body: JSON.stringify(nova)
        });
        if (!r.error) { salvouCloud = true; if (r.data && r.data[0] && r.data[0].id) nova.id = r.data[0].id; }
    } catch(e) { salvouCloud = false; }

    transacoes.unshift(nova);
    salvarLocal();
    e.target.reset();
    try { document.getElementById('data').valueAsDate = new Date(); } catch(x){}
    atualizarResumo();
    renderTransacoes();
}

function renderTransacoes() {
    const f = document.getElementById('filtro');
    let l = transacoes.slice();
    let fl = f?.value || 'todas';
    if (fl === 'entradas') l = l.filter(t => t.tipo === 'entrada');
    else if (fl === 'saidas') l = l.filter(t => t.tipo === 'saida');
    else if (fl === 'fixos') l = l.filter(t => t.categoria === 'fixo');
    else if (fl === 'variaveis') l = l.filter(t => t.categoria === 'variavel');

    const ul = document.getElementById('listaTransacoes');
    if (!ul) return;
    ul.innerHTML = l.length === 0
        ? '<li class="vazio">Nenhuma transação cadastrada</li>'
        : l.map(itemHtml).join('');
}

function itemHtml(t) {
    const d = new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR');
    return `<li class="item-transacao">
        <div class="item-col1">
            <span class="item-descricao">${escape(t.descricao)}</span>
            <div class="item-tags">
                <span class="tag tipo-${t.tipo}">${t.tipo==='entrada'?'📥 Entrada':'📤 Saída'}</span>
                <span class="tag cat-${t.categoria}">${t.categoria==='fixo'?'🔒 Fixo':'🔄 Variável'}</span>
                <span class="tag data">📅 ${d}</span>
            </div>
        </div>
        <div class="item-col2">
            <span class="item-valor ${t.tipo}">${t.tipo==='entrada'?'+':'-'} ${formatarMoeda(t.valor)}</span>
            <div class="item-acoes">
                <button class="btn-edit" onclick="window.abrirEdicao && window.abrirEdicao(${t.id},'transacao')">✏️</button>
                <button class="btn-del" onclick="window.excluirItem && window.excluirItem(${t.id},'transacao')">🗑️</button>
            </div>
        </div>
    </li>`;
}

window.excluirItem = async function excluirItem(id, origem) {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    const tabela = origem === 'transacao' ? 'transacoes' : 'previsoes';
    try {
        await sbFetch('/' + tabela + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
    } catch(e) {}

    if (origem === 'transacao') transacoes = transacoes.filter(t => Number(t.id) !== Number(id));
    else previsoes = previsoes.filter(t => Number(t.id) !== Number(id));
    salvarLocal();
    atualizarResumo();
    renderTransacoes();
    renderPrevisoes();
};

// ==================================================
// PREVISÕES
// ==================================================
async function adicionarPrevisao(e) {
    e.preventDefault();
    if (!usuarioAtual) return alert('Faça login primeiro!');

    const nova = {
        id: nextId(previsoes),
        user_id: usuarioAtual.telefone,
        descricao: document.getElementById('descricaoPrevisao').value.trim(),
        valor: Number(document.getElementById('valorPrevisao').value),
        tipo: document.querySelector('input[name="tipoPrevisao"]:checked').value,
        categoria: document.querySelector('input[name="categoriaPrevisao"]:checked').value,
        data: document.getElementById('dataPrevisao').value
    };

    try {
        const r = await sbFetch('/previsoes', { method: 'POST', body: JSON.stringify(nova) });
        if (!r.error && r.data && r.data[0] && r.data[0].id) nova.id = r.data[0].id;
    } catch(e) {}

    previsoes.unshift(nova);
    salvarLocal();
    e.target.reset();
    try { document.getElementById('dataPrevisao').valueAsDate = new Date(); } catch(x){}
    atualizarResumo();
    renderPrevisoes();
}

function renderPrevisoes() {
    const f = document.getElementById('filtroPrevisoes');
    let l = previsoes.slice();
    let fl = f?.value || 'todas';
    if (fl === 'entradas') l = l.filter(t => t.tipo === 'entrada');
    else if (fl === 'saidas') l = l.filter(t => t.tipo === 'saida');
    else if (fl === 'fixos') l = l.filter(t => t.categoria === 'fixo');
    else if (fl === 'variaveis') l = l.filter(t => t.categoria === 'variavel');

    const ul = document.getElementById('listaPrevisoes');
    if (!ul) return;
    ul.innerHTML = l.length === 0
        ? '<li class="vazio">Nenhuma previsão cadastrada</li>'
        : l.map(itemHtml).join('');
}

// ==================================================
// EDIÇÃO
// ==================================================
window.abrirEdicao = function abrirEdicao(id, origem) {
    const arr = origem === 'transacao' ? transacoes : previsoes;
    const item = arr.find(x => Number(x.id) === Number(id));
    if (!item) return;

    document.getElementById('modalTitulo').textContent = origem === 'transacao' ? 'Editar Transação' : 'Editar Previsão';
    document.getElementById('editId').value = id;
    document.getElementById('editOrigem').value = origem;
    document.getElementById('editDescricao').value = item.descricao;
    document.getElementById('editValor').value = item.valor;
    document.getElementById('editData').value = item.data;

    const tE = document.getElementById('editTipoEntrada');
    const tS = document.getElementById('editTipoSaida');
    if (item.tipo === 'entrada' && tE) tE.checked = true;
    if (item.tipo === 'saida' && tS) tS.checked = true;

    const cF = document.getElementById('editCategoriaFixo');
    const cV = document.getElementById('editCategoriaVariavel');
    if (item.categoria === 'fixo' && cF) cF.checked = true;
    if (item.categoria === 'variavel' && cV) cV.checked = true;

    document.getElementById('modalEdicao').style.display = 'flex';
};

window.fecharModal = function fecharModal() {
    document.getElementById('modalEdicao').style.display = 'none';
};

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

    try {
        await sbFetch('/' + tabela + '?id=eq.' + encodeURIComponent(id), {
            method: 'PATCH',
            body: JSON.stringify(dados)
        });
    } catch(e) {}

    let arr = origem === 'transacao' ? transacoes : previsoes;
    const idx = arr.findIndex(x => Number(x.id) === id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...dados };

    salvarLocal();
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

// ==================================================
// INVESTIMENTOS / CDI
// ==================================================
function simularInvestimento() {
    const inicial = Number(document.getElementById('valorInicial').value) || 0;
    const aporte  = Number(document.getElementById('aporteMensal').value) || 0;
    const pCdi    = Number(document.getElementById('percentualCDI').value) || 100;
    const cdiAn   = Number(document.getElementById('cdiAnual').value) || 11.75;
    const meses   = Number(document.getElementById('mesesRendimento').value) || 1;

    const txCdiMensal = Math.pow(1 + (cdiAn/100), 1/12) - 1;
    const txReal = txCdiMensal * (pCdi / 100);

    const tb = document.querySelector('#tabelaMeses tbody');
    if (!tb) return;
    tb.innerHTML = '';
    let saldo = inicial;
    let totInv = inicial;

    for (let m = 1; m <= meses; m++) {
        const inicialMes = saldo;
        const rend = saldo * txReal;
        saldo += rend + aporte;
        totInv += aporte;

        tb.innerHTML += `<tr>
            <td>${m}º</td>
            <td>${formatarMoeda(inicialMes)}</td>
            <td>${formatarMoeda(aporte)}</td>
            <td class="positivo">+ ${formatarMoeda(rend)}</td>
            <td><strong>${formatarMoeda(saldo)}</strong></td>
        </tr>`;
    }

    try { document.getElementById('valorFinal').textContent = formatarMoeda(saldo); } catch(e){}
    try { document.getElementById('totalInvestido').textContent = formatarMoeda(totInv); } catch(e){}
    try { document.getElementById('totalRendimento').textContent = formatarMoeda(saldo - totInv); } catch(e){}
    try { document.getElementById('resultadoInvestimento').style.display = 'block'; } catch(e){}
}

function escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ==================================================
// INICIAR APP
// ==================================================
async function inicializarApp() {
    try {
        console.log('▶️ inicializarApp...');

        if (window.supabase && window.supabase.createClient) {
            try {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                    auth: { persistSession: false, autoRefreshToken: false }
                });
            } catch(e) { supabase = null; }
        } else {
            alert('❌ Biblioteca Supabase não carregou! Verifique sua internet.');
        }

        if ('serviceWorker' in navigator) {
            try { await navigator.serviceWorker.register('service-worker.js'); } catch(e) {}
        }

        inicializarUI();

        // Verifica se já tem usuário logado salvo no localStorage
        let jaLogou = false;
        try {
            const salvo = JSON.parse(localStorage.getItem('cf_usuario_atual') || 'null');
            if (salvo && salvo.telefone) {
                usuarioAtual = salvo;
                jaLogou = true;
                mostrarTelaApp();
                await carregarDados();
            } else {
                mostrarTela1Telefone();
            }
        } catch(eSession) {
            mostrarTela1Telefone();
        }

        console.log('✅ inicializarApp OK | jaLogou:', jaLogou, '| usuario:', usuarioAtual?.telefone || null);
    } catch (eGeral) {
        try { alert('❌ ERRO GERAL:\n\n' + (eGeral?.message || String(eGeral))); } catch(x){}
        console.error(eGeral);
    }
}

document.addEventListener('DOMContentLoaded', inicializarApp);
