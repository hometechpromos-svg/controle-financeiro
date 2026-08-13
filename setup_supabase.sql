-- =====================================================================
-- EXECUTE ESSE CÓDIGO NO SUPABASE:
-- Acesse: Supabase Dashboard → SQL Editor → + New Query
-- Cole tudo aqui → clique em "Run"
-- =====================================================================

-- TABELA DE USUÁRIOS (auth.users já existe no Supabase automaticamente)

-- =====================================================================
-- TABELA: TRANSACOES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.transacoes (
    id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor NUMERIC(15, 2) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL CHECK (categoria IN ('fixo', 'variavel')),
    data DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON public.transacoes(user_id);

-- =====================================================================
-- TABELA: PREVISOES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.previsoes (
    id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor NUMERIC(15, 2) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria TEXT NOT NULL CHECK (categoria IN ('fixo', 'variavel')),
    data DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_previsoes_user_id ON public.previsoes(user_id);

-- =====================================================================
-- ROW LEVEL SECURITY (POLÍTICA DE SEGURANÇA):
-- CADA USUÁRIO SÓ VÊ/ALTERA OS PRÓPRIOS DADOS
-- =====================================================================
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsoes ENABLE ROW LEVEL SECURITY;

-- ---- Políticas da tabela transacoes ----
DROP POLICY IF EXISTS "Usuário lê próprias transações" ON public.transacoes;
CREATE POLICY "Usuário lê próprias transações"
    ON public.transacoes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário insere próprias transações" ON public.transacoes;
CREATE POLICY "Usuário insere próprias transações"
    ON public.transacoes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário atualiza próprias transações" ON public.transacoes;
CREATE POLICY "Usuário atualiza próprias transações"
    ON public.transacoes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário apaga próprias transações" ON public.transacoes;
CREATE POLICY "Usuário apaga próprias transações"
    ON public.transacoes FOR DELETE
    USING (auth.uid() = user_id);

-- ---- Políticas da tabela previsoes ----
DROP POLICY IF EXISTS "Usuário lê próprias previsões" ON public.previsoes;
CREATE POLICY "Usuário lê próprias previsões"
    ON public.previsoes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário insere próprias previsões" ON public.previsoes;
CREATE POLICY "Usuário insere próprias previsões"
    ON public.previsoes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário atualiza próprias previsões" ON public.previsoes;
CREATE POLICY "Usuário atualiza próprias previsões"
    ON public.previsoes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário apaga próprias previsões" ON public.previsoes;
CREATE POLICY "Usuário apaga próprias previsões"
    ON public.previsoes FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================================
-- SUGESTÃO: Ative também a confirmação por email ou desative:
-- Supabase Dashboard → Authentication → Providers → Email
-- Desmarque "Confirm email" para não precisar confirmar email
-- =====================================================================
