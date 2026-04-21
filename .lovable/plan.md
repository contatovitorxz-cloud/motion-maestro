

# Landing page "meu motion" — preto absoluto, CTA com borda animada e visual mais profissional

Vou renomear a marca para **meu motion**, deixar a landing 100% preta (sem o glow roxo atual), trocar o CTA por um botão com **borda em rotação** (conic gradient girando), e elevar o nível visual com tipografia mais refinada, espaçamentos maiores e seções extras que dão sensação de produto sério.

## Mudanças

### 1) Renomear marca
- Logo no header: **meu motion** (lowercase, peso variável: "meu" regular + "motion" bold).
- `document.title`: "meu motion — AI Motion Video Editor".
- Footer: "© 2026 meu motion".
- Substituir todas as ocorrências de "Motiona" em `src/pages/Index.tsx`.

### 2) Fundo preto absoluto
- Remover `bg-gradient-glow` e o blob roxo `bg-primary/10 blur-[120px]`.
- Fundo: `#000` puro (`bg-black`).
- Adicionar **grid sutil** de fundo (linhas 1px em `white/[0.03]`, espaçamento 80px) — dá profundidade técnica sem poluir.
- Vinheta radial muito leve nas bordas (`bg-[radial-gradient(ellipse_at_center,transparent_60%,black)]`) pra focar o olho no centro.

### 3) CTA com borda em rotação
Componente novo: `RotatingBorderButton` em `src/components/RotatingBorderButton.tsx`.
- Wrapper `relative` com `::before` rodando uma `conic-gradient(from var(--angle), #8b5cf6, #06b6d4, #8b5cf6)`.
- Animação CSS via `@property --angle` (registrado no `index.css`) girando 0→360deg em 4s loop.
- Botão interno preto puro (`bg-black`) com 1px de gap, criando a ilusão de borda viva.
- Texto branco, ícone de seta.
- Aplicado em **"Start editing free"** (hero) e **"Sign in"** (header em versão menor).
- Fallback para browsers sem `@property`: borda estática gradiente.

### 4) Tipografia e hierarquia mais profissional
- Hero h1: **mais apertado** — `tracking-[-0.05em]`, `leading-[0.9]`, peso 800.
- Trocar "driven by AI" pelo gradiente: branco → cinza claro (`from-white to-white/40`), em vez de roxo→azul. Mais sóbrio, mais Linear/Vercel.
- Subtítulo: cor `white/60`, `text-lg`, max-width menor (`max-w-xl`).
- Pill "Powered by..." vira **"v1.0 · Powered by AI"** com fundo `white/[0.04]` e borda `white/10`.

### 5) Cards de feature redesenhados
- Fundo `white/[0.02]`, borda `white/[0.06]`.
- Hover: borda vira `white/20`, leve translação `-translate-y-0.5`.
- Ícone num quadrado `white/5` arredondado, ícone branco (não mais roxo).
- Título `text-white`, descrição `text-white/50`.
- Adicionar um **micro-label** acima de cada card (ex: "01 · CREATE", "02 · EDIT") em mono `text-[10px]` `text-white/30 tracking-[0.3em]`.

### 6) Seções novas (mais "produto profissional")
**a) Logos / "Trusted by"** logo abaixo do hero:
- Linha discreta: "Trusted by creators at" + 5 nomes fictícios em texto cinza claro (`white/30`), espaçados, sem logos reais — só wordmarks tipográficos.

**b) Showcase visual** entre features e footer:
- Card grande mostrando um "preview" da timeline do editor (mockup em CSS puro: 3 tracks com blocos coloridos representando vídeo/áudio/legendas, cursor de playhead).
- Gradient border sutil ao redor.
- Legenda: "Multi-track timeline · Real-time AI edits".

**c) Footer mais robusto**:
- 3 colunas: Product (Editor, Pricing, Changelog) · Company (About, Contact) · Legal (Terms, Privacy).
- Copyright + pequeno wordmark "meu motion" à esquerda.

### 7) Header refinado
- Sem `border-b`, mas com `backdrop-blur-xl` quando rolar (state `scrolled`).
- Logo: quadradinho preto com borda `white/10` + ícone branco (sem gradiente roxo).
- "Sign in" vira o botão de borda rotativa em versão `sm`.

## Arquivos
- **Editado**: `src/pages/Index.tsx` — toda a estrutura nova.
- **Editado**: `src/index.css` — `@property --angle` + keyframes `spin-border`.
- **Novo**: `src/components/RotatingBorderButton.tsx` — botão reutilizável com borda animada.

## O que NÃO muda
- Rotas (`/auth`, `/dashboard`, `/editor`) e lógica de auth permanecem intocadas.
- Editor, chat, timeline — tudo igual.
- Paleta global no `tailwind.config` — só a landing usa preto puro; resto do app continua com tema atual.

