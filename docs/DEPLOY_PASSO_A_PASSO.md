# Deploy passo a passo – Plataforma Otus no VPS Hostinger

Este guia leva você **passo a passo** no deploy. Em cada etapa você verá:
- **O que estamos fazendo** e por quê.
- **👉 SUA AÇÃO** quando precisar fazer algo — siga na ordem indicada.
- **Como conferir** se deu certo antes de seguir.

O deploy usa **Docker**, em um projeto separado (**plataformaotus**). O **automacoes** (n8n, waha, nginx) **não é alterado**: usamos só a porta **3001** e outro projeto Docker.

**Comece por aqui:** Use o **Passo 0** com o **MCP Hostinger** (e, se quiser, **GitHub**) para validar a VPS, listar projetos e, opcionalmente, criar o **plataformaotus** direto do repositório. Quem roda o assistente (ex.: Cursor) pode executar as chamadas do MCP por você.

---

## Visão geral do que vamos fazer

| # | O que fazemos | Onde |
|---|----------------|------|
| **0** | **Validar VPS com MCP Hostinger** (e opcionalmente criar projeto via GitHub) | MCP Hostinger |
| 1 | Preparar o projeto no PC (repo, .env, credenciais, OAuth) | Seu computador |
| 2 | Enviar o projeto para o VPS (ou já criado via MCP + GitHub) | PC → VPS ou MCP |
| 3 | Verificar se a porta 3001 está livre | VPS (Terminal) ou já conferido no Passo 0 |
| 4 | Subir o container **plataformaotus** (ou via MCP) | VPS (Docker/Terminal) ou MCP |
| 5 | Testar o app e conferir os outros projetos | Navegador + Gerenciador Docker |

---

## Passo 0: Validar a VPS com o MCP Hostinger (e GitHub)

**O que é:** Usar o **MCP da Hostinger** para checar a VPS, os projetos Docker e a porta 3001 **sem** precisar abrir o Terminal. Quem estiver rodando o assistente (ex.: no Cursor) pode executar essas chamadas por você.

### O que o MCP faz por você

1. **Listar VMs** (`VPS_getVirtualMachinesV1`)  
   - Confirma qual VPS está ativa e o **ID** (ex.: **983035**).

2. **Detalhes da VM** (`VPS_getVirtualMachineDetailsV1`)  
   - IP, hostname, plano, estado, template (ex.: Ubuntu 24.04 with Docker).

3. **Listar projetos Docker** (`VPS_getProjectListV1`)  
   - Quais projetos existem, status, **portas em uso** e path do `docker-compose`.

4. **Listar firewall** (`VPS_getFirewallListV1`)  
   - Se há regras de firewall na API da Hostinger (não substitui o firewall do SO).

**Resultado típico (exemplo da sua VPS):**

- **VPS:** ID **983035**, **srv983035.hstgr.cloud**, IP **72.60.60.117**, estado **running**, Ubuntu 24.04 with Docker.
- **Projetos:** **automacoes** (3 containers: n8n **5678**, waha **3000**, nginx **80/443**), path `/root/automacoes/docker-compose.yml`.
- **Porta 3001:** nenhum projeto usa → **livre** para o **plataformaotus**.
- **Firewall (API):** lista vazia (usa o do SO ou nenhum).

**👉 SUA AÇÃO (Passo 0):**

- **Nenhuma.** Só conferir se os dados acima batem com o que você vê no painel.  
- Se estiver usando o assistente com MCP, peça: *“Usa o MCP Hostinger para validar a VPS e listar os projetos”*.  
- Anote o **IP** (ex.: **72.60.60.117**) e o **ID da VM** (**983035**) para os próximos passos.

**Como conferir:** Você sabe qual é sua VPS, que o **automacoes** está rodando e que a **3001** está livre.

**Próximo:** Passo 1 — Preparar o projeto no PC. Use o IP **72.60.60.117** em `GOOGLE_CALLBACK_URL` e `FRONTEND_URL` no `.env`.

---

### Opcional: criar o projeto **plataformaotus** via MCP + GitHub

O MCP Hostinger tem **`VPS_createNewProjectV1`**: cria um projeto Docker a partir do **`docker-compose`** do repositório **GitHub**.

- **Parâmetros:** `virtualMachineId` = **983035**, `project_name` = **plataformaotus**, `content` = **URL do repo** (ex.: `https://github.com/Otus-Engenharia/plataformaotus`).
- A Hostinger usa o **`docker-compose.yaml` na branch *master***. Se seu repositório usar **main**, confira na documentação da Hostinger se há suporte; em caso de dúvida, use a branch **master** ou garanta que o `docker-compose` exista nela.

**⚠️ Repositório privado:** O VPS clona o GitHub via HTTPS **sem** credenciais. Se o repo for **privado**, o clone falha (`could not read Username for 'https://github.com'`). Nesse caso:
  - **Opção 1:** Deixar o repositório **público** (ou criar um clone público só para deploy), ou  
  - **Opção 2:** Usar o fluxo **SCP/Terminal** (Passo 2, Opções A ou B) em vez do MCP + GitHub.

**Limitação:** O compose usa `env_file: ./backend/.env` e um **volume** para `service-account-key.json`. Esses arquivos **não** vão no Git. Então:

1. O MCP **cria** o projeto (clone + build + sobe os containers).  
2. Os containers podem **falhar** ao iniciar por falta de `.env` e da key.  
3. **Você** precisa colocar `backend/.env` e `backend/service-account-key.json` no path do projeto no VPS (ex.: **`/docker/plataformaotus/backend/`**), via **SSH** ou **Gerenciador de Arquivos** do painel.  
4. Depois, **reiniciar** o projeto (Terminal: `docker compose restart` no path do projeto, ou MCP `VPS_restartProjectV1`).

**👉 SUA AÇÃO (se usar MCP + GitHub):**

1. Peça ao assistente: *“Cria o projeto **plataformaotus** no VPS 983035 usando o repositório **https://github.com/SEU_USUARIO/relatorio**”* (troque pela URL real).  
2. Complete o **Passo 1** (`.env`, service-account, OAuth) no PC.  
3. Envie **`.env`** e **`service-account-key.json`** para **`/docker/plataformaotus/backend/`** no VPS (SCP, SFTP ou painel).  
4. Reinicie o projeto (Terminal ou MCP).  
5. Siga o **Passo 5** para testar no navegador.

**Como conferir:** O projeto **plataformaotus** aparece na lista de projetos (MCP `VPS_getProjectListV1` ou Gerenciador Docker) e o container sobe após você colocar os arquivos e reiniciar.

---

## Passo 1: Preparar o projeto no seu PC

Tudo que o Docker vai usar (código, config, credenciais) precisa estar pronto **no seu computador** antes de enviar ao VPS.

---

### 1.1 Clone ou atualize o repositório

**O que é:** Ter a pasta do projeto (ex.: `relatorio`) no seu PC, com o código mais recente.

**👉 SUA AÇÃO:**

1. Abra um **terminal** (PowerShell, CMD ou Git Bash) no seu PC.
2. Vá para uma pasta onde queira clonar (ex.: `C:\Users\SEU_USUARIO\Projects` ou `E:\Git`).
3. Rode **um** dos comandos:

   **Se ainda não clonou:**
   ```bash
   git clone https://github.com/SEU_USUARIO/relatorio.git
   cd relatorio
   ```

   **Se já clonou e só quer atualizar:**
   ```bash
   cd relatorio
   git pull origin main
   ```

4. Troque `SEU_USUARIO` pela sua conta/organização do GitHub e pela URL real do repositório, se for diferente.

**Como conferir:** Dentro da pasta do projeto existem `backend/`, `frontend/`, `Dockerfile` e `docker-compose.yml`.

**Próximo:** 1.2 Configurar variáveis de ambiente.

---

### 1.2 Configurar variáveis de ambiente (`.env`)

**O que é:** O backend usa um arquivo `.env` com credenciais e URLs. O Docker lê esse arquivo no deploy. Nunca commite o `.env` no Git.

**👉 SUA AÇÃO:**

1. Na pasta do projeto, copie o exemplo:
   ```bash
   cp backend/env.docker.example backend/.env
   ```
   (No Windows, se não tiver `cp`, use o Explorer: copie `backend/env.docker.example` e cole como `backend/.env`.)

2. Abra `backend/.env` em um editor de texto.

3. Preencha **todos** os valores, especialmente:

   | Variável | O que colocar | Exemplo |
   |----------|----------------|---------|
   | `GOOGLE_CLIENT_ID` | ID do cliente OAuth (Google Cloud) | `xxx.apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | Segredo do cliente OAuth | `GOCSPX-...` |
   | `GOOGLE_CALLBACK_URL` | URL de callback (troque pelo **IP do seu VPS**) | `http://72.60.60.117:3001/api/auth/google/callback` |
   | `FRONTEND_URL` | Mesma base do app (IP ou domínio) | `http://72.60.60.117:3001` |
   | `SESSION_SECRET` | String aleatória longa | Use `openssl rand -hex 32` ou gere uma senha forte |
   | `BIGQUERY_PROJECT_ID`, `BIGQUERY_DATASET`, etc. | Dados do BigQuery | Conforme seu projeto |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc. | Dados do Supabase | Conforme seu projeto |

4. **Importante:** Use o **mesmo** endereço (IP ou domínio) em `GOOGLE_CALLBACK_URL` e `FRONTEND_URL` — o mesmo que você usará para acessar o app no navegador (ex.: `http://72.60.60.117:3001`).

**Como conferir:** O arquivo `backend/.env` existe e não tem mais `SEU_IP` ou placeholders nos campos obrigatórios.

**Próximo:** 1.3 Credenciais do Google Cloud (Service Account).

---

### 1.3 Credenciais do Google Cloud (Service Account)

**O que é:** O BigQuery exige um arquivo JSON de Service Account. Esse arquivo fica só na sua máquina e no VPS; não deve ir para o Git.

**👉 SUA AÇÃO:**

1. No [Google Cloud Console](https://console.cloud.google.com/), vá em **IAM e administração** → **Contas de serviço**.
2. Crie uma conta de serviço (ou use uma existente) com permissão para o BigQuery.
3. Crie uma **chave JSON** e baixe o arquivo.
4. Renomeie o arquivo para `service-account-key.json` (se preferir).
5. Coloque o arquivo em:
   ```
   relatorio/backend/service-account-key.json
   ```
   Ou seja, dentro da pasta `backend` do projeto.

**Como conferir:** O caminho `backend/service-account-key.json` existe e é um JSON válido.

**Próximo:** 1.4 Configurar OAuth no Google Cloud.

---

### 1.4 Configurar OAuth no Google Cloud Console

**O que é:** O login usa Google OAuth. O Google só aceita redirecionamentos para URLs que você cadastrou. Precisamos registrar a URL de callback do app em produção.

**👉 SUA AÇÃO:**

1. Acesse [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Abra suas **Credenciais** → cliente **OAuth 2.0** (tipo “Aplicativo da Web”).
3. Em **URIs de redirecionamento autorizados**, **adicione** esta URL (use o IP da sua VPS; ex.: **72.60.60.117**):
   ```
   http://72.60.60.117:3001/api/auth/google/callback
   ```
4. Salve as alterações.

**Como conferir:** A URL de callback que você usa no `.env` (`GOOGLE_CALLBACK_URL`) é **exatamente** uma das “URIs de redirecionamento autorizados” no Google.

**Próximo:** Passo 2 — Enviar o projeto para o VPS.

---

## Passo 2: Enviar o projeto para o VPS

O Docker vai rodar no VPS. Por isso, o código, o `backend/.env` e o `backend/service-account-key.json` precisam estar **na pasta do projeto no VPS** (ex.: `/opt/relatorio` ou `/root/plataformaotus` se criou via MCP + GitHub).

**Opções:**

- **Se usou o Passo 0 (MCP + GitHub) e o clone deu certo:** o projeto **plataformaotus** já foi criado; o código está no VPS (ex.: **`/docker/plataformaotus`**). Você só precisa **enviar** `backend/.env` e `backend/service-account-key.json` para `backend/` nessa pasta (SCP/SFTP ou painel) e **reiniciar** o projeto.
- **Se não:** você pode **enviar tudo manualmente** (SCP/SFTP) ou **clonar no VPS** e depois colocar só `.env` e `service-account-key.json`. Escolha uma opção abaixo.

---

### Opção A: Envio manual (SCP / SFTP)

**O que é:** Gerar um pacote (.tar.gz) no PC, enviar ao VPS e extrair lá. Assim você garante que `.env` e `service-account-key.json` (que estão só no seu PC) também vão.

**👉 SUA AÇÃO:**

**No seu PC** (na pasta do projeto, ex.: `relatorio`):

1. Crie o pacote (excluindo `node_modules`, `.git`, `frontend/dist`):
   ```bash
   tar --exclude='node_modules' --exclude='.git' --exclude='frontend/dist' -czvf relatorio.tar.gz .
   ```
   No Windows, use **Git Bash** ou WSL; se usar outra ferramenta (ex.: 7-Zip), exclua as mesmas pastas.

2. Envie o arquivo para o VPS (ex.: IP **72.60.60.117**; troque user/caminho se precisar):
   ```bash
   scp relatorio.tar.gz root@72.60.60.117:/opt/relatorio/
   ```
   Se a pasta `/opt/relatorio` não existir no VPS, use outro destino (ex.: `/tmp/`) e crie `/opt/relatorio` depois.

**No VPS** (Terminal do painel Hostinger ou SSH):

3. Crie a pasta e extraia:
   ```bash
   sudo mkdir -p /opt/relatorio
   cd /opt/relatorio
   sudo tar -xzvf /opt/relatorio/relatorio.tar.gz
   ```
   (Ajuste o caminho do `.tar.gz` se tiver enviado para `/tmp` ou outro diretório.)

4. Ajuste dono dos arquivos, se necessário (troque `root` pelo usuário que roda o Docker):
   ```bash
   sudo chown -R root:root /opt/relatorio
   ```

**Como conferir:** No VPS, `ls /opt/relatorio` mostra `backend/`, `frontend/`, `Dockerfile`, `docker-compose.yml`. E existem `backend/.env` e `backend/service-account-key.json`.

**Próximo:** Passo 3 — Verificar a porta 3001.

---

### Opção B: Clone no VPS + enviar só `.env` e `service-account-key.json`

**O que é:** Clonar o repositório direto no VPS e depois enviar apenas os arquivos sensíveis (`.env` e JSON do Service Account) do seu PC, por SCP/SFTP.

**👉 SUA AÇÃO:**

**No VPS:**

1. Crie a pasta e clone (troque pela URL real do repo):
   ```bash
   sudo mkdir -p /opt/relatorio
   cd /opt/relatorio
   sudo git clone https://github.com/SEU_USUARIO/relatorio.git .
   ```
2. Ajuste permissões se necessário:
   ```bash
   sudo chown -R root:root /opt/relatorio
   ```

**No seu PC:**

3. Envie o `.env` e o `service-account-key.json` (ex.: IP **72.60.60.117**). Se criou o projeto via MCP + GitHub, use o path do projeto (ex.: `/root/plataformaotus`):
   ```bash
   scp backend/.env root@72.60.60.117:/opt/relatorio/backend/.env
   scp backend/service-account-key.json root@72.60.60.117:/opt/relatorio/backend/service-account-key.json
   ```
   Para projeto MCP: troque `/opt/relatorio` por **`/docker/plataformaotus`**.

**Como conferir:** No VPS, existem `backend/.env` e `backend/service-account-key.json` dentro de `/opt/relatorio`.

**Próximo:** Passo 3 — Verificar a porta 3001.

---

## Passo 3: Verificar que a porta 3001 está livre

**O que é:** A Plataforma Otus sobe na porta **3001**. Se outra aplicação já estiver usando essa porta no VPS, o container não sobe ou você terá conflito. Verificamos antes de subir o Docker.

**👉 SUA AÇÃO:**

1. Abra o **Terminal** do VPS (painel Hostinger ou SSH).
2. Rode:
   ```bash
   sudo ss -tulpn | grep 3001
   ```
   ou:
   ```bash
   sudo netstat -tulpn | grep 3001
   ```

3. **Se não aparecer nada:** a porta está livre → siga para o **Passo 4**.
4. **Se aparecer algum processo:** outra app está usando a 3001. Você pode:
   - Parar essa outra app ou mudar a porta dela, ou
   - Usar outra porta para a Plataforma Otus (aí é preciso ajustar `docker-compose` e `.env`).

**Como conferir:** O comando `grep 3001` não retorna nenhuma linha.

**Próximo:** Passo 4 — Subir o container.

---

## Passo 4: Subir o container (plataformaotus)

Aqui nós **soamos o projeto Docker** no VPS. O Gerenciador Docker da Hostinger usa Compose por trás; você pode fazer tudo pela **interface** ou pelo **Terminal**. Escolha uma via.

---

### 4.1 Via Gerenciador Docker (interface)

**O que é:** Criar um projeto **plataformaotus** no Gerenciador Docker, colar o `docker-compose`, fazer build e iniciar. O projeto fica **separado** do **automacoes**.

**👉 SUA AÇÃO:**

1. No painel Hostinger: **VPS** → **srv983035.hstgr.cloud** → **Gerenciador Docker**.

2. **Criar projeto:**
   - Clique em **Compose** (ou “Novo projeto”).
   - Nome do projeto: **plataformaotus**.
   - Deixe bem claro que é outro projeto, não o **automacoes**.

3. **Compose:**
   - Abra o `docker-compose.yml` do repositório (no PC ou no VPS).
   - Copie **todo** o conteúdo.
   - Cole no editor do Gerenciador Docker do projeto **plataformaotus**.

4. **Ajustar caminhos (se o projeto estiver em `/opt/relatorio`):**  
   Se a interface usar caminhos absolutos, confira:
   - `context` e `dockerfile` apontando para `/opt/relatorio`.
   - `env_file`: `/opt/relatorio/backend/.env`.
   - `volumes`: `/opt/relatorio/backend/service-account-key.json` → `/app/service-account-key.json`.

   O `docker-compose` na raiz do repo usa caminhos relativos (`./backend/.env`, etc.). Se o Compose for executado **a partir de** `/opt/relatorio`, isso já basta; caso a interface use outro diretório, adapte conforme a documentação do Gerenciador Docker.

5. **Build e início:**
   - Clique em **Build** (ou equivalente) para construir a imagem.
   - Depois em **Iniciar** (ou **Start**) para subir o container.

6. **Conferir:** Na lista de projetos, **plataformaotus** deve aparecer com o container **plataformaotus-app** em execução. O **automacoes** segue separado e intacto.

**Próximo:** Passo 5 — Testar o app.

---

### 4.2 Via Terminal do VPS

**O que é:** Entrar na pasta do projeto no VPS e rodar `docker compose build` e `docker compose up -d`. O Compose usa o `docker-compose.yml` e o `Dockerfile` dali.

**👉 SUA AÇÃO:**

1. Abra o **Terminal** do VPS (painel Hostinger ou SSH).

2. Vá para a pasta do projeto:
   ```bash
   cd /opt/relatorio
   ```

3. Build da imagem (sem usar cache, para garantir tudo atual):
   ```bash
   docker compose build --no-cache
   ```

4. Subir o container em segundo plano:
   ```bash
   docker compose up -d
   ```

5. Verificar se está rodando:
   ```bash
   docker ps | grep plataformaotus
   ```
   Deve aparecer o container **plataformaotus-app** (ou o nome do serviço), status “Up”.

**Como conferir:** `docker ps | grep plataformaotus` mostra o container ativo. O **automacoes** continua rodando normalmente.

**Próximo:** Passo 5 — Testar o app.

---

## Passo 5: Testar o app e conferir os outros projetos

**O que é:** Abrir a Plataforma Otus no navegador, testar login (Google) e garantir que **automacoes** (n8n, waha, nginx) continuam funcionando.

---

### 5.1 Testar a Plataforma Otus

**👉 SUA AÇÃO:**

1. No navegador, acesse:
   ```
   http://72.60.60.117:3001
   ```
   (Use o IP da sua VPS se for outro.)

2. Você deve ver a **tela de login**. Clique em login com Google e complete o OAuth.

3. Após o login, as telas de relatórios (portfólio, curva S, etc.) devem carregar.

**Se não abrir ou der erro:**
- Confirme que o container **plataformaotus-app** está “Em execução” (Gerenciador Docker ou `docker ps`).
- No VPS: `curl -s http://localhost:3001/api/health` deve retornar algo como `{"status":"OK",...}`.
- Veja os logs: `docker logs plataformaotus-app`.
- Verifique o **firewall** do VPS: a porta **3001** precisa estar liberada (ex.: `ufw allow 3001` se usar UFW).

**Próximo:** 5.2 Conferir os outros projetos.

---

### 5.2 Conferir que os outros não foram afetados

**O que é:** Garantir que o **automacoes** (n8n, waha, nginx) continua rodando e acessível. O **plataformaotus** usa só a 3001 e outro projeto Docker; não mexe neles.

**👉 SUA AÇÃO:**

1. No **Gerenciador Docker**, confira se o projeto **automacoes** segue “Em execução” com os mesmos containers (n8n, waha, nginx).

2. Acesse n8n, waha e os sites que passam pelo nginx e use um pouco de cada um, como antes.

**Como conferir:** Tudo que você usava no **automacoes** continua funcionando. Se algo tiver parado, não costuma ser por causa do **plataformaotus**; nesse caso, veja logs e firewall do **automacoes**.

---

## Checklist rápido (use para conferir)

- [ ] **Passo 0:** MCP Hostinger usado para validar VPS e projetos (opcional: projeto criado via GitHub).
- [ ] Repositório clonado/atualizado no PC.
- [ ] `backend/.env` criado e preenchido (`GOOGLE_CALLBACK_URL`, `FRONTEND_URL`, etc. com IP **72.60.60.117** ou seu domínio).
- [ ] `backend/service-account-key.json` no lugar (PC e VPS).
- [ ] OAuth no Google: URI de redirecionamento `http://72.60.60.117:3001/api/auth/google/callback` cadastrada.
- [ ] Projeto no VPS em `/opt/relatorio` ou `/docker/plataformaotus` com `.env` e `service-account-key.json`.
- [ ] Porta **3001** livre no VPS (já verificada no Passo 0 se usou MCP).
- [ ] Projeto Docker **plataformaotus** criado; build e start feitos (ou reiniciado após enviar .env/key).
- [ ] App abre em `http://72.60.60.117:3001`, login e relatórios OK.
- [ ] **automacoes** (n8n, waha, nginx) seguem normais.

---

## Problemas comuns

| Problema | O que fazer |
|----------|-------------|
| App não abre em `http://IP:3001` | Container rodando? `curl http://localhost:3001/api/health` no VPS? Firewall liberou 3001? |
| Erro de login / OAuth | `GOOGLE_CALLBACK_URL` e `FRONTEND_URL` = URL que você usa no navegador. Redirect no Google = `http://IP:3001/api/auth/google/callback`. |
| Container sobe e cai | `docker logs plataformaotus-app`. Verificar `.env`, `service-account-key.json`, permissões. |
| “Cannot find module” / erro de arquivo | Build usa a pasta certa? `Dockerfile` e `docker-compose` no mesmo context? `backend/` e `frontend/` presentes? |
| Clone GitHub falha (MCP + GitHub) | “could not read Username” = repo **privado**. Deixe o repo **público** ou use o fluxo **SCP/Terminal** (Passo 2). |

---

## O que cada parte faz (referência)

- **Dockerfile:** Monta o frontend (Vite) e o backend (Node), gera uma imagem que serve frontend + API na **3001**, com healthcheck em `/api/health`.
- **docker-compose.yml:** Define o serviço **plataformaotus**, usa `backend/.env` e monta `service-account-key.json`, limita CPU/memória.
- **Backend (server.js):** Em produção, se existir `public`, serve o SPA e a API no mesmo processo.
- **Frontend:** Build com `VITE_API_URL` vazio; em produção as chamadas vão para o mesmo domínio (`/api/...`), evitando CORS.

---

## Ferramentas MCP Hostinger usadas no Passo 0

| Ferramenta | O que faz |
|------------|-----------|
| `VPS_getVirtualMachinesV1` | Lista VMs; retorna ID (ex.: 983035) e dados básicos. |
| `VPS_getVirtualMachineDetailsV1` | Detalhes da VM: IP, hostname, estado, template. |
| `VPS_getProjectListV1` | Lista projetos Docker na VM (ex.: automacoes) e portas. |
| `VPS_getFirewallListV1` | Lista firewalls configurados na API. |
| `VPS_createNewProjectV1` | Cria projeto a partir do GitHub ou do conteúdo do `docker-compose`. |
| `VPS_getProjectContainersV1` | Lista containers de um projeto. |
| `VPS_restartProjectV1` | Reinicia um projeto (útil após enviar .env/key). |
| `VPS_getProjectLogsV1` | Logs do projeto para debug. |

**Sua VPS (exemplo):** ID **983035**, hostname **srv983035.hstgr.cloud**, IP **72.60.60.117**.

---

Seguindo esse passo a passo, o deploy da Plataforma Otus fica isolado e **não atrapalha** os outros projetos do seu VPS.
