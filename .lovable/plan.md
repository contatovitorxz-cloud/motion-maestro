

# Auth, Dashboard e Editor no mesmo design "meu motion"

A landing já está preto absoluto com borda rotativa. Agora vou propagar essa identidade para **Auth**, **Dashboard** e **Editor** (sidebar/topbar) — mesma paleta preta, mesma tipografia apertada, mesmo CTA com borda animada, mesmo wordmark "meu motion".

## Mudanças

### 1) Página Auth (`/auth`)
- Fundo `bg-black` puro + grid sutil (`.bg-grid-faint`) + vinheta radial — igual à landing.
- Card central: `bg-white/[0.02]`, borda `white/[0.06]`, `backdrop-blur-xl`, cantos `rounded-2xl`.
- Logo: quadradinho preto com borda `white/10` + ícone branco (sem gradiente roxo) + wordmark **"meu motion"** (meu regular, motion bold).
- Títulos: `tracking-[-0.04em]`, peso 800, branco. Subtítulo `text-white/50`.
- Inputs: `bg-white/[0.03]`, borda `white/10`, focus borda `white/30`, sem ring colorido.
- Labels `text-white/70 text-xs uppercase tracking-[0.15em]`.
- Botão "Sign in / Create account" → **`RotatingBorderButton`** (size lg, full width via `w-full` no wrapper).
- Link de troca (Sign up / Sign in) em `text-white/60` com hover branco (sem roxo).
- `document.title` atualizado: "Sign in — meu motion".

### 2) Dashboard (`/dashboard`)
- Fundo `bg-black` + grid + vinheta.
- Topbar: `backdrop-blur-xl` `bg-black/60`, borda inferior `white/[0.06]`, mesmo wordmark à esquerda + avatar/sign out à direita (botões `ghost` com hover `white/5`).
- Título "Your projects": `text-4xl tracking-[-0.04em] font-bold`, com sublinha de mono `"WORKSPACE"` em `white/30 tracking-[0.3em]`.
- Botão "New project" → `RotatingBorderButton` (size sm).
- Grid de projetos: cards com `bg-white/[0.02]`, borda `white/[0.06]`, hover borda `white/20` + leve `-translate-y-0.5`.
  - Thumbnail no topo (placeholder se vazio: gradient cinza→preto).
  - Nome do projeto em branco, data em `white/40` mono.
  - Ações (Editar/Apagar) em ícones `white/40` que ficam brancos no hover.
- Empty state: card grande centralizado com mesma estética + CTA rotativo "Create your first project".

### 3) Editor — sidebar e topbar
- **Topbar do Editor** (`Editor.tsx`):
  - `bg-black` borda `white/[0.06]`, wordmark "meu motion" + nome do projeto editável.
  - Botões (Undo/Redo/Save/Export): `ghost` com `text-white/60 hover:text-white hover:bg-white/5`.
  - Botão "Export" final → `RotatingBorderButton` size sm.
- **EditorSidebar**:
  - Fundo `bg-black` borda `white/[0.06]`.
  - Tabs/sections com texto `white/50` ativo `white`, indicador linha `white` em vez de roxo.
  - Inputs/uploads no mesmo padrão dos campos do Auth.
- **Painéis internos** (Timeline, PreviewPlayer, AiChat) — manter cores funcionais atuais (roxo dos clipes ainda diferencia tracks), só ajustar molduras e backgrounds para `bg-black` e bordas `white/[0.06]`. Nada de re-skin profundo nos componentes ricos.

### 4) Helpers visuais reutilizáveis
- Sem novos componentes além do que já existe — reuso total de `RotatingBorderButton`.
- Adicionar em `index.css` uma classe utilitária `.surface-panel` = `bg-white/[0.02] border border-white/[0.06] rounded-xl backdrop-blur-xl` para padronizar cards/painéis e evitar repetição.

### 5) Marca consistente
- Substituir todas as ocorrências de "Motiona" em `Auth.tsx`, `Dashboard.tsx`, `Editor.tsx`, `EditorSidebar.tsx` por **meu motion**.
- Atualizar `index.html` `<title>` e meta description para "meu motion — AI Motion Video Editor".

## Arquivos
- **Editado**: `src/pages/Auth.tsx` — redesign completo no padrão preto.
- **Editado**: `src/pages/Dashboard.tsx` — topbar, grid de cards, empty state.
- **Editado**: `src/pages/Editor.tsx` — topbar preta + wordmark + botão export rotativo.
- **Editado**: `src/components/editor/EditorSidebar.tsx` — fundo preto, bordas sutis, inputs padronizados.
- **Editado**: `src/index.css` — classe utilitária `.surface-panel`.
- **Editado**: `index.html` — título e meta.

## O que NÃO muda
- Lógica de auth, rotas, estado, edge functions — intocados.
- Cores funcionais do Timeline (roxo/azul que diferenciam tracks) ficam.
- AiChat, PreviewPlayer internos — só molduras externas mudam, conteúdo idêntico.

