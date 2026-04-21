

# Tela de upload inicial — "Comece pelo seu vídeo"

Hoje, ao abrir um projeto, você cai direto no editor vazio sem saber por onde começar. Vou criar uma **tela de boas-vindas dentro do projeto** que aparece quando ainda não há nenhum vídeo, com uma área grande de upload no centro. Assim que você sobe o vídeo, ele entra na timeline automaticamente e a tela some, revelando o editor completo já com seu vídeo carregado.

## Como vai funcionar

```text
Abrir projeto vazio          Após upload
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │ [sidebar][preview]  │
│   ⬆  Drop video     │ ──▶ │         [chat]      │
│   or click to pick  │     │ [────timeline────]  │
│                     │     │                     │
└─────────────────────┘     └─────────────────────┘
   (ocupa 100% da área         (editor normal,
    central, sem timeline)      vídeo já no track)
```

## O que vou construir

### 1) Novo componente `EmptyProjectHero`
- Card grande centralizado dentro da área do preview, ocupando preview+timeline juntos.
- Ícone grande de upload, título "Solte seu vídeo aqui", subtítulo "ou clique para escolher do computador".
- Aceita drag-and-drop de arquivo de vídeo na área inteira.
- Botão "Escolher arquivo" como fallback de clique.
- Pequena lista abaixo: "Suporta MP4, MOV, WebM • até 500MB".
- Visual alinhado com o resto do editor (sem glow, bordas sutis, fundo `bg-obsidian` com tracejado animado quando arrasta).

### 2) Integração em `Editor.tsx`
- Detectar estado vazio: `clips.length === 0 && assets.filter(a => a.type === "video").length === 0`.
- Quando vazio: renderizar `EmptyProjectHero` no lugar de `PreviewPlayer + Timeline` (sidebar e chat continuam visíveis).
- O hero usa o mesmo `handleUpload` que já existe — nada de lógica duplicada.
- Após o upload do primeiro vídeo, o estado vazio deixa de ser verdadeiro e o editor normal aparece automaticamente, com o clipe já posicionado em `start_time: 0` na track de vídeo.

### 3) Auto-seleção e auto-play sutil
- Após o upload do primeiro vídeo, definir `activeAssetId` para esse vídeo (o preview já carrega ele).
- Selecionar o clipe recém-criado (`setSelectedClipId`) para destacá-lo na timeline.
- Toast: "Vídeo carregado — comece a editar".

### 4) Manter sidebar acessível
- Mesmo na tela vazia, a sidebar esquerda (Project / Motion presets) continua visível, então você pode subir vídeo por lá também se preferir.
- O AI chat à direita também permanece visível, com uma mensagem inicial sugerindo: "Faça upload de um vídeo para começar — depois me peça para adicionar legendas, lower-third, cortar silêncio…".

## Detalhes técnicos
- Novo arquivo: `src/components/editor/EmptyProjectHero.tsx`.
- Editado: `src/pages/Editor.tsx` — condicional para renderizar o hero ou o editor; após upload, selecionar clipe novo.
- Reuso: `useDropzone` (já em `package.json`), `handleUpload` existente, mesmas rotas de Storage.
- Sem mudanças no banco — usa as tabelas `assets` e `timeline_clips` já existentes.

## O que NÃO muda
- Fluxo de upload pela sidebar continua funcionando idêntico.
- Editor completo com vídeo já carregado fica intocado.
- Chat com Claude e tools continuam ativas mesmo na tela vazia (útil para perguntar "o que posso fazer aqui?").

