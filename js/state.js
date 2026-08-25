/* Estado da sessão e as perguntas que se faz sobre ele.
   Nada aqui toca no DOM nem no relógio — é a parte testável do app. */

/* Um objeto só, em vez de variáveis soltas: `import { S }` dá acesso vivo ao
   estado. Com `export let` os importadores recebem cópias somente-leitura. */
export const S = {
  TREINOS: [],          // os treinos do workouts.json
  W: null,              // o treino escolhido

  exIdx: 0,             // exercício em foco
  serie: 1,             // série em foco, DENTRO do exercício em foco
  pos: {},              // exIdx -> próxima série daquele exercício (retoma ao voltar)
  extra: {},            // exIdx -> séries acrescentadas por "mais uma série aqui"
  log: [],              // {exIdx, serie, kg, reps, secs}

  phase: "idle",        // idle | work | form | rest | confirm

  t0: 0, acc: 0, paused: false,   // cronômetro crescente (tempo sob tensão)
  restEnd: 0, restLeft: 0,        // regressivo do descanso
  sessionStart: 0,
  lastBeep: null                  // último segundo que já bipou, para não repetir
};

/* Segundos de execução da série em curso.
   ⚠️ Acumulador sobre performance.now(), NUNCA incremento por intervalo: a aba
   perde o foco no telefone e um contador por tick derivaria do tempo real. */
export function workSecs(){
  return S.paused ? S.acc / 1000 : (S.acc + (performance.now() - S.t0)) / 1000;
}

/* Zera tudo que é de sessão. Chamado ao escolher um treino. */
export function resetSessao(){
  S.exIdx = 0; S.serie = 1;
  S.pos = {}; S.extra = {}; S.log = [];
  S.t0 = 0; S.acc = 0; S.paused = false;
  S.restEnd = 0; S.restLeft = 0;
  S.lastBeep = null;
}

/* Quantas séries o exercício `i` tem, contando as acrescentadas na hora.
   Use SEMPRE isto — ler `W.exercicios[i].series` direto ignora o "mais uma
   série aqui" e desalinha a contagem e a barra de progresso. */
export const seriesOf = i => S.W ? S.W.exercicios[i].series + (S.extra[i] || 0) : 0;

/* Em que série o exercício `i` está. O exercício em foco tem a resposta na
   variável viva `serie`; os outros, no mapa `pos`, escrito só na troca.
   Ler `pos[exIdx]` direto devolve valor velho — por isso esta função existe. */
export const proxSerie = i => i === S.exIdx ? S.serie : (S.pos[i] || 1);

/* Um exercício está pendente enquanto ainda tiver série por fazer. */
export const pendente = i => proxSerie(i) <= seriesOf(i);

/* Próximo (dir=1) ou anterior (dir=-1) exercício PENDENTE, circular.
   Devolve -1 quando o exercício em foco é o único que ainda tem série a fazer. */
export function achaPendente(dir){
  if(!S.W) return -1;
  const n = S.W.exercicios.length;
  for(let k = 1; k < n; k++){
    const i = ((S.exIdx + dir * k) % n + n) % n;
    if(pendente(i)) return i;
  }
  return -1;
}

/* Total de séries do treino e quantas já foram concluídas — alimenta a barra.
   ⚠️ Conta pela série de CADA exercício, não por "tudo antes do índice atual":
   com o pular liberado, um exercício anterior pode estar intocado, e somar as
   séries dele daria progresso que não aconteceu. */
export function progresso(){
  const total  = S.W.exercicios.reduce((a, e, i) => a + seriesOf(i), 0);
  const feitas = S.W.exercicios.reduce((a, e, i) => a + (proxSerie(i) - 1), 0);
  return { total, feitas };
}
