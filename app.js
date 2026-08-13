/* =========================================================
   CONTROLE FINANCEIRO — TELEFONE + SENHA (100% FUNCIONAL)
   - 3 telas: Telefone → Senha → App
   - Sync nuvem via Supabase (POST/PATCH/DELETE direto via fetch)
   - Fallback local via localStorage
   - TUDO GLOBAL em window.*  (HTML onclick/addEventListener funciona)
   ========================================================= */

// ==================== DEBUG: avisa no console logo no começo ====================
console.log('🔵 app.js CARREGOU!');
window.addEventListener('error', function(ev) {
    try { alert('❌ ERRO:\n' + (ev.message || 'desconhecido') + '\nLinha: ' + (ev.lineno||'?') + '\nCol: ' + (ev.colno||'?')); } catch(e){}
    console.error('ERRO GLOBAL:', ev);
});
window.addEventListener('unhandledrejection', function(ev) {
    try { alert('❌ ERRO ASSÍNCRONO:\n' + (ev.reason?.message || ev.reason || ev)); } catch(e){}
    console.error('UNHANDLED:', ev);
});

// ==================== CONFIG ====================
const SUPABASE_URL = "https://wcoxenaodhqnugrbmflk.supabase.co";
const SUPABASE_KEY = "sb_publishable_aqgSyFe4DNHLDepj03BAvQ_f9GzjNDL";
window.__supabaseUrl = SUPABASE_URL;  // Garante que script inline vai ter também
window.__supabaseKey = SUPABASE_KEY;
let transacoes = [];
let previsoes = [];
let usuarioAtual = null;
let telefoneTemporario = '';
let supabase = null;

// Sincroniza usuarioAtual <-> window.__usuario (o script inline usa window.__usuario)
function sincUsuarioGlobal(){
    if (window.__usuario && !usuarioAtual) usuarioAtual = window.__usuario;
    if (usuarioAtual) window.__usuario = usuarioAtual;
    if (telefoneTemporario) window.__telefoneTemp = telefoneTemporario;
    if (window.__telefoneTemp && !telefoneTemporario) telefoneTemporario = window.__telefoneTemp;
}

// ==================== AUX ====================
function limparTelefone(t) { return String(t||'').replace(/\D/g,''); }
function fmtTel(t) {
    t = String(t||''); if (t.length<10) return t;
    return '📱 ('+t.slice(0,2)+') '+t.slice(2,t.length-4)+'-'+t.slice(-4);
}
async function sha256(txt) {
    const b = new TextEncoder().encode(String(txt||''));
    const d = await crypto.subtle.digest('SHA-256', b);
    return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatarMoeda(v){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function nextId(a){return a.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;}

// ==================== MOSTRAR TELAS (GARANTE NUNCA FALHAR) ====================
function esconderTodas() {
    try {
        ['tela1Telefone','tela2Senha','telaApp'].forEach(id=>{
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('oculto');
            el.style.setProperty('display','none','important');
        });
    } catch(e) { console.error(e); }
}

window.mostrarTela1Telefone = function() {
    console.log('👉 mostrarTela1Telefone');
    esconderTodas();
    const el = document.getElementById('tela1Telefone');
    if (!el) { alert('ERRO: tela1Telefone não existe!'); return; }
    el.classList.remove('oculto');
    el.style.setProperty('display','block','important');
    try { document.getElementById('telefoneAcesso').focus(); } catch(e){}
    window.scrollTo(0,0);
};

window.mostrarTela2Senha = function() {
    console.log('👉 mostrarTela2Senha');
    esconderTodas();
    const el = document.getElementById('tela2Senha');
    if (!el) { alert('ERRO: tela2Senha não existe!'); return; }
    el.classList.remove('oculto');
    el.style.setProperty('display','block','important');
    window.scrollTo(0,0);
};

window.mostrarTelaApp = function() {
    console.log('👉 mostrarTelaApp');
    esconderTodas();
    const el = document.getElementById('telaApp');
    if (!el) { alert('ERRO: telaApp não existe!'); return; }
    el.classList.remove('oculto');
    el.style.setProperty('display','block','important');
    const u = document.getElementById('userEmail');
    if (u && usuarioAtual) u.textContent = fmtTel(usuarioAtual.telefone);
    window.scrollTo(0,0);
};

window.voltarParaTelefone = function() {
    console.log('👉 voltarParaTelefone');
    try { ['senhaLogin','senhaNova1','senhaNova2'].forEach(i=>{const x=document.getElementById(i); if(x) x.value='';}); } catch(e){}
    try { ['msgSenhaLogin','msgSenhaCadastro'].forEach(i=>{const x=document.getElementById(i); if(x){x.textContent='';x.removeAttribute('style');}}); } catch(e){}
    mostrarTela1Telefone();
};

window.fazerLogout = function() {
    if (!confirm('Sair da conta?')) return;
    usuarioAtual = null; telefoneTemporario = ''; transacoes = []; previsoes = [];
    try { localStorage.removeItem('cf_usuario_atual'); } catch(e){}
    try { ['telefoneAcesso','senhaLogin','senhaNova1','senhaNova2'].forEach(i=>{const x=document.getElementById(i); if(x) x.value='';}); } catch(e){}
    mostrarTela1Telefone();
};

// ==================== SET MSG ====================
function setMsg(id, texto, cor) {
    try {
        const m = document.getElementById(id); if (!m) return;
        m.textContent = texto || '';
        if (cor) m.style.color = cor; else m.removeAttribute('style');
    } catch(e) {}
}

// ==================== SUPABASE VIA FETCH DIRETO ====================
async function sbFetch(path, opcoes={}) {
    const url = SUPABASE_URL + '/rest/v1' + path;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(opcoes.headers || {})
    };
    if (usuarioAtual?.telefone) headers['x-telefone-usuario'] = String(usuarioAtual.telefone);
    console.log('📡 sbFetch:', opcoes.method||'GET', url, 'headers:', headers);
    try {
        const res = await fetch(url, { ...opcoes, headers });
        let body = null;
        try { body = await res.json(); } catch(e) {}
        console.log('   → status', res.status, 'body:', body);
        if (!res.ok) return { data:null, error:{ message:(body&&(body.message||body.error))||('HTTP '+res.status), status:res.status } };
        return { data:body, error:null };
    } catch (ef) {
        return { data:null, error:{ message:ef?.message||String(ef) } };
    }
}

// ==================== ETAPA 1: VERIFICAR TELEFONE (BOTÃO CONTINUAR) ====================
// 1) Salvamos a FUNÇÃO REAL em window.__appReal_etapa1 (o script inline chama essa se existir)
// 2) Depois sobrescrevemos window.etapa1_verificarTelefone com a versão real
window.__appReal_etapa1 = async function etapa1_real() {
    sincUsuarioGlobal();
    console.log('👉 etapa1_verificarTelefone (app.js REAL)');
    if (!supabase) { setMsg('msgTelefone','⏳ Carregando sistema... tente em 2s','#34d399'); return; }
    const input = document.getElementById('telefoneAcesso');
    const tel = limparTelefone(input.value);
    if (tel.length < 10) { setMsg('msgTelefone','❌ Digite seu telefone completo (com DDD)','#f87171'); return; }
    setMsg('msgTelefone','🔍 Verificando no banco...','#34d399');

    let existe = false;
    try {
        const r = await supabase.rpc('verificar_telefone', { tel: tel });
        console.log('   RPC verificar_telefone:', r);
        if (!r.error && (r.data === 1 || r.data === true || r.data === 't')) existe = true;
    } catch(e) { console.warn('RPC falhou', e); }

    if (!existe) {
        try {
            const r2 = await sbFetch('/usuarios?telefone=eq.'+encodeURIComponent(tel)+'&select=id&limit=1', { method:'GET' });
            if (!r2.error && Array.isArray(r2.data) && r2.data.length > 0) existe = true;
        } catch(e) {}
    }

    telefoneTemporario = tel; sincUsuarioGlobal();

    const blocoLogin = document.getElementById('blocoSenhaLogin');
    const blocoCad   = document.getElementById('blocoSenhaCadastro');
    const subt = document.getElementById('txtSubtituloSenha');
    if (subt) subt.textContent = fmtTel(tel) + (existe ? ' • Digite sua senha' : ' • Crie sua senha');
    if (blocoLogin) blocoLogin.style.display = existe ? 'block' : 'none';
    if (blocoCad)   blocoCad.style.display   = existe ? 'none'  : 'block';
    setMsg('msgTelefone','');
    mostrarTela2Senha();
    try { setTimeout(()=>{ const i = existe ? document.getElementById('senhaLogin') : document.getElementById('senhaNova1'); if(i) i.focus(); }, 150); } catch(e){}
};
// Agora marca a função global (se o script inline já tinha criado uma placeholder, substituímos pela real)
window.etapa1_verificarTelefone = window.__appReal_etapa1;

// ==================== ETAPA 2A - LOGAR COM SENHA ====================
window.__appReal_etapa2a = async function etapa2a_real() {
    sincUsuarioGlobal();
    console.log('👉 etapa2_loginSenha (app.js REAL)');
    if (!telefoneTemporario) { voltarParaTelefone(); return; }
    const s = document.getElementById('senhaLogin').value;
    if (!s || s.length < 6) { setMsg('msgSenhaLogin','❌ Senha inválida (mínimo 6)','#f87171'); return; }
    setMsg('msgSenhaLogin','🔐 Verificando...','#34d399');

    const hash = await sha256(s);
    let ok = false;
    try {
        const r = await supabase.rpc('login_senha', { tel: telefoneTemporario, hash_senha: hash });
        if (!r.error && (r.data===1||r.data===true||r.data==='t')) ok = true;
    } catch(e){}

    if (!ok) {
        usuarioAtual = { telefone: telefoneTemporario };
        const r2 = await sbFetch('/usuarios?telefone=eq.'+encodeURIComponent(telefoneTemporario)+'&select=senha_hash&limit=1');
        usuarioAtual = null;
        if (!r2.error && Array.isArray(r2.data) && r2.data.length>0 && String(r2.data[0].senha_hash)===String(hash)) ok = true;
    }

    if (!ok) { setMsg('msgSenhaLogin','❌ Senha incorreta!','#f87171'); return; }

    usuarioAtual = { telefone: telefoneTemporario }; sincUsuarioGlobal();
    try { localStorage.setItem('cf_usuario_atual', JSON.stringify(usuarioAtual)); } catch(e){}
    setMsg('msgSenhaLogin','✅ Entrando...','#34d399');
    await carregarDados();
    setTimeout(()=>{ setMsg('msgSenhaLogin',''); mostrarTelaApp(); }, 400);
};
window.etapa2_loginSenha = window.__appReal_etapa2a;

// ==================== ETAPA 2B - CADASTRAR SENHA NOVA ====================
window.__appReal_etapa2b = async function etapa2b_real() {
    sincUsuarioGlobal();
    console.log('👉 etapa2_cadastrarSenha (app.js REAL)');
    if (!telefoneTemporario) { voltarParaTelefone(); return; }
    const s1 = document.getElementById('senhaNova1').value;
    const s2 = document.getElementById('senhaNova2').value;
    if (!s1 || s1.length<6) { setMsg('msgSenhaCadastro','❌ Senha curta (mínimo 6)','#f87171'); return; }
    if (s1 !== s2) { setMsg('msgSenhaCadastro','❌ Senhas diferentes!','#f87171'); return; }
    setMsg('msgSenhaCadastro','✨ Criando conta...','#34d399');

    const hash = await sha256(s1);
    const r = await sbFetch('/usuarios', { method:'POST', body: JSON.stringify({ telefone: telefoneTemporario, senha_hash: hash }) });

    if (r.error) {
        const msg = String(r.error.message||'').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique') || String(r.error.status)==='23505') {
            setMsg('msgSenhaCadastro','⚠️ Já tem cadastro! Mostrando tela de login...','#f59e0b');
            setTimeout(()=>{
                const bl = document.getElementById('blocoSenhaLogin'), bc = document.getElementById('blocoSenhaCadastro');
                if (bl) bl.style.display='block'; if (bc) bc.style.display='none';
                const s = document.getElementById('txtSubtituloSenha'); if (s) s.textContent = fmtTel(telefoneTemporario)+' • Digite sua senha';
                try { document.getElementById('senhaLogin').focus(); } catch(e){}
            }, 900);
            return;
        }
        setMsg('msgSenhaCadastro','❌ Erro: '+(r.error.message||''),'#f87171');
        return;
    }

    usuarioAtual = { telefone: telefoneTemporario }; sincUsuarioGlobal();
    try { localStorage.setItem('cf_usuario_atual', JSON.stringify(usuarioAtual)); } catch(e){}
    setMsg('msgSenhaCadastro','✅ Conta criada!','#34d399');
    await carregarDados();
    setTimeout(()=>{ setMsg('msgSenhaCadastro',''); mostrarTelaApp(); }, 500);
};
window.etapa2_cadastrarSenha = window.__appReal_etapa2b;

// ==================== CARREGAR DADOS / SALVAR LOCAL ====================
function chaveLocal(n){ return usuarioAtual ? 'cf_'+n+'_'+usuarioAtual.telefone : ''; }
function salvarLocal() {
    if (!usuarioAtual) return;
    try { localStorage.setItem(chaveLocal('transacoes'), JSON.stringify(transacoes)); } catch(e){}
    try { localStorage.setItem(chaveLocal('previsoes'), JSON.stringify(previsoes)); } catch(e){}
}

async function carregarDados() {
    sincUsuarioGlobal();
    if (!usuarioAtual) return;
    console.log('👉 carregarDados');
    let okC = false, okP = false;
    try { const r=await sbFetch('/transacoes?select=*&order=data.desc'); if (!r.error && Array.isArray(r.data)){ transacoes=r.data; okC=true; } } catch(e){}
    try { const r=await sbFetch('/previsoes?select=*&order=data.desc');   if (!r.error && Array.isArray(r.data)){ previsoes=r.data;   okP=true; } } catch(e){}
    if (!okC) { try { transacoes = JSON.parse(localStorage.getItem(chaveLocal('transacoes'))||'[]'); } catch(e){transacoes=[];} }
    if (!okP) { try { previsoes = JSON.parse(localStorage.getItem(chaveLocal('previsoes'))||'[]'); } catch(e){previsoes=[];} }
    atualizarUI();
}
// Para o script inline chamar quando logar (via script inline, antes do app.js estar pronto)
window.__carregarDadosApp = carregarDados;

// ==================== UI ====================
function atualizarUI(){ atualizarResumo(); renderTransacoes(); renderPrevisoes(); }
function atualizarResumo() {
    const eT = transacoes.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+Number(t.valor),0);
    const sT = transacoes.filter(t=>t.tipo==='saida').reduce((s,t)=>s+Number(t.valor),0);
    try { document.getElementById('totalEntradas').textContent=formatarMoeda(eT); } catch(e){}
    try { document.getElementById('totalSaidas').textContent=formatarMoeda(sT); } catch(e){}
    try { document.getElementById('saldoTotal').textContent=formatarMoeda(eT-sT); } catch(e){}
    const eP = previsoes.filter(t=>t.tipo==='entrada').reduce((s,t)=>s+Number(t.valor),0);
    const sP = previsoes.filter(t=>t.tipo==='saida').reduce((s,t)=>s+Number(t.valor),0);
    try { document.getElementById('totalEntradasPrevistas').textContent=formatarMoeda(eP); } catch(e){}
    try { document.getElementById('totalSaidasPrevistas').textContent=formatarMoeda(sP); } catch(e){}
    try { document.getElementById('saldoPrevisto').textContent=formatarMoeda(eP-sP); } catch(e){}
}

// ==================== TRANSAÇÕES ====================
async function adicionarTransacao(ev) {
    ev.preventDefault(); ev.stopPropagation();
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
    try {
        const r = await sbFetch('/transacoes', { method:'POST', body:JSON.stringify(nova) });
        if (!r.error && r.data && r.data[0] && r.data[0].id) nova.id = r.data[0].id;
    } catch(e){}
    transacoes.unshift(nova); salvarLocal();
    ev.target.reset(); try { document.getElementById('data').valueAsDate = new Date(); } catch(e){}
    atualizarResumo(); renderTransacoes();
}

function renderTransacoes() {
    const f = document.getElementById('filtro'); let l = transacoes.slice();
    const v = f?.value||'todas';
    if (v==='entradas') l=l.filter(t=>t.tipo==='entrada');
    else if (v==='saidas') l=l.filter(t=>t.tipo==='saida');
    else if (v==='fixos') l=l.filter(t=>t.categoria==='fixo');
    else if (v==='variaveis') l=l.filter(t=>t.categoria==='variavel');
    const ul = document.getElementById('listaTransacoes'); if (!ul) return;
    ul.innerHTML = l.length===0 ? '<li class="vazio">Nenhuma transação</li>' : l.map(itemHtml).join('');
}

function itemHtml(t) {
    const d = new Date(t.data+'T00:00:00').toLocaleDateString('pt-BR');
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
                <button class="btn-edit" onclick="window.abrirEdicao(${t.id},'transacao')">✏️</button>
                <button class="btn-del" onclick="window.excluirItem(${t.id},'transacao')">🗑️</button>
            </div>
        </div>
    </li>`;
}

window.excluirItem = async function(id, origem) {
    if (!confirm('Excluir?')) return;
    const tb = origem==='transacao' ? 'transacoes' : 'previsoes';
    try { await sbFetch('/'+tb+'?id=eq.'+encodeURIComponent(id), { method:'DELETE' }); } catch(e){}
    if (origem==='transacao') transacoes = transacoes.filter(t=>Number(t.id)!==Number(id));
    else previsoes = previsoes.filter(t=>Number(t.id)!==Number(id));
    salvarLocal(); atualizarResumo(); renderTransacoes(); renderPrevisoes();
};

// ==================== PREVISÕES ====================
async function adicionarPrevisao(ev) {
    ev.preventDefault(); ev.stopPropagation();
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
        const r = await sbFetch('/previsoes', { method:'POST', body:JSON.stringify(nova) });
        if (!r.error && r.data && r.data[0] && r.data[0].id) nova.id = r.data[0].id;
    } catch(e){}
    previsoes.unshift(nova); salvarLocal();
    ev.target.reset(); try { document.getElementById('dataPrevisao').valueAsDate = new Date(); } catch(e){}
    atualizarResumo(); renderPrevisoes();
}

function renderPrevisoes() {
    const f = document.getElementById('filtroPrevisoes'); let l = previsoes.slice();
    const v = f?.value||'todas';
    if (v==='entradas') l=l.filter(t=>t.tipo==='entrada');
    else if (v==='saidas') l=l.filter(t=>t.tipo==='saida');
    else if (v==='fixos') l=l.filter(t=>t.categoria==='fixo');
    else if (v==='variaveis') l=l.filter(t=>t.categoria==='variavel');
    const ul = document.getElementById('listaPrevisoes'); if (!ul) return;
    ul.innerHTML = l.length===0 ? '<li class="vazio">Nenhuma previsão</li>' : l.map(itemHtml).join('');
}

// ==================== EDIÇÃO ====================
window.abrirEdicao = function(id, origem) {
    const arr = origem==='transacao' ? transacoes : previsoes;
    const item = arr.find(x=>Number(x.id)===Number(id)); if (!item) return;
    document.getElementById('modalTitulo').textContent = origem==='transacao' ? 'Editar Transação':'Editar Previsão';
    document.getElementById('editId').value = id;
    document.getElementById('editOrigem').value = origem;
    document.getElementById('editDescricao').value = item.descricao;
    document.getElementById('editValor').value = item.valor;
    document.getElementById('editData').value = item.data;
    const tE = document.getElementById('editTipoEntrada'), tS = document.getElementById('editTipoSaida');
    if (item.tipo==='entrada' && tE) tE.checked=true;
    if (item.tipo==='saida' && tS) tS.checked=true;
    const cF = document.getElementById('editCategoriaFixo'), cV = document.getElementById('editCategoriaVariavel');
    if (item.categoria==='fixo' && cF) cF.checked=true;
    if (item.categoria==='variavel' && cV) cV.checked=true;
    document.getElementById('modalEdicao').style.display='flex';
};
window.fecharModal = function(){ document.getElementById('modalEdicao').style.display='none'; };
async function salvarEdicao(ev) {
    ev.preventDefault();
    const id = Number(document.getElementById('editId').value);
    const origem = document.getElementById('editOrigem').value;
    const tb = origem==='transacao'?'transacoes':'previsoes';
    const dados = {
        descricao: document.getElementById('editDescricao').value.trim(),
        valor: Number(document.getElementById('editValor').value),
        tipo: document.querySelector('input[name="editTipo"]:checked').value,
        categoria: document.querySelector('input[name="editCategoria"]:checked').value,
        data: document.getElementById('editData').value
    };
    try { await sbFetch('/'+tb+'?id=eq.'+encodeURIComponent(id), { method:'PATCH', body:JSON.stringify(dados) }); } catch(e){}
    const arr = origem==='transacao' ? transacoes : previsoes;
    const idx = arr.findIndex(x=>Number(x.id)===id); if (idx>=0) arr[idx] = { ...arr[idx], ...dados };
    salvarLocal(); fecharModal(); atualizarResumo(); renderTransacoes(); renderPrevisoes();
}
try { document.querySelector('.modal-fundo').addEventListener('click',(ev)=>{ if(ev.target.classList.contains('modal-fundo')) fecharModal(); }); } catch(e){}

// ==================== INVESTIMENTOS ====================
function simularInvestimento() {
    const inicial = Number(document.getElementById('valorInicial').value)||0;
    const aporte  = Number(document.getElementById('aporteMensal').value)||0;
    const pCdi    = Number(document.getElementById('percentualCDI').value)||100;
    const cdiAn   = Number(document.getElementById('cdiAnual').value)||11.75;
    const meses   = Number(document.getElementById('mesesRendimento').value)||1;
    const txMes   = Math.pow(1+(cdiAn/100), 1/12) - 1;
    const txReal  = txMes * (pCdi/100);
    const tb = document.querySelector('#tabelaMeses tbody'); if (!tb) return;
    tb.innerHTML = ''; let saldo=inicial; let totInv=inicial;
    for (let m=1; m<=meses; m++) {
        const ini = saldo; const rend = saldo*txReal; saldo += rend + aporte; totInv += aporte;
        tb.innerHTML += `<tr><td>${m}º</td><td>${formatarMoeda(ini)}</td><td>${formatarMoeda(aporte)}</td><td class="positivo">+ ${formatarMoeda(rend)}</td><td><strong>${formatarMoeda(saldo)}</strong></td></tr>`;
    }
    try { document.getElementById('valorFinal').textContent = formatarMoeda(saldo); } catch(e){}
    try { document.getElementById('totalInvestido').textContent = formatarMoeda(totInv); } catch(e){}
    try { document.getElementById('totalRendimento').textContent = formatarMoeda(saldo-totInv); } catch(e){}
    try { document.getElementById('resultadoInvestimento').style.display='block'; } catch(e){}
}

// ==================== BIND DE BOTÕES E INPUTS (NUNCA FALHA) ====================
function bindApenasUmaVez(idEl, evento, fn) {
    const el = document.getElementById(idEl);
    if (!el) { console.warn('⚠️ bind falhou, não existe:', idEl); return; }
    if (el.__jaBindei) { console.log('   (ja tinha bindeado '+idEl+', pulando)'); return; }
    el.__jaBindei = true;
    el.addEventListener(evento, fn, { passive:false, capture:true });
    console.log('   ✅ bind OK:', idEl, evento);
}

function bindEnterInput(idInput, idBotaoParaClicar) {
    const inp = document.getElementById(idInput); const btn = document.getElementById(idBotaoParaClicar);
    if (!inp || !btn) return;
    if (inp.__jaEnterBind) return;
    inp.__jaEnterBind = true;
    inp.addEventListener('keydown', function(ev){ if (ev.key==='Enter') { ev.preventDefault(); ev.stopPropagation(); btn.click(); } });
    console.log('   ✅ bind ENTER OK:', idInput, '→ clica', idBotaoParaClicar);
}

function inicializarUI() {
    console.log('👉 inicializarUI');

    try { document.getElementById('data').valueAsDate = new Date(); } catch(e){}
    try { document.getElementById('dataPrevisao').valueAsDate = new Date(); } catch(e){}

    // NOVOS BOTÕES (tipo button, não submit) — bind 100% confiável
    bindApenasUmaVez('btnContinuarTelefone', 'click', window.etapa1_verificarTelefone);
    bindApenasUmaVez('btnEntrarSenha',     'click', window.etapa2_loginSenha);
    bindApenasUmaVez('btnCriarConta',      'click', window.etapa2_cadastrarSenha);

    // ENTER nos inputs → aciona botão (usuário não precisa clicar no botão)
    bindEnterInput('telefoneAcesso','btnContinuarTelefone');
    bindEnterInput('senhaLogin',    'btnEntrarSenha');
    bindEnterInput('senhaNova1',    'btnCriarConta');
    bindEnterInput('senhaNova2',    'btnCriarConta');

    // ABAS
    document.querySelectorAll('.aba').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            document.querySelectorAll('.aba').forEach(b=>b.classList.remove('ativa'));
            document.querySelectorAll('.conteudo-aba').forEach(c=>c.classList.remove('ativa'));
            btn.classList.add('ativa');
            try { document.getElementById('aba-'+btn.dataset.aba).classList.add('ativa'); } catch(e){}
        });
    });

    try { document.getElementById('filtro').addEventListener('change', renderTransacoes); } catch(e){}
    try { document.getElementById('filtroPrevisoes').addEventListener('change', renderPrevisoes); } catch(e){}
    try { document.getElementById('formTransacao').addEventListener('submit', adicionarTransacao); } catch(e){}
    try { document.getElementById('formPrevisao').addEventListener('submit', adicionarPrevisao); } catch(e){}
    try { document.getElementById('formEdicao').addEventListener('submit', salvarEdicao); } catch(e){}
    try { document.getElementById('btnSimular').addEventListener('click', simularInvestimento); } catch(e){}

    console.log('✅ inicializarUI PRONTO');
}

// ==================== INICIAR TUDO ====================
async function inicializarApp() {
    console.log('▶️ inicializarApp INICIO');
    sincUsuarioGlobal();
    if (window.supabase && window.supabase.createClient) {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession:false, autoRefreshToken:false }
            });
            console.log('✅ Supabase client criado');
        } catch(e) { console.warn('Supabase falhou', e); supabase=null; }
    } else {
        console.error('❌ window.supabase não existe! CDN carregou?');
    }

    if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('service-worker.js'); } catch(e){} }

    inicializarUI();

    let logou = false;
    try {
        const salvo = JSON.parse(localStorage.getItem('cf_usuario_atual')||'null');
        if (salvo && salvo.telefone) {
            usuarioAtual = salvo; logou = true;
            console.log('   usuario logado (lembrado):', usuarioAtual.telefone);
            mostrarTelaApp();
            await carregarDados();
        } else {
            mostrarTela1Telefone();
        }
    } catch(e) { mostrarTela1Telefone(); }

    console.log('✅ inicializarApp FIM | logou=', logou);
}

// 3 FORMAS DE INICIAR (garante que nunca falhe)
document.addEventListener('DOMContentLoaded', inicializarApp);
window.addEventListener('load', function(){ if (!supabase) setTimeout(inicializarApp, 200); });
setTimeout(function(){ try { if (!document.getElementById('tela1Telefone') || document.getElementById('tela1Telefone').classList.contains('oculto') && !usuarioAtual) inicializarApp(); } catch(e){} }, 1500);
