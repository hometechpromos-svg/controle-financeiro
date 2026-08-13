if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
}

let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
let previsoes = JSON.parse(localStorage.getItem('previsoes')) || [];

const form = document.getElementById('formTransacao');
const listaTransacoes = document.getElementById('listaTransacoes');
const saldoTotalEl = document.getElementById('saldoTotal');
const totalEntradasEl = document.getElementById('totalEntradas');
const totalSaidasEl = document.getElementById('totalSaidas');
const filtroEl = document.getElementById('filtro');

const formPrevisao = document.getElementById('formPrevisao');
const listaPrevisoes = document.getElementById('listaPrevisoes');
const saldoPrevistoEl = document.getElementById('saldoPrevisto');
const totalEntradasPrevistasEl = document.getElementById('totalEntradasPrevistas');
const totalSaidasPrevistasEl = document.getElementById('totalSaidasPrevistas');
const filtroPrevisoesEl = document.getElementById('filtroPrevisoes');

const formEdicao = document.getElementById('formEdicao');
const modalEdicao = document.getElementById('modalEdicao');
const modalTitulo = document.getElementById('modalTitulo');

document.getElementById('data').valueAsDate = new Date();
document.getElementById('dataPrevisao').valueAsDate = new Date();

document.querySelectorAll('.aba').forEach(aba => {
    aba.addEventListener('click', () => {
        const alvo = aba.dataset.aba;
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
        document.querySelectorAll('.conteudo-aba').forEach(c => c.classList.remove('ativa'));
        aba.classList.add('ativa');
        document.getElementById('aba-' + alvo).classList.add('ativa');
    });
});

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
    const partes = dataStr.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function salvarTransacoes() {
    localStorage.setItem('transacoes', JSON.stringify(transacoes));
}

function salvarPrevisoes() {
    localStorage.setItem('previsoes', JSON.stringify(previsoes));
}

function atualizarResumo() {
    const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
    const saidas = transacoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0);
    const saldo = entradas - saidas;

    saldoTotalEl.textContent = formatarMoeda(saldo);
    totalEntradasEl.textContent = formatarMoeda(entradas);
    totalSaidasEl.textContent = formatarMoeda(saidas);
}

function atualizarResumoPrevisoes() {
    const entradas = previsoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
    const saidas = previsoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0);
    const saldo = entradas - saidas;

    saldoPrevistoEl.textContent = formatarMoeda(saldo);
    totalEntradasPrevistasEl.textContent = formatarMoeda(entradas);
    totalSaidasPrevistasEl.textContent = formatarMoeda(saidas);
}

function montarItem(item, origem) {
    return `
        <li class="transacao-item">
            <div class="transacao-info">
                <div class="transacao-descricao">${escapeHtml(item.descricao)}</div>
                <div class="transacao-detalhes">
                    <span class="tag tag-tipo ${item.tipo}">${item.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</span>
                    <span class="tag tag-categoria ${item.categoria}">${item.categoria === 'fixo' ? '🔒 Fixo' : '🔄 Variável'}</span>
                    <span class="tag tag-data">📅 ${formatarData(item.data)}</span>
                </div>
            </div>
            <div class="transacao-botoes">
                <span class="transacao-valor ${item.tipo}">${item.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(item.valor)}</span>
                <button class="btn-editar" onclick="editarItem(${item.id}, '${origem}')" title="Editar">✏️</button>
                <button class="btn-excluir" onclick="excluirItem(${item.id}, '${origem}')" title="Excluir">🗑️</button>
            </div>
        </li>
    `;
}

function renderizarTransacoes() {
    const filtro = filtroEl.value;
    let dados = transacoes;
    dados = aplicarFiltro(dados, filtro);
    dados.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (dados.length === 0) {
        listaTransacoes.innerHTML = '<li class="vazio">Nenhuma transação encontrada. Adicione sua primeira transação acima!</li>';
        return;
    }

    listaTransacoes.innerHTML = dados.map(t => montarItem(t, 'transacoes')).join('');
}

function renderizarPrevisoes() {
    const filtro = filtroPrevisoesEl.value;
    let dados = previsoes;
    dados = aplicarFiltro(dados, filtro);
    dados.sort((a, b) => new Date(a.data) - new Date(b.data));

    if (dados.length === 0) {
        listaPrevisoes.innerHTML = '<li class="vazio">Nenhuma previsão cadastrada. Comece a planejar seu futuro!</li>';
        return;
    }

    listaPrevisoes.innerHTML = dados.map(t => montarItem(t, 'previsoes')).join('');
}

function aplicarFiltro(dados, filtro) {
    if (filtro === 'entradas') return dados.filter(t => t.tipo === 'entrada');
    if (filtro === 'saidas') return dados.filter(t => t.tipo === 'saida');
    if (filtro === 'fixos') return dados.filter(t => t.categoria === 'fixo');
    if (filtro === 'variaveis') return dados.filter(t => t.categoria === 'variavel');
    return dados;
}

function abrirModal(titulo) {
    modalTitulo.textContent = titulo;
    modalEdicao.style.display = 'flex';
}

function fecharModal() {
    modalEdicao.style.display = 'none';
    formEdicao.reset();
}

function editarItem(id, origem) {
    const lista = origem === 'transacoes' ? transacoes : previsoes;
    const item = lista.find(t => t.id === id);
    if (!item) return;

    document.getElementById('editId').value = item.id;
    document.getElementById('editOrigem').value = origem;
    document.getElementById('editDescricao').value = item.descricao;
    document.getElementById('editValor').value = item.valor;
    document.getElementById('editData').value = item.data;

    if (item.tipo === 'entrada') document.getElementById('editTipoEntrada').checked = true;
    else document.getElementById('editTipoSaida').checked = true;

    if (item.categoria === 'fixo') document.getElementById('editCategoriaFixo').checked = true;
    else document.getElementById('editCategoriaVariavel').checked = true;

    abrirModal(origem === 'transacoes' ? 'Editar Transação' : 'Editar Previsão');
}

function excluirItem(id, origem) {
    if (!confirm('Deseja realmente excluir este item?')) return;
    if (origem === 'transacoes') {
        transacoes = transacoes.filter(t => t.id !== id);
        salvarTransacoes();
        atualizarResumo();
        renderizarTransacoes();
    } else {
        previsoes = previsoes.filter(t => t.id !== id);
        salvarPrevisoes();
        atualizarResumoPrevisoes();
        renderizarPrevisoes();
    }
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    const descricao = document.getElementById('descricao').value.trim();
    const valor = parseFloat(document.getElementById('valor').value);
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const categoria = document.querySelector('input[name="categoria"]:checked').value;
    const data = document.getElementById('data').value;

    transacoes.push({ id: Date.now(), descricao, valor, tipo, categoria, data });
    salvarTransacoes();
    atualizarResumo();
    renderizarTransacoes();

    form.reset();
    document.getElementById('data').valueAsDate = new Date();
});

formPrevisao.addEventListener('submit', function(e) {
    e.preventDefault();
    const descricao = document.getElementById('descricaoPrevisao').value.trim();
    const valor = parseFloat(document.getElementById('valorPrevisao').value);
    const tipo = document.querySelector('input[name="tipoPrevisao"]:checked').value;
    const categoria = document.querySelector('input[name="categoriaPrevisao"]:checked').value;
    const data = document.getElementById('dataPrevisao').value;

    previsoes.push({ id: Date.now(), descricao, valor, tipo, categoria, data });
    salvarPrevisoes();
    atualizarResumoPrevisoes();
    renderizarPrevisoes();

    formPrevisao.reset();
    document.getElementById('dataPrevisao').valueAsDate = new Date();
});

formEdicao.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editId').value);
    const origem = document.getElementById('editOrigem').value;
    const descricao = document.getElementById('editDescricao').value.trim();
    const valor = parseFloat(document.getElementById('editValor').value);
    const tipo = document.querySelector('input[name="editTipo"]:checked').value;
    const categoria = document.querySelector('input[name="editCategoria"]:checked').value;
    const data = document.getElementById('editData').value;

    const novosDados = { descricao, valor, tipo, categoria, data };

    if (origem === 'transacoes') {
        const idx = transacoes.findIndex(t => t.id === id);
        if (idx !== -1) transacoes[idx] = { ...transacoes[idx], ...novosDados };
        salvarTransacoes();
        atualizarResumo();
        renderizarTransacoes();
    } else {
        const idx = previsoes.findIndex(t => t.id === id);
        if (idx !== -1) previsoes[idx] = { ...previsoes[idx], ...novosDados };
        salvarPrevisoes();
        atualizarResumoPrevisoes();
        renderizarPrevisoes();
    }

    fecharModal();
});

filtroEl.addEventListener('change', renderizarTransacoes);
filtroPrevisoesEl.addEventListener('change', renderizarPrevisoes);

window.editarItem = editarItem;
window.excluirItem = excluirItem;
window.fecharModal = fecharModal;

modalEdicao.addEventListener('click', function(e) {
    if (e.target === modalEdicao) fecharModal();
});

document.getElementById('btnSimular').addEventListener('click', simularInvestimento);

function simularInvestimento() {
    const valorInicial = parseFloat(document.getElementById('valorInicial').value) || 0;
    const aporteMensal = parseFloat(document.getElementById('aporteMensal').value) || 0;
    const percentualCDI = parseFloat(document.getElementById('percentualCDI').value) || 0;
    const cdiAnual = parseFloat(document.getElementById('cdiAnual').value.toString().replace(',', '.')) || 0;
    const meses = parseInt(document.getElementById('mesesRendimento').value) || 1;

    const taxaAnualDecimal = (cdiAnual / 100) * (percentualCDI / 100);
    const taxaMensal = Math.pow(1 + taxaAnualDecimal, 1 / 12) - 1;

    const tbody = document.querySelector('#tabelaMeses tbody');
    tbody.innerHTML = '';

    let valorAtual = valorInicial;
    let totalInvestido = valorInicial;

    for (let mes = 1; mes <= meses; mes++) {
        const valorInicialMes = valorAtual;
        const rendimentoMes = valorAtual * taxaMensal;
        valorAtual += rendimentoMes + aporteMensal;
        totalInvestido += aporteMensal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Mês ${mes}</td>
            <td>${formatarMoeda(valorInicialMes)}</td>
            <td>${formatarMoeda(aporteMensal)}</td>
            <td class="verde">+ ${formatarMoeda(rendimentoMes)}</td>
            <td class="verde"><strong>${formatarMoeda(valorAtual)}</strong></td>
        `;
        tbody.appendChild(tr);
    }

    const totalRendimento = valorAtual - totalInvestido;

    document.getElementById('valorFinal').textContent = formatarMoeda(valorAtual);
    document.getElementById('totalInvestido').textContent = formatarMoeda(totalInvestido);
    document.getElementById('totalRendimento').textContent = formatarMoeda(totalRendimento);
    document.getElementById('resultadoInvestimento').style.display = 'block';
    document.getElementById('resultadoInvestimento').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

atualizarResumo();
renderizarTransacoes();
atualizarResumoPrevisoes();
renderizarPrevisoes();
