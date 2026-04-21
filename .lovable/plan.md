

# Remover luz/glow dos botões e timecode — manter o resto do design

Você quer a UI do jeito que está, só sem os efeitos de luz (glow) no botão de play, na minutagem (timecode) e nos demais elementos que estão "brilhando". Vou deixar tudo plano, sólido e limpo, mantendo cores, layout e organização.

## O que muda

### 1) Botão de Play (PreviewPlayer)
- Remover `glow-primary` e `shadow-elegant` do botão circular grande.
- Manter o gradiente violeta→cyan (cor do botão), tamanho e formato — só sem o halo luminoso.

### 2) Timecode central do player (minutagem grande âmbar)
- Trocar `text-amber-glow` (que adiciona `text-shadow` brilhante) por `text-amber` (cor sólida, sem brilho).
- Manter a cor âmbar, fonte mono, tamanho e o "chip" preto ao redor.

### 3) Timecode da Topbar
- Já usa `text-amber` (sem glow) — sem mudança.

### 4) Playhead da Timeline
- Remover `shadow-[0_0_8px_hsl(var(--amber))]` da linha vertical.
- Remover `shadow-[0_0_12px_hsl(var(--amber))]` do diamante.
- Manter cor âmbar, formato de diamante e linha — só sem o brilho.

### 5) Bolinhas das trilhas (Video / Motion / Text / Audio / Captions)
- Remover o `boxShadow` colorido das bolinhas indicadoras de cada track.
- Manter a cor sólida de cada categoria.

### 6) Logos / botões secundários com `shadow-elegant`
Remover apenas o brilho colorido (mantendo o gradiente como cor de fundo) em:
- Logo Sparkles da Topbar (Editor.tsx).
- Botão Export da Topbar.
- Avatar do "AI Director" no header do chat (AiChat).
- Ícone Wand2 grande do estado vazio do chat — também remover `animate-glow-pulse`.
- Botão Send circular do chat.
- Bolha "lower-third" no overlay do preview.

### 7) Sombra do monitor de vídeo
- Ajustar `--shadow-monitor` em `src/index.css`: remover a camada `0 0 60px -20px hsl(262 90% 65% / 0.25)` (glow violeta ao redor do vídeo).
- Manter a sombra preta difusa (sensação de monitor flutuando) e o ring branco sutil.

### 8) Token global `--shadow-elegant`
- Atualizar para uma sombra preta neutra (ex: `0 12px 32px -12px hsl(0 0% 0% / 0.6)`) em vez de halos coloridos violeta+cyan. Isso "desliga" o glow em todos os botões que usam essa classe sem precisar tocar um por um e mantém uma sombra discreta de elevação.

## O que NÃO muda
- Layout (chat à esquerda, preview centro, sidebar direita).
- Paleta de cores (preto, violeta, cyan, âmbar) — só os efeitos luminosos somem.
- Tipografia (Inter + JetBrains Mono).
- Vinheta global do background (sutil, não é "glow de UI").
- Letterbox do player, gradientes dos clipes na timeline, animação de pulso verde do indicador "online".

## Arquivos afetados
- `src/index.css` — redefinir `--shadow-monitor` e `--shadow-elegant` sem cor luminosa.
- `src/components/editor/PreviewPlayer.tsx` — remover `glow-primary` e trocar `text-amber-glow` por `text-amber`.
- `src/components/editor/Timeline.tsx` — remover `shadow-[...]` do playhead, diamante e bolinhas das tracks.
- `src/components/editor/AiChat.tsx` — remover `animate-glow-pulse` do ícone do estado vazio.

Resultado: interface idêntica em estrutura e cor, mas com aparência "flat profissional" — sem halos luminosos pulsando ou irradiando dos botões e do timecode.

