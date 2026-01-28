-- ============================================================
-- PLATAFORMA OTUS - SISTEMA COMPLETO DE INDICADORES
-- Baseado em: github.com/Otus-Engenharia/indicadores
-- ============================================================
-- Criado em: 2026-01-27
-- Descrição: Estrutura completa para sistema de indicadores individuais
-- com templates por cargo, check-ins mensais, scoring avançado
-- ============================================================

-- ============================================================
-- LIMPEZA: Remove tabelas existentes (se houver)
-- ============================================================
-- ATENÇÃO: Isso irá deletar TODOS os dados das tabelas!
-- Execute apenas se não houver dados importantes.

-- Remove triggers primeiro
DROP TRIGGER IF EXISTS trigger_update_okr_progress ON public.key_results;
DROP TRIGGER IF EXISTS set_updated_at_okrs ON public.okrs;
DROP TRIGGER IF EXISTS set_updated_at_key_results ON public.key_results;
DROP TRIGGER IF EXISTS set_updated_at_indicadores ON public.indicadores;
DROP TRIGGER IF EXISTS update_positions_updated_at ON public.positions;
DROP TRIGGER IF EXISTS update_position_indicators_updated_at ON public.position_indicators;
DROP TRIGGER IF EXISTS update_indicators_updated_at ON public.indicators;

-- Remove tabelas (CASCADE remove dependências automaticamente)
DROP TABLE IF EXISTS public.recovery_plan_actions CASCADE;
DROP TABLE IF EXISTS public.recovery_plans CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.indicators CASCADE;
DROP TABLE IF EXISTS public.position_indicators CASCADE;
DROP TABLE IF EXISTS public.positions CASCADE;
DROP TABLE IF EXISTS public.indicadores_historico CASCADE;
DROP TABLE IF EXISTS public.indicadores CASCADE;
DROP TABLE IF EXISTS public.key_results CASCADE;
DROP TABLE IF EXISTS public.okrs CASCADE;
DROP TABLE IF EXISTS public.initiatives CASCADE;
DROP TABLE IF EXISTS public.objectives CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.sectors CASCADE;
DROP TABLE IF EXISTS public.invites CASCADE;

-- Remove funções
DROP FUNCTION IF EXISTS update_okr_progress() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS calcular_tendencia_indicador(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_leader() CASCADE;
DROP FUNCTION IF EXISTS is_leader_of_sector(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_objective_sector(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_kr_sector(UUID) CASCADE;
DROP FUNCTION IF EXISTS can_view_person_indicators(UUID) CASCADE;

-- Remove tipos ENUM
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.metric_type CASCADE;
DROP TYPE IF EXISTS public.cycle_type CASCADE;
DROP TYPE IF EXISTS public.kr_status CASCADE;
DROP TYPE IF EXISTS public.plan_status CASCADE;
DROP TYPE IF EXISTS public.consolidation_type CASCADE;

-- ============================================================
-- INSTRUÇÕES IMPORTANTES
-- ============================================================
-- ⚠️ EXECUTE ESTE SCRIPT COMPLETO DE UMA VEZ NO SUPABASE SQL EDITOR
-- ⚠️ NÃO execute partes isoladas - o script depende da ordem de criação
-- ⚠️ Se houver erro, execute TODO o script novamente (os DROP IF EXISTS são seguros)
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'leader');
CREATE TYPE public.metric_type AS ENUM ('number', 'percentage', 'boolean', 'currency');
CREATE TYPE public.cycle_type AS ENUM ('annual', 'q1', 'q2', 'q3', 'q4');
CREATE TYPE public.kr_status AS ENUM ('on_track', 'at_risk', 'delayed', 'completed');
CREATE TYPE public.plan_status AS ENUM ('pending', 'in_progress', 'completed', 'not_achieved');
CREATE TYPE public.consolidation_type AS ENUM ('sum', 'average', 'last_value', 'manual');

-- ============================================================
-- 2. SECTORS (Setores)
-- ============================================================
-- IMPORTANTE: Esta tabela deve ser criada PRIMEIRO (sem dependências)
CREATE TABLE public.sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. POSITIONS (Cargos)
-- ============================================================
-- IMPORTANTE: Esta tabela DEVE ser criada ANTES de 'profiles' e 'position_indicators'
-- pois ambas referenciam esta tabela
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_leadership BOOLEAN NOT NULL DEFAULT false,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. PROFILES (Perfis de Usuários)
-- ============================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. USER ROLES (Roles de Usuários)
-- ============================================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. POSITION_INDICATORS (Templates de Indicadores por Cargo)
-- ============================================================
CREATE TABLE public.position_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    metric_type metric_type NOT NULL DEFAULT 'number',
    consolidation_type consolidation_type NOT NULL DEFAULT 'last_value',
    default_initial NUMERIC NOT NULL DEFAULT 0,
    default_target NUMERIC NOT NULL,
    default_threshold_80 NUMERIC NOT NULL,
    default_threshold_120 NUMERIC NOT NULL,
    default_weight INTEGER NOT NULL DEFAULT 1 CHECK (default_weight >= 0 AND default_weight <= 100),
    is_inverse BOOLEAN NOT NULL DEFAULT false,
    monthly_targets JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.position_indicators ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. INDICATORS (Indicadores Individuais)
-- ============================================================
CREATE TABLE public.indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES public.position_indicators(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    metric_type metric_type NOT NULL DEFAULT 'number',
    consolidation_type consolidation_type NOT NULL DEFAULT 'last_value',
    initial_value NUMERIC NOT NULL DEFAULT 0,
    target_value NUMERIC NOT NULL,
    threshold_80 NUMERIC NOT NULL,
    threshold_120 NUMERIC NOT NULL,
    current_value NUMERIC NOT NULL DEFAULT 0,
    weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 100),
    status kr_status NOT NULL DEFAULT 'on_track',
    cycle cycle_type NOT NULL,
    year INTEGER NOT NULL,
    monthly_targets JSONB DEFAULT '{}'::jsonb,
    is_inverse BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. CHECK_INS (Check-ins Mensais)
-- ============================================================
CREATE TABLE public.check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id UUID REFERENCES public.key_results(id) ON DELETE CASCADE,
    indicator_id UUID REFERENCES public.indicators(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    value NUMERIC NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Garante que só há um check-in por mês/ano por indicador ou key_result
    CONSTRAINT check_in_unique CHECK (
        (key_result_id IS NOT NULL AND indicator_id IS NULL) OR
        (key_result_id IS NULL AND indicator_id IS NOT NULL)
    )
);

-- Índice único para key_result
CREATE UNIQUE INDEX IF NOT EXISTS idx_check_ins_kr_unique 
ON public.check_ins(key_result_id, month, year) 
WHERE key_result_id IS NOT NULL;

-- Índice único para indicator
CREATE UNIQUE INDEX IF NOT EXISTS idx_check_ins_indicator_unique 
ON public.check_ins(indicator_id, month, year) 
WHERE indicator_id IS NOT NULL;

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. OBJECTIVES (Objetivos - para OKRs)
-- ============================================================
CREATE TABLE public.objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    cycle cycle_type NOT NULL,
    year INTEGER NOT NULL,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE,
    parent_objective_id UUID REFERENCES public.objectives(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. KEY_RESULTS (Resultados Chave - para OKRs)
-- ============================================================
CREATE TABLE public.key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID REFERENCES public.objectives(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    metric_type metric_type NOT NULL DEFAULT 'number',
    consolidation_type consolidation_type NOT NULL DEFAULT 'last_value',
    initial_value NUMERIC NOT NULL DEFAULT 0,
    target_value NUMERIC NOT NULL,
    current_value NUMERIC NOT NULL DEFAULT 0,
    weight INTEGER NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status kr_status NOT NULL DEFAULT 'on_track',
    monthly_targets JSONB DEFAULT '{}'::jsonb,
    is_inverse BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. INITIATIVES (Iniciativas - para OKRs)
-- ============================================================
CREATE TABLE public.initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    responsible_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. COMMENTS (Comentários)
-- ============================================================
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id UUID REFERENCES public.key_results(id) ON DELETE CASCADE,
    indicator_id UUID REFERENCES public.indicators(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT comment_target CHECK (
        (key_result_id IS NOT NULL AND indicator_id IS NULL) OR
        (key_result_id IS NULL AND indicator_id IS NOT NULL)
    )
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. RECOVERY_PLANS (Planos de Recuperação)
-- ============================================================
CREATE TABLE public.recovery_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id UUID REFERENCES public.key_results(id) ON DELETE CASCADE,
    indicator_id UUID REFERENCES public.indicators(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status plan_status NOT NULL DEFAULT 'pending',
    due_date DATE,
    outcome TEXT,
    reference_month INTEGER CHECK (reference_month >= 1 AND reference_month <= 12),
    reference_year INTEGER,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recovery_plan_target CHECK (
        (key_result_id IS NOT NULL AND indicator_id IS NULL) OR
        (key_result_id IS NULL AND indicator_id IS NOT NULL)
    )
);

ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 14. RECOVERY_PLAN_ACTIONS (Ações dos Planos de Recuperação)
-- ============================================================
CREATE TABLE public.recovery_plan_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_plan_id UUID NOT NULL REFERENCES public.recovery_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    responsible_id UUID REFERENCES public.profiles(id),
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_plan_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 15. INVITES (Convites de Usuários)
-- ============================================================
CREATE TABLE public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT unique_pending_invite UNIQUE (email)
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sectors_name ON public.sectors(name);
CREATE INDEX IF NOT EXISTS idx_profiles_sector_id ON public.profiles(sector_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON public.profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_sector_id ON public.positions(sector_id);
CREATE INDEX IF NOT EXISTS idx_position_indicators_position_id ON public.position_indicators(position_id);
CREATE INDEX IF NOT EXISTS idx_indicators_person_id ON public.indicators(person_id);
CREATE INDEX IF NOT EXISTS idx_indicators_cycle_year ON public.indicators(cycle, year);
CREATE INDEX IF NOT EXISTS idx_indicators_source_template ON public.indicators(source_template_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_indicator_id ON public.check_ins(indicator_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_key_result_id ON public.check_ins(key_result_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_month_year ON public.check_ins(year, month);
CREATE INDEX IF NOT EXISTS idx_comments_indicator_id ON public.comments(indicator_id);
CREATE INDEX IF NOT EXISTS idx_comments_key_result_id ON public.comments(key_result_id);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_indicator_id ON public.recovery_plans(indicator_id);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_key_result_id ON public.recovery_plans(key_result_id);
CREATE INDEX IF NOT EXISTS idx_objectives_sector ON public.objectives(sector_id);
CREATE INDEX IF NOT EXISTS idx_objectives_cycle_year ON public.objectives(cycle, year);
CREATE INDEX IF NOT EXISTS idx_key_results_objective_id ON public.key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_key_results_owner_id ON public.key_results(owner_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_objective_id ON public.initiatives(objective_id);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verificar se usuário tem role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Verificar se usuário é leader
CREATE OR REPLACE FUNCTION public.is_leader()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(auth.uid(), 'leader')
$$;

-- Verificar se pode ver indicadores de uma pessoa
CREATE OR REPLACE FUNCTION public.can_view_person_indicators(target_person_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin vê tudo
  IF public.is_admin() THEN RETURN TRUE; END IF;
  
  -- Própria pessoa
  IF auth.uid() = target_person_id THEN RETURN TRUE; END IF;
  
  -- Mesmo setor
  IF EXISTS (
    SELECT 1 FROM public.profiles p1, public.profiles p2
    WHERE p1.id = auth.uid()
    AND p2.id = target_person_id
    AND p1.sector_id = p2.sector_id
    AND p1.sector_id IS NOT NULL
  ) THEN RETURN TRUE; END IF;
  
  -- Líder vê outros líderes
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur1, public.user_roles ur2
    WHERE ur1.user_id = auth.uid() AND ur1.role = 'leader'
    AND ur2.user_id = target_person_id AND ur2.role = 'leader'
  ) THEN RETURN TRUE; END IF;
  
  RETURN FALSE;
END;
$$;

-- Atualizar progresso do OKR baseado nos Key Results
CREATE OR REPLACE FUNCTION update_okr_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza o objetivo pai se houver
  UPDATE public.objectives o
  SET updated_at = NOW()
  WHERE o.id IN (
    SELECT objective_id FROM public.key_results WHERE id = COALESCE(NEW.id, OLD.id)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Triggers para updated_at
CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_position_indicators_updated_at BEFORE UPDATE ON public.position_indicators
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_indicators_updated_at BEFORE UPDATE ON public.indicators
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_check_ins_updated_at BEFORE UPDATE ON public.check_ins
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_objectives_updated_at BEFORE UPDATE ON public.objectives
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_key_results_updated_at BEFORE UPDATE ON public.key_results
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_initiatives_updated_at BEFORE UPDATE ON public.initiatives
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recovery_plans_updated_at BEFORE UPDATE ON public.recovery_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recovery_plan_actions_updated_at BEFORE UPDATE ON public.recovery_plan_actions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar progresso do OKR quando Key Result é modificado
CREATE TRIGGER trigger_update_okr_progress
AFTER INSERT OR UPDATE OR DELETE ON public.key_results
FOR EACH ROW
EXECUTE FUNCTION update_okr_progress();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================================

-- SECTORS: Todos podem ler, apenas admins podem modificar
CREATE POLICY "Anyone can view sectors" ON public.sectors FOR SELECT USING (true);
CREATE POLICY "Admins can insert sectors" ON public.sectors FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update sectors" ON public.sectors FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete sectors" ON public.sectors FOR DELETE USING (public.is_admin());

-- PROFILES: Usuários podem ver todos, atualizar próprio
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.is_admin());

-- USER ROLES: Apenas admins podem gerenciar, usuários podem ver próprio
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin());

-- POSITIONS: Todos podem ler, apenas admins podem modificar
CREATE POLICY "Anyone can view positions" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Admins can insert positions" ON public.positions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update positions" ON public.positions FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete positions" ON public.positions FOR DELETE USING (public.is_admin());

-- POSITION_INDICATORS: Todos podem ler, apenas admins podem modificar
CREATE POLICY "Anyone can view position indicators" ON public.position_indicators FOR SELECT USING (true);
CREATE POLICY "Admins can insert position indicators" ON public.position_indicators FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update position indicators" ON public.position_indicators FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete position indicators" ON public.position_indicators FOR DELETE USING (public.is_admin());

-- INDICATORS: Visibilidade baseada em regras, leaders podem gerenciar
CREATE POLICY "Users can view indicators based on visibility rules" ON public.indicators FOR SELECT
    USING (public.can_view_person_indicators(person_id));
CREATE POLICY "Leaders can insert indicators" ON public.indicators FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update indicators" ON public.indicators FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete indicators" ON public.indicators FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- CHECK_INS: Leaders podem gerenciar, todos podem ver baseado em visibilidade do indicador/key_result
CREATE POLICY "Authenticated users can view check-ins" ON public.check_ins FOR SELECT 
    TO authenticated USING (true);
CREATE POLICY "Leaders can insert check-ins" ON public.check_ins FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update check-ins" ON public.check_ins FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete check-ins" ON public.check_ins FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- OBJECTIVES: Leaders podem gerenciar, todos podem ver
CREATE POLICY "Anyone can view objectives" ON public.objectives FOR SELECT USING (true);
CREATE POLICY "Leaders can insert objectives" ON public.objectives FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update objectives" ON public.objectives FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete objectives" ON public.objectives FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- KEY_RESULTS: Leaders podem gerenciar, todos podem ver
CREATE POLICY "Anyone can view key results" ON public.key_results FOR SELECT USING (true);
CREATE POLICY "Leaders can insert key results" ON public.key_results FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update key results" ON public.key_results FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete key results" ON public.key_results FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- INITIATIVES: Leaders podem gerenciar, todos podem ver
CREATE POLICY "Anyone can view initiatives" ON public.initiatives FOR SELECT USING (true);
CREATE POLICY "Leaders can insert initiatives" ON public.initiatives FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update initiatives" ON public.initiatives FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete initiatives" ON public.initiatives FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- COMMENTS: Qualquer líder pode comentar
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Leaders can insert comments" ON public.comments FOR INSERT 
    WITH CHECK (auth.uid() = author_id AND (public.is_admin() OR public.is_leader()));
CREATE POLICY "Authors can update own comments" ON public.comments FOR UPDATE 
    USING (auth.uid() = author_id OR public.is_admin());
CREATE POLICY "Authors can delete own comments" ON public.comments FOR DELETE 
    USING (auth.uid() = author_id OR public.is_admin());

-- RECOVERY_PLANS: Leaders podem gerenciar
CREATE POLICY "Anyone can view recovery plans" ON public.recovery_plans FOR SELECT USING (true);
CREATE POLICY "Leaders can insert recovery plans" ON public.recovery_plans FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update recovery plans" ON public.recovery_plans FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete recovery plans" ON public.recovery_plans FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- RECOVERY_PLAN_ACTIONS: Leaders podem gerenciar
CREATE POLICY "Anyone can view recovery plan actions" ON public.recovery_plan_actions FOR SELECT USING (true);
CREATE POLICY "Leaders can insert recovery plan actions" ON public.recovery_plan_actions FOR INSERT 
    WITH CHECK (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can update recovery plan actions" ON public.recovery_plan_actions FOR UPDATE 
    USING (public.is_admin() OR public.is_leader());
CREATE POLICY "Leaders can delete recovery plan actions" ON public.recovery_plan_actions FOR DELETE 
    USING (public.is_admin() OR public.is_leader());

-- INVITES: Apenas admins podem gerenciar
CREATE POLICY "Admins can view invites" ON public.invites FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert invites" ON public.invites FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update invites" ON public.invites FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete invites" ON public.invites FOR DELETE USING (public.is_admin());

-- ============================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE public.sectors IS 'Setores da empresa';
COMMENT ON TABLE public.profiles IS 'Perfis de usuários vinculados a auth.users';
COMMENT ON TABLE public.user_roles IS 'Roles de usuários (admin, leader)';
COMMENT ON TABLE public.positions IS 'Cargos da empresa';
COMMENT ON TABLE public.position_indicators IS 'Templates de indicadores por cargo';
COMMENT ON TABLE public.indicators IS 'Indicadores individuais de desempenho';
COMMENT ON TABLE public.check_ins IS 'Check-ins mensais de indicadores ou key results';
COMMENT ON TABLE public.objectives IS 'Objetivos (para OKRs)';
COMMENT ON TABLE public.key_results IS 'Key Results (para OKRs)';
COMMENT ON TABLE public.initiatives IS 'Iniciativas (para OKRs)';
COMMENT ON TABLE public.comments IS 'Comentários em indicadores ou key results';
COMMENT ON TABLE public.recovery_plans IS 'Planos de recuperação para indicadores/key results em risco';
COMMENT ON TABLE public.recovery_plan_actions IS 'Ações dos planos de recuperação';

COMMENT ON COLUMN public.indicators.consolidation_type IS 'Tipo de consolidação: sum (soma), average (média), last_value (último valor), manual (manual)';
COMMENT ON COLUMN public.indicators.is_inverse IS 'Quando true, valores menores são melhores (ex: turnover, acidentes)';
COMMENT ON COLUMN public.indicators.monthly_targets IS 'Metas mensais em formato JSON: {"1": 10, "2": 15, ...}';
COMMENT ON COLUMN public.position_indicators.monthly_targets IS 'Metas mensais padrão do template';

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
-- Execute esta query para verificar se todas as tabelas foram criadas:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('sectors', 'positions', 'profiles', 'user_roles', 'position_indicators', 'indicators', 'check_ins', 'objectives', 'key_results', 'initiatives', 'comments', 'recovery_plans', 'recovery_plan_actions', 'invites')
-- ORDER BY table_name;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
-- ✅ Se você chegou até aqui sem erros, todas as tabelas foram criadas com sucesso!
-- ✅ Verifique se a tabela 'positions' existe executando: SELECT * FROM public.positions LIMIT 1;