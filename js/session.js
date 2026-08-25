/* A máquina de estados da sessão de treino.

   idle → work → form → rest → work → … → confirm → resumo

   | work    | cronômetro crescente (tempo sob tensão)
   | form    | registro de kg e reps
   | rest    | regressivo do descanso; avança sozinho
   | confirm | quando não sobra série pendente: "treino concluído?"

   Este arquivo MUDA o estado e chama render(). render.js nunca chama daqui —
   é o que mantém a dependência em mão única. */

import { $, texto, mostrar, esconder } from "./dom.js";
import { fmt } from "./format.js";
import { beep, buzz, keepAwake } from "./audio.js";
import { render, renderTop, renderSummary } from "./render.js";
import { S, resetSessao, seriesOf, achaPendente, workSecs } from "./state.js";

let tickId = null;

/* ---------- entrada e saída da sessão ---------- */
export function startWorkout(i){
  S.W = S.TREINOS[i];
  resetSessao();
  S.sessionStart = Date.now();
  esconder("scPick");
  mostrar("scRun");
  keepAwake(true);
  startWork();
  if(!tickId) tickId = setInterval(tick, 250);
}

export function finish(){
  S.phase = "idle";
  clearInterval(tickId); tickId = null;
  keepAwake(false);
  renderSummary();
  esconder("scRun");
  mostrar("scSum");
  window.scrollTo({ top: 0 });
}

/* ---------- fase: executando ---------- */
export function startWork(){
  S.phase = "work";
  S.acc = 0; S.paused = false; S.t0 = performance.now();
  esconder("form");
  esconder("confirm");
  mostrar("actions");
  $("dial").classList.remove("rest");
  texto("dialLab", "Executando");
  texto("btnPause", "Pausar");
  texto("btnDone", "Concluir série");
  render();
}

/* ---------- fase: registrando a série ---------- */
export function openForm(){
  S.phase = "form";
  const secs = workSecs();
  S.paused = true; S.acc = secs * 1000;

  const ex = S.W.exercicios[S.exIdx];
  esconder("actions");
  mostrar("form");
  texto("formSerie", S.serie + " de " + seriesOf(S.exIdx));
  $("wrapKg").style.display = ex.peso ? "" : "none";
  $("fields").className = ex.peso ? "fields two" : "fields";
  texto("tos", "Tempo de execução: " + fmt(secs));

  /* "copiar anterior" puxa da série anterior DESTE exercício, NESTA sessão.
     Não do último treino: isso exigiria persistência, que foi recusada. */
  const prev = S.log.filter(l => l.exIdx === S.exIdx).pop();
  $("btnCopy").style.display = prev ? "" : "none";

  $("inKg").value = ""; $("inReps").value = "";
  setTimeout(() => { (ex.peso ? $("inKg") : $("inReps")).focus(); }, 60);
  render();
}

export function saveSet(registrar){
  const ex = S.W.exercicios[S.exIdx];
  const secs = Math.round(workSecs());

  if(registrar){
    S.log.push({
      exIdx: S.exIdx, serie: S.serie, secs: secs,
      kg:   ex.peso ? (parseFloat($("inKg").value) || 0) : null,
      reps: parseInt($("inReps").value, 10) || 0
    });
  }

  esconder("form");
  const ultima = S.serie >= seriesOf(S.exIdx);
  /* ⚠️ fim do treino é "não sobrou série pendente", NUNCA "último do array":
     com o pular liberado, o último exercício da lista pode ser concluído no
     meio do treino, com outro ainda em aberto. */
  if(ultima && achaPendente(1) === -1){ askFinish(); return; }
  startRest(ultima);
}

/* ---------- fase: descanso ---------- */
export function startRest(trocaExercicio){
  S.phase = "rest";
  const ex = S.W.exercicios[S.exIdx];
  S.restLeft = ex.descanso;
  S.restEnd = performance.now() + S.restLeft * 1000;
  S.lastBeep = null;

  $("dial").classList.add("rest");
  texto("dialLab", "Descanso");
  mostrar("actions");
  texto("btnDone", trocaExercicio ? "Pular para o próximo exercício" : "Pular descanso");
  texto("btnPause", "+30 s");
  texto("dialSub", "");
  render();
}

export function afterRest(){
  if(S.serie >= seriesOf(S.exIdx)){
    S.pos[S.exIdx] = S.serie + 1;            // este exercício fechou
    const nxt = achaPendente(1);
    if(nxt === -1){ askFinish(); return; }
    S.exIdx = nxt; S.serie = S.pos[nxt] || 1;  // retoma o pendente onde parou
  }
  else S.serie++;

  startWork();
  beep(880, .14, .14); buzz([70, 50, 70]);
}

/* ---------- fase: confirmação de fim ---------- */
export function askFinish(){
  S.phase = "confirm";
  S.pos[S.exIdx] = seriesOf(S.exIdx) + 1;    // fecha o atual antes de olhar o resto
  S.paused = true;
  esconder("actions");
  mostrar("confirm");

  const nxt = achaPendente(1);
  texto("confirmTxt", nxt === -1
    ? "Você concluiu a última série de " + S.W.exercicios[S.exIdx].nome +
      " e não sobrou nenhuma série pendente no treino " + S.W.id + "."
    : "Você concluiu " + S.W.exercicios[S.exIdx].nome + ", mas ainda há série pendente em " +
      S.W.exercicios[nxt].nome + ".");
  $("btnBackEx").style.display = nxt === -1 ? "none" : "";

  beep(1046, .3, .16); buzz([160, 80, 160]);
  render();
}

/* ---------- navegação entre exercícios ---------- */
/* A máquina da academia está ocupada: pula, faz outro e volta depois.
   A série em andamento ainda não foi registrada, então nada se perde além do
   cronômetro dela, que reinicia. */
export function goToEx(i){
  if(i < 0 || i === S.exIdx) return;
  S.pos[S.exIdx] = S.serie;    // guarda onde parei, para retomar na volta
  S.exIdx = i;
  S.serie = S.pos[i] || 1;
  startWork();
}

/* ---------- o relógio da sessão ---------- */
export function tick(){
  if(S.phase === "work" && !S.paused) render();

  else if(S.phase === "rest"){
    S.restLeft = (S.restEnd - performance.now()) / 1000;
    const w = Math.ceil(S.restLeft);

    /* contagem final: um bipe por segundo nos últimos 5 s, o último mais agudo */
    if(w <= 5 && w > 0 && w !== S.lastBeep){
      S.lastBeep = w;
      beep(w === 1 ? 940 : 760, .09, .11);
      buzz(30);
    }

    if(S.restLeft <= 0){ afterRest(); return; }
    render();
  }

  else if(S.phase === "form" || S.phase === "confirm") renderTop();
}
