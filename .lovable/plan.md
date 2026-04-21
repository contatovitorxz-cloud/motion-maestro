

# Fixar imagens como referência visual para a AI

Hoje você sobe imagens para a sidebar mas elas não viajam para a AI quando ela cria a motion — ela inventa do zero. Você quer poder marcar uma ou mais imagens como **"pinned"** (referência) e a partir daí toda motion gerada pela AI considera essas imagens (cor, estilo, composição, ou usa a própria imagem na cena).

## Como vai funcionar

```text
Sidebar de assets
   │
   ▼  (clicar no ícone 📌 sobre a thumbnail)
[Asset marcado como PINNED]
   │
   ▼
Aparece no topo do AiChat: barra "📌 Referências (2)" com miniaturas
   │
   ▼
Toda mensagem enviada → context.pinnedImages: [{name, url, description}]
   │
   ▼
chat-edit injeta no system prompt:
"O usuário fixou estas imagens como referência visual obrigatória.
Use-as como guia de estilo, paleta e composição na cena de motion."
```

## Mudanças

### 1) Marcar/desmarcar imagens como referência
- Em `EditorSidebar.tsx`, sobre cada thumbnail de **imagem**, adicionar um botão pin (ícone `Pin` do lucide) no canto superior direito, visível no hover ou sempre visível se já estiver fixada.
- Estado `pinnedAssetIds: Set<string>` mantido em `Editor.tsx` e persistido em `localStorage` por projeto (`motiona:pinned:${projectId}`).
- Visual de "fixada": borda dourada `ring-2 ring-amber-400/60` + ícone pin preenchido amarelo.
- Limite: **até 4 imagens fixadas** (suficiente para referência, evita estourar contexto). Tentar fixar a 5ª mostra toast "Máximo 4 referências".

### 2) Barra de referências no AiChat
- Logo abaixo do header do `AiChat` (entre header e mensagens), quando há ≥1 pinned:
  - Faixa horizontal `h-14` com fundo `bg-white/[0.02]` borda inferior `white/[0.06]`.
  - Label à esquerda: `📌 REFERÊNCIAS` mono `text-[10px] tracking-[0.2em] text-amber-400/70`.
  - Miniaturas (size-9 rounded-md) de cada imagem fixada, cada uma com X no hover para desafixar rápido.
  - Texto pequeno: "AI vai considerar essas imagens".

### 3) Enviar referências para a edge function
- `AiChat.tsx` recebe nova prop `pinnedAssets: Asset[]` (filtrados de `assets` por `pinnedAssetIds`).
- No payload do fetch para `chat-edit`, adicionar `context.pinnedImages`:
  ```ts
  pinnedImages: pinnedAssets.map(a => ({
    name: a.name,
    url: a.url,                  // URL assinada (válida por 1h)
    description: a.metadata?.description ?? null,
  }))
  ```

### 4) Edge function: incluir imagens no prompt + opcionalmente como vision input
**a) Sempre injeta no system prompt (texto):**
```
PINNED REFERENCES (${n} images the user wants you to honor):
${list of: "- name.jpg — description"}
Use these as your visual north: match palette, mood, composition, subject.
When calling generate_motion_scene, your `description` MUST mention how the
scene reflects these references.
```

**b) Vision (opcional, mas é o que faz brilhar):** o Claude `claude-sonnet-4-5` aceita imagens como conteúdo. No primeiro `messages[0]` (ou anexado à última mensagem do usuário), incluir blocos `image` com as URLs:
```ts
content: [
  { type: "text", text: userText },
  ...pinnedImages.map(img => ({
    type: "image",
    source: { type: "url", url: img.url }
  }))
]
```
Assim o Claude **literalmente vê** as imagens e gera descrições de motion fiéis ao visual.

### 5) Descrição opcional por imagem (nice-to-have leve)
- No hover da miniatura na barra do chat, um pequeno popover com `<input>` "Como usar essa imagem?" (ex.: "use como background", "extraia paleta", "logo no canto").
- Salva em `assets.metadata.pin_description` no banco (campo já é `Json`, sem migration).
- Vai junto no `description` enviado ao prompt.

### 6) Mostrar na resposta da AI
- O AI Director (auto mode) é instruído a mencionar no campo "🎨 Cena": "inspirado em: foto1.jpg, foto2.jpg" — usuário vê que a referência foi considerada.

## Detalhes técnicos

- **Sem migration**: `pinned_description` cabe em `assets.metadata` (Json).
- **Persistência do pin**: localStorage chaveado por projeto (`motiona:pinned:${projectId}`). Simples, suficiente. Se quiser sincronizar entre dispositivos depois, migra para coluna `pinned boolean` em `assets`.
- **URLs assinadas**: já são geradas no load. Renovar a cada 1h. O Claude baixa a imagem na hora — URL precisa estar válida durante a chamada.
- **Custo de tokens**: cada imagem ~1500 tokens. Limite de 4 = ~6k extra por mensagem, aceitável.
- **Tipo**: só imagens podem ser pinned. Vídeos e áudios não mostram o botão pin.

## Arquivos
- **Editado**: `src/pages/Editor.tsx` — estado `pinnedAssetIds`, persistência localStorage, passa `pinnedAssets` para sidebar e chat.
- **Editado**: `src/components/editor/EditorSidebar.tsx` — botão pin no hover de imagens, estilo "fixada", callback `onTogglePin`.
- **Editado**: `src/components/editor/AiChat.tsx` — barra de referências no topo, passa `pinnedImages` no payload.
- **Editado**: `supabase/functions/chat-edit/index.ts` — recebe `context.pinnedImages`, injeta no system prompt, anexa blocos `image` à última mensagem do usuário (vision).

## O que NÃO entra agora
- Geração real da motion usando a imagem como camada (depende do renderer Remotion — Fase 9).
- Pinning de vídeos/áudios.
- Sincronização do pin entre dispositivos (fica em localStorage).
- Extração automática de paleta da imagem (cor pode ser inferida pelo Claude via vision).

