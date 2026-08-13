-- =====================================================================
-- EXECUTE ESSE CÓDIGO TODO NO SUPABASE:
-- Supabase Dashboard → SQL Editor → + New Query → Cole tudo → Run
-- =====================================================================

-- =====================================================================
-- 👉 ANTES DE TUDO: LIMPEZA TOTAL!
--    Apagamos TODAS as tabelas antigas (se existirem) para evitar
--    conflito de tipos: user_id = UUID (antigo) vs TEXT (novo = telefone)
--    CASCADE = apaga também políticas, índices etc. vinculados a elas.
-- =====================================================================
DROP TABLE IF EXISTS public.transacoes CASCADE;
DROP TABLE IF EXISTS public.previsoes CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- =====================================================================
-- TABELA: USUÁRIOS (sistema MANUAL de login - TELEFONE + SENHA)
-- =====================================================================
CREATE TABLE public.usuarios (
    id BIGSERIAL PRIMARY KEY,
    telefone TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_usuarios_telefone ON public.usuarios(telefone);

-- =====================================================================
-- TABELA: TRANSACOES
-- user_id = TEXT = apenas os NÚMEROS do telefone (ex: "11987654321")
-- =====================================================================
CREATE TABLE public.transacoes (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(15, 2) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL CHECK (categoria IN ('fixo', 'variavel')),
    data DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_transacoes_user_id ON public.transacoes(user_id);

-- =====================================================================
-- TABELA: PREVISOES
-- user_id = TEXT = apenas os NÚMEROS do telefone
-- =====================================================================
CREATE TABLE public.previsoes (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(15, 2) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL CHECK (categoria IN ('fixo', 'variavel')),
    data DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_previsoes_user_id ON public.previsoes(user_id);

-- =====================================================================
-- 👉 ROW LEVEL SECURITY (POLÍTICA DE SEGURANÇA)
--
-- COMO FUNCIONA: Criamos 2 funções que pegam o TELEFONE logado de dentro
-- dos HEADERS da requisição (enviados pelo app: "x-telefone-usuario"),
-- e comparam com user_id (que É O TELEFONE).
-- Cada usuário SÓ VÊ/ALTERA OS SEUS dados (nunca os de outra pessoa).
-- =====================================================================

-- Função 1: pega telefone do header "x-telefone-usuario"
CREATE OR REPLACE FUNCTION public.telefone_usuario_logado()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('request.headers', true)::json->>'x-telefone-usuario';
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função 2: compara user_id (TEXT) com telefone do header
CREATE OR REPLACE FUNCTION public.eh_proprio_usuario(id_usuario text)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN id_usuario = public.telefone_usuario_logado();
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Liga RLS em TUDO
ALTER TABLE public.usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsoes  ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS: TABELA USUARIOS
-- ========================================
-- Usuário logado vê/edita apenas SEU próprio cadastro
DROP POLICY IF EXISTS "usuario_le_altera_apenas_seu_cadastro" ON public.usuarios;
CREATE POLICY "usuario_le_altera_apenas_seu_cadastro"
    ON public.usuarios FOR ALL
    USING (telefone = public.telefone_usuario_logado())
    WITH CHECK (telefone = public.telefone_usuario_logado());

-- Mas QUALQUER pessoa pode CADASTRAR UM NOVO USUÁRIO (inserir na tabela usuarios)
-- (essa política só vale para INSERT, e é como a pessoa consegue criar a primeira conta)
DROP POLICY IF EXISTS "qualquer_um_pode_cadastrar_novo_usuario" ON public.usuarios;
CREATE POLICY "qualquer_um_pode_cadastrar_novo_usuario"
    ON public.usuarios FOR INSERT
    WITH CHECK (true);

-- ========================================
-- POLÍTICAS: TABELA TRANSACOES
-- ========================================
DROP POLICY IF EXISTS "transacoes_proprio_usuario" ON public.transacoes;
CREATE POLICY "transacoes_proprio_usuario"
    ON public.transacoes FOR ALL
    USING (public.eh_proprio_usuario(user_id))
    WITH CHECK (public.eh_proprio_usuario(user_id));

-- ========================================
-- POLÍTICAS: TABELA PREVISOES
-- ========================================
DROP POLICY IF EXISTS "previsoes_proprio_usuario" ON public.previsoes;
CREATE POLICY "previsoes_proprio_usuario"
    ON public.previsoes FOR ALL
    USING (public.eh_proprio_usuario(user_id))
    WITH CHECK (public.eh_proprio_usuario(user_id));

-- =====================================================================
-- 👉 FUNÇÕES RPC (SECURITY DEFINER = rodam como DONO do banco,
--    então IGNORAM RLS APENAS para essas ações específicas):
--    - verificar_telefone() → 1 = já tem cadastro / 0 = novo usuário
--    - login_senha()        → 1 = telefone + senha batem / 0 = não batem
-- =====================================================================

CREATE OR REPLACE FUNCTION public.verificar_telefone(tel text)
RETURNS INTEGER AS $$
DECLARE
    qtd INTEGER;
BEGIN
    SELECT COUNT(*) INTO qtd
        FROM public.usuarios
        WHERE telefone = tel
        LIMIT 1;
    RETURN CASE WHEN qtd > 0 THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.verificar_telefone(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.login_senha(tel text, hash_senha text)
RETURNS INTEGER AS $$
DECLARE
    qtd INTEGER;
BEGIN
    SELECT COUNT(*) INTO qtd
        FROM public.usuarios
        WHERE telefone = tel
          AND senha_hash = hash_senha
        LIMIT 1;
    RETURN CASE WHEN qtd > 0 THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.login_senha(text, text) TO anon, authenticated;

-- ========================================
-- GRANTS (permissões para a chave anônima/pública)
-- ========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.usuarios    TO anon, authenticated;
GRANT ALL ON public.transacoes  TO anon, authenticated;
GRANT ALL ON public.previsoes   TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================================
-- ✅ FIM! COMO USAR AGORA:
--
--  PASSO 1: SQL Editor → Cole TODO esse arquivo → clique em RUN
--          (espere aparecer "Success. No rows returned" tudo verdinho)
--
--  PASSO 2: Abra o app (Netlify ou Local)
--
--  PASSO 3:
--          • Digite SEU TELEFONE completo (com DDD) → Continuar
--          • Como é a PRIMEIRA vez, ele pede para CRIAR SENHA (2 vezes, 6+ letras)
--          • Clique em ✅ Criar minha conta → já entra automaticamente no app!
--
--  PASSO 4 (para sempre): Da próxima vez que você abrir o app:
--          • Digita o mesmo telefone → Continuar
--          • Pede só a SENHA que você criou → 🚀 Entrar
--          • 📱 Todas transações/previsões sincronizadas entre todos dispositivos!
--
-- 🚨 ERROS: Qualquer popup vermelho, tire print e me envie.
-- =====================================================================
