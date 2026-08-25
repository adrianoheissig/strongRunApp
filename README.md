# strongRunApp

Registro de treino de força para corredor. Escolhe o treino do dia, cronometra a
execução de cada série, registra peso e repetições, descansa sozinho e fecha com
um resumo da sessão.

## Uso

1. Escolha o treino (A, B, C, D) na tela inicial.
2. O cronômetro **sobe** enquanto você executa — é o tempo sob tensão.
3. "Concluir série" abre os campos de kg e repetições. "Copiar anterior" repete os
   valores da série anterior do mesmo exercício.
4. Ao salvar, o descanso começa automaticamente e avança sozinho para a próxima
   série ou para o próximo exercício.
5. Na última série do último exercício, ele pergunta se o treino acabou.

"Encerrar treino" fecha a sessão a qualquer momento com o que já foi registrado.

**O resumo não é salvo.** É mostrado na tela e descartado ao voltar ao início.

## Editar a rotina

Tudo em `workouts.json`. Não é preciso mexer no código:

```json
{ "nome": "Agachamento livre", "series": 4, "descanso": 150,
  "peso": true, "alvo": "5-6 reps" }
```

`peso: false` esconde o campo de kg (prancha, exercícios de peso corporal).
`descanso` em segundos. Pode adicionar quantos treinos quiser.

Os treinos que vêm no arquivo são um ponto de partida genérico — troque pelos seus.

## Instalar no iPhone

Abrir a URL no **Safari** → Compartilhar → Adicionar à Tela de Início. Ganha ícone,
tela cheia e funciona offline.

## Rodar local

```bash
python3 -m http.server 8000
```

Precisa de servidor HTTP: `workouts.json` é carregado via `fetch()` e não funciona
abrindo o arquivo direto por `file://`.
