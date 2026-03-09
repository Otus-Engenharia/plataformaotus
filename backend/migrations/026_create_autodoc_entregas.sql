-- Mapping: vincula projetos Autodoc aos project_code do portfolio
CREATE TABLE autodoc_project_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_project_code TEXT NOT NULL,
  autodoc_customer_id TEXT NOT NULL,
  autodoc_customer_name TEXT,
  autodoc_project_folder_id TEXT NOT NULL,
  autodoc_project_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(autodoc_customer_id, autodoc_project_folder_id)
);

-- Documentos sincronizados
CREATE TABLE autodoc_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  autodoc_doc_id TEXT NOT NULL UNIQUE,
  autodoc_customer_id TEXT NOT NULL,
  project_code TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_code TEXT,
  revision TEXT,
  phase_name TEXT,
  discipline_name TEXT,
  format_folder TEXT,
  file_url TEXT,
  raw_size INTEGER,
  status TEXT,
  autodoc_status_name TEXT,
  author TEXT,
  classification TEXT,
  previous_revision TEXT,
  previous_phase TEXT,
  autodoc_created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_autodoc_docs_project ON autodoc_documents(project_code);
CREATE INDEX idx_autodoc_docs_created ON autodoc_documents(autodoc_created_at DESC);
CREATE INDEX idx_autodoc_docs_code ON autodoc_documents(document_code);

-- Log de sync runs
CREATE TABLE autodoc_sync_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  autodoc_customer_id TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  projects_scanned INTEGER DEFAULT 0,
  documents_found INTEGER DEFAULT 0,
  new_documents INTEGER DEFAULT 0,
  error TEXT,
  status TEXT DEFAULT 'running'
);
