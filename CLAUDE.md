# CLAUDE.md — strongRunApp

Contexto para o Claude Code. Leia antes de tocar em qualquer arquivo.

---

## O que é

PWA de uso pessoal para registrar treino de força. Um corredor entra, escolhe o
treino do dia (A, B, C, D), e o app cronometra a execução de cada série, registra
peso e repetições, dispara o descanso sozinho e mostra um resumo no final.

HTML, CSS e JS puros em um único `index.html`. **Sem build, sem dependências, sem
framework.** Não introduza nenhum.

O dono é desenvolvedor sênior e DBA Oracle, iniciando em Python. Seja direto nas
explicações. Ele pediu explicitamente para **não haver overengineering** — a v1 é
deliberadamente enxuta, para evoluir depois.

---

## Arquivos

```
index.html      app inteiro — telas, máquina de estados, cronômetros
workouts.json   os treinos (é AQUI que se edita a rotina, não no HTML)
manifest.json   metadados do PWA
sw.js           service worker, cache-first, com exceção para workouts.json
icons/          192, 512, apple-touch-icon
.nojekyll       impede o Jekyll do GitHub Pages de ignorar arquivos
README.md
```

Todos os caminhos são relativos — funciona em subdiretório do Pages sem ajuste.

---

## Tarefa

```bash
gh auth status          # se falhar, PARE e peça `gh auth login` ao usuário

git init
git add -A
git commit -m "strongRunApp — v1"

gh repo create strongRunApp --public --source=. --push

gh api -X POST repos/{owner}/strongRunApp/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

Aguarde `gh api repos/{owner}/strongRunApp/pages` retornar `status: built` e
devolva a URL. Antes do commit, sirva localmente e abra para conferir que a lista
de treinos carrega:

```bash
python3 -m http.server 8000
```

`workouts.json` é lido por `fetch()`, então **não funciona abrindo o index.html
por `file://`** — precisa de servidor HTTP. Se o usuário reclamar que a tela
inicial está vazia ao clicar duas vezes no arquivo, é isso.

---

## Restrições

- **Repositório precisa ser público.** Pages em repo privado exige plano pago.
  Alternativa para privado: Cloudflare Pages (`wrangler pages deploy .`). Confirme
  com o usuário antes de trocar de plataforma.
- **Não adicione persistência sem ele pedir.** O resumo é mostrado e descartado —
  foi decisão explícita dele. Não introduza `localStorage`, histórico, gráficos ou
  backend por iniciativa própria.
- **Não mexa na exceção de `workouts.json` no `sw.js`.** Esse arquivo usa
  network-first justamente para que a rotina editada no repo apareça sem precisar
  incrementar a versão do cache. O resto é cache-first.
- Ao publicar mudanças no HTML/CSS/JS, incremente `CACHE` no `sw.js`
  (`strongrun-v1` → `strongrun-v2`), senão o service worker antigo continua
  servindo a versão velha.

---

## Como editar a rotina

Tudo em `workouts.json`. Nenhuma mudança de código é necessária para trocar
exercícios, séries ou tempos de descanso.

```json
{
  "treinos": [
    {
      "id": "A",
      "nome": "Inferior — força",
      "descricao": "Texto curto mostrado na tela de escolha.",
      "exercicios": [
        { "nome": "Agachamento livre", "series": 4, "descanso": 150,
          "peso": true, "alvo": "5-6 reps" }
      ]
    }
  ]
}
```

| campo | tipo | efeito |
|---|---|---|
| `id` | string | letra no selo preto da tela inicial |
| `series` | int | quantas séries; alimenta os traços de progresso |
| `descanso` | int | segundos do regressivo após cada série |
| `peso` | bool | `false` esconde o campo de kg (peso corporal, prancha) |
| `alvo` | string | texto livre abaixo do nome do exercício |

Pode haver quantos treinos quiser (E, F…). A tela de escolha se adapta sozinha.

Os treinos que vieram no arquivo são um **ponto de partida genérico**, não uma
prescrição. Se o usuário mandar ajustar, ajuste sem discutir a rotina em si.

---

## Como o app funciona por dentro

Máquina de estados na variável `phase`:

```
idle → work → form → rest → work → … → confirm → resumo
```

| fase | o que acontece |
|---|---|
| `work` | cronômetro **crescente** (tempo sob tensão). Botão "Concluir série" |
| `form` | campos de kg e reps, "copiar anterior", "não registrar" |
| `rest` | regressivo com `descanso` do exercício; um bipe por segundo nos **5 s** finais (o último a 940 Hz, mais agudo, com vibração curta junto); avança sozinho |
| `confirm` | só na última série do último exercício: "Treino concluído?" |

Estado da sessão: `exIdx` (exercício), `serie`, `log[]` (as séries registradas),
`extra{}` (séries adicionadas via "mais uma série aqui"), `pos{}` (a próxima série
de cada exercício, para retomar depois de pular).

Detalhes que valem conhecer antes de mexer:

- **`seriesOf(i)`** devolve `series + extra[i]`. Use sempre essa função, nunca
  `W.exercicios[i].series` direto, senão o botão "mais uma série aqui" quebra a
  contagem e a barra de progresso.
- **O treino não avança em linha reta pelo array.** Os botões "Pular exercício" e
  "Exercício anterior" existem porque a máquina da academia pode estar ocupada. Por
  isso:
  - `pos[i]` guarda em que série cada exercício parou. `goToEx(i)` salva o atual e
    restaura o destino — pular e voltar **retoma na série certa**, não recomeça.
  - **Um exercício está `pendente(i)` enquanto tiver série por fazer.** O exercício
    em foco lê `serie`; os outros leem `pos[i]`. É por isso que `proxSerie(i)`
    existe — não leia `pos[exIdx]` direto, ele só é escrito na troca.
  - `achaPendente(dir)` acha o próximo (`1`) ou anterior (`-1`) pendente, circular.
    Devolve `-1` quando o atual é o único que resta.
- ⚠️ **Fim de treino é "não sobrou pendente", nunca "último do array".** Nunca
  volte a testar `exIdx >= W.exercicios.length - 1` para decidir o fim, e nunca
  avance com `exIdx++`. Com o pular liberado, o último exercício do array pode ser
  concluído no meio do treino, com outro ainda em aberto — o `askFinish()`
  dispararia cedo e a sessão fecharia com exercício por fazer.
- ⚠️ **Era daí que vinha um crash na v1:** "Voltar ao treino" na tela de confirmação
  chamava `startRest(false)`, e o `afterRest()` fazia `exIdx++` para fora do array;
  o `render()` seguinte lia `W.exercicios[undefined].nome` e a tela morria. Hoje o
  botão vai para o exercício pendente, e some quando não há nenhum.
- **"Copiar anterior"** puxa da última entrada do mesmo `exIdx` **na sessão
  atual** — decisão explícita do usuário. Não estenda para sessões passadas sem
  ele pedir; isso exigiria persistência, que ele recusou.
- **"Encerrar treino"** está sempre disponível e monta o resumo com o que já foi
  registrado. Não é o mesmo caminho do `confirm`.
- Cronômetros usam `performance.now()` com acumulador, não incremento por
  intervalo, para não derivar quando a aba perde o foco.
- **`beep()` chama `ac.resume()` se o contexto estiver `suspended`.** O iOS suspende
  o AudioContext quando o app perde o foco; sem isso a contagem final fica muda
  justamente quando o telefone ficou parado no banco durante o descanso.
- **Pular exercício descarta o cronômetro da série em andamento**, que ainda não foi
  registrada. É intencional: quem pula não executou a série.

---

## Ideias já levantadas e conscientemente deixadas de fora da v1

Não implemente por conta própria. Estão aqui só para não serem "redescobertas":

- RIR (repetições na reserva)
- Séries de aquecimento que não contam no volume
- Registro separado por lado em exercícios unilaterais
- Histórico entre sessões e exportação CSV
- Edição de treino pela própria interface
