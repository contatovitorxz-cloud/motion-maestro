
# Render real MP4 do motion via Remotion (server externo) + Auto Mode usando Remotion

Você quer que cada mensagem do chat vire um **MP4 baixável de verdade**, com qualidade Remotion, embutindo as imagens fixadas (logo etc.). Hoje o "motion" é só CSS no preview e o Export está stubbed. Vamos trocar o renderer e ligar um worker externo.

## Arquitetura

```text
User msg → AiChat → chat-edit (Claude)
                       │
                       ▼
              tool: generate_motion_scene  → JSON da cena (palette, layers, pinned image refs)
              tool: generate_narration     → MP3 ElevenLabs (já funciona)
                       │
                       ▼
              Editor cria/atualiza um "render job" (Supabase row)
                       │
                       ▼
        Edge function `enqueue-render` → POST pro Remotion Worker (Render.com)
                       │
                       ▼
         Worker (Node + Remotion) baixa narração + imagens → renderiza MP4 → faz upload pro bucket `renders` → marca job como `done`
                       │
                       ▼
        Editor escuta via Realtime → mostra "✓ MP4 pronto" + botão Download
```

## Mudanças

### 1) Remotion Worker (novo repo, deploy externo)
Não fica neste codebase — você vai subir no **Render.com** (ou Fly/Railway). Eu te entrego:

- `worker/` — projeto Node standalone com:
  - `package.json` (remotion, @remotion/renderer, @remotion/bundler, express, @supabase/supabase-js)
  - `src/Root.tsx` — registra a composition `MotionScene`
  - `src/MotionScene.tsx` — componente Remotion que **lê o mesmo JSON** que o frontend já gera (`MotionScene` de `src/lib/motionScene.ts`). Renderiza:
    - Background: solid / gradient / **imagem fixada** (download do bucket `assets`)
    - Layers: text / shape / **image** (logo da pinned image entra aqui)
    - Animações via `interpolate` + `spring` espelhando os tipos `AnimIn/Out/Loop`
    - Track de áudio: a narração ElevenLabs sincronizada
  - `src/server.ts` — Express HTTP:
    - `POST /render` recebe `{ jobId, scene, narrationUrl, pinnedImageUrls, supabaseUploadPath }`
    - Renderiza via `renderMedia()` para `/tmp/out.mp4`
    - Faz upload pro bucket `renders` com service role
    - `UPDATE render_jobs SET status='done', output_url=<signed>, ...`
  - `Dockerfile` — base `node:20-bullseye`, instala chromium + ffmpeg
  - `render.yaml` (blueprint Render.com) — pronto pra deploy

Vou te dar o passo-a-passo de deploy: criar conta Render, conectar repo, copiar 3 secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SHARED_SECRET`), pegar a URL pública. Depois você cola essa URL como secret `REMOTION_WORKER_URL` no Lovable Cloud.

### 2) Banco — tabela `render_jobs`
```sql
create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id),
  status text default 'queued', -- queued|rendering|done|error
  scene jsonb,
  narration_asset_id uuid references assets(id),
  pinned_asset_ids uuid[],
  output_path text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: user só vê os seus
-- Realtime habilitado
```

### 3) Nova edge function `enqueue-render`
- Recebe `{ projectId, scene, narrationAssetId, pinnedAssetIds }`
- Cria signed URLs (1h) pra narração + cada pinned image
- Cria row em `render_jobs` (status `queued`)
- POST pro `REMOTION_WORKER_URL/render` com payload + `WORKER_SHARED_SECRET` (fire-and-forget, não espera)
- Retorna `{ jobId }` na hora

### 4) Frontend — substituir preview CSS pelo player Remotion-style
- **`src/components/editor/MotionRenderer.tsx`**: já existe e usa o mesmo schema. Mantemos pro **preview rápido** (sem download). O Remotion no worker renderiza **o mesmo JSON** com qualidade real.
- **`src/pages/Editor.tsx`**:
  - Quando o Auto Mode dispara `generate_motion_scene` + `generate_narration`, depois de ter os dois resultados:
    - Chamar `supabase.functions.invoke("enqueue-render", { ... })` com a cena, narração, e `pinnedAssetIds`
    - Mostrar toast "🎥 Renderizando MP4…"
  - Subscribe Realtime em `render_jobs` desse projeto:
    - Quando `status='done'`: toast com botão **"Baixar MP4"** + adiciona o vídeo na sidebar como asset.
    - Quando `status='error'`: toast vermelho com a mensagem.
- **Botão Export do header**: passa a baixar o último render `done` do projeto (ou dispara um novo se a cena foi editada).

### 5) Pinned images chegam no Remotion
- A cena já carrega `assetId` em `background.assetId` e em `layers[i].assetId` (schema do `chat-edit` já suporta).
- O `enqueue-render` resolve esses ids → signed URLs e injeta no payload.
- No `MotionScene.tsx` (worker), `<Img src={resolvedUrl}>` desenha a logo no frame que a AI escolheu.
- No system prompt do `chat-edit` reforço: "Se há pinned images, use **uma** como `background.assetId` OU como `layers[].assetId` (logo) — não invente conteúdo visual quando o usuário fixou referência."

### 6) UX de pin (pequeno polish, já que você acha)
- Tooltip no botão 📌 da sidebar: "Fixar pra AI usar na motion (logo, paleta, mood)"
- Hint na barra de Refs do chat: "AI vai inserir essas imagens na cena"

## Fluxo final do usuário
1. Sobe a logo na sidebar, clica 📌 (vira borda dourada)
2. Digita no chat: "lançamento do iPhone 17"
3. Auto Mode dispara: cena com a logo, narração ElevenLabs, legenda
4. Toast "🎥 Renderizando…" (15-40s dependendo da duração)
5. Toast verde com **Baixar MP4** ou aparece o `.mp4` na sidebar como asset

## Secrets que preciso pedir DEPOIS de você criar o worker
- `REMOTION_WORKER_URL` — URL pública do Render.com
- `WORKER_SHARED_SECRET` — string aleatória (eu gero, você cola no Render também)

## O que NÃO entra agora
- Render incremental/preview de baixa qualidade (sempre 1080p)
- Edição manual do MP4 depois de renderizado (re-renderiza inteiro)
- Múltiplos jobs paralelos (1 por projeto enquanto não terminar)
- Custo de GPU — vai rodar headless CPU no Render starter ($7/mês). Pra escalar, depois.

## Ordem de execução
1. Migration `render_jobs` + RLS + realtime
2. Criar pasta `worker/` no repo (você decide se publica em outro repo Git ou usa monorepo) com Dockerfile + Remotion + Express
3. Edge function `enqueue-render`
4. Frontend: hook Realtime + botão download + integração no Auto Mode
5. Polish do pin (tooltip)
6. Eu te entrego o passo-a-passo do Render.com e peço os 2 secrets quando você tiver a URL
