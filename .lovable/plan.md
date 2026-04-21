

# Narração com ElevenLabs — Claude anima, ElevenLabs fala

Você quer que o Claude continue cuidando da animação (motion graphics, layout, timing) e o ElevenLabs entre como **voz** das suas motions. A cada pedido, você decide se escreve o roteiro ou deixa o Claude escrever, escolhe a voz na hora, e o áudio gerado vira uma faixa de áudio na timeline (sincronia manual depois, arrastando).

## Como vai funcionar

```text
Você: "Crie uma motion intro 'Bem-vindo à Motiona', com narração"
        │
        ▼
Claude (chat) ──► chama tool generate_narration
                    └─► Edge function chama ElevenLabs
                         └─► MP3 sobe pro Storage (bucket assets)
                              └─► Vira asset + clipe na track de áudio
        │
        ▼
Em paralelo, Claude chama generate_motion_scene normalmente
        └─► Cena de motion entra na track de vídeo
        
Resultado na timeline:
[Vídeo ────── Motion Scene ──────]
[Áudio ────── Narração MP3 ──────]
```

## O que vou construir

### 1) Nova edge function `generate-narration`
- Recebe `{ text, voiceId, projectId }`.
- Valida user (JWT) + input (Zod).
- Chama `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128` com `eleven_multilingual_v2` (suporta português).
- Faz upload do MP3 para o bucket `assets` no caminho `{user_id}/{project_id}/narration-{timestamp}.mp3`.
- Cria registro em `assets` (type: `audio`, name: primeiras palavras do texto).
- Retorna `{ assetId, storagePath, duration }` (lê duração via header ou estima por bitrate).

### 2) Secret ElevenLabs
- Vou abrir o prompt para você colar a `ELEVENLABS_API_KEY` (chave já gerada no painel do ElevenLabs).
- Sem a chave nada disso roda — então esse é o primeiro passo da execução.

### 3) Nova tool no Claude: `generate_narration`
- Adicionada em `supabase/functions/chat-edit/index.ts` ao lado das tools existentes.
- Schema: `{ text: string, voice_id?: string, start?: number }`.
- Comportamento esperado pelo system prompt: se você não passar texto, Claude pode oferecer escrever um. Se você passar, ele usa direto.
- Quando o Claude chama a tool, o frontend:
  1. Mostra "🎙️ Gerando narração com [Voz]…" no chat.
  2. Chama `supabase.functions.invoke("generate-narration", ...)`.
  3. Recebe o `assetId` + `duration` e cria um clipe na track `audio` em `start_time = start ?? currentTime`, `end_time = start + duration`.
  4. Faz `handleCommit(next)` — entra no undo/redo.

### 4) Seletor de voz na hora (UI no chat)
- Acima do input do `AiChat`, adicionar um pill discreto: **🎙 Voz: Sarah ▾**
- Dropdown com 8 vozes pré-selecionadas (Brian, Sarah, George, Laura, Charlie, Alice, Liam, Matilda) — cada uma com 2 palavras descrevendo o tom.
- A voz escolhida fica em estado local (`useState`) e é injetada automaticamente como `voice_id` quando o Claude chama `generate_narration`.
- Persistência leve: salva no `localStorage` (`motiona:lastVoice`) pra lembrar entre sessões.
- Botão "🔊 Pré-ouvir" ao lado do dropdown que toca uma frase de 3s daquela voz (cache local pra não gastar quota).

### 5) Player de áudio na timeline
- Hoje a track `audio` existe mas não toca nada. Vou adicionar:
  - Em `PreviewPlayer.tsx`, criar um `<audio>` invisível por clipe de áudio ativo.
  - Sincronizar `currentTime` e `play/pause` igual ao vídeo principal.
  - Cortar áudio fora do range `[start_time, end_time]` do clipe.
- Visual no `Timeline`: clipes de áudio ganham um pequeno waveform fake (barrinhas variando) + ícone 🔊 para diferenciar dos vídeos.

### 6) Inspector simples para clipes de áudio
- Quando você clica num clipe de áudio na timeline, aparece um popover lateral mínimo:
  - Slider de **volume** (0–100%, salvo em `effects.volume`).
  - Botão **Trocar voz / Regerar** — abre um pequeno modal com o texto original (salvo em `effects.text`), seletor de voz e "Regenerar". Cria um novo asset, substitui o `asset_id` do clipe.
  - Botão **Remover**.

### 7) Opção "Claude escreve o roteiro"
- O system prompt do Claude vai ganhar instruções:
  > "Quando o usuário pedir uma motion com narração mas não fornecer o texto, você pode escrever um roteiro curto (1-3 frases, tom cinematográfico) e chamar `generate_narration` com ele. Sempre mostre o texto final no chat antes de gerar, para o usuário ter contexto."
- Assim, mesma tool atende os dois fluxos: você dita ou ele inventa.

## Detalhes técnicos
- **Banco**: nenhuma migration nova — `assets.type = 'audio'` e `timeline_clips.track = 'audio'` já são suportados; volume e texto vão em `effects` (jsonb).
- **Storage**: bucket `assets` já existe e é privado — vamos usar URL assinada (signed URL de 1h) para tocar no `<audio>`.
- **Custo**: cada narração gasta caracteres da sua quota ElevenLabs. Pré-ouvir usa cache para minimizar.
- **Modelo TTS**: `eleven_multilingual_v2` (suporta português brasileiro nativamente).
- **Streaming**: na primeira versão, vamos com geração completa (`/text-to-speech/{id}`) — mais simples, MP3 pronto. Streaming pode entrar depois se você quiser latência menor.

## Arquivos afetados
- **Novo**: `supabase/functions/generate-narration/index.ts`.
- **Editado**: `supabase/functions/chat-edit/index.ts` — adicionar tool `generate_narration` + atualizar system prompt.
- **Editado**: `src/components/editor/AiChat.tsx` — seletor de voz, botão pré-ouvir, handler para a nova tool.
- **Editado**: `src/pages/Editor.tsx` — `applyAiAction` aprende a lidar com `generate_narration` (cria clipe de áudio via commit).
- **Editado**: `src/components/editor/PreviewPlayer.tsx` — playback de clipes de áudio sincronizado.
- **Editado**: `src/components/editor/Timeline.tsx` — visual diferenciado para clipes de áudio.
- **Novo**: `src/components/editor/AudioInspector.tsx` — popover de volume / regerar / remover.

## Próximo passo da execução
Aprovando este plano, o **primeiro passo é abrir o prompt do secret `ELEVENLABS_API_KEY`**. Você cola a chave lá (não no chat), e em seguida eu implemento tudo de uma vez.

## O que NÃO entra agora
- Sincronia automática word-level (karaoke) — fica para uma fase futura quando você pedir.
- Voice cloning da sua própria voz — possível depois com a API de Voices.
- Música de fundo automática — outra tool separada, fora deste escopo.

