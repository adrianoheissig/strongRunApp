/* Liga os botões às transições.

   Exporta uma função em vez de registrar no import: assim importar este módulo
   não toca no DOM, e o teste pode carregar session.js/state.js sem precisar de
   uma página. */

import { $, esconder } from "./dom.js";
import { S, achaPendente } from "./state.js";
import {
  startWork, openForm, saveSet, afterRest, askFinish, finish, goToEx
} from "./session.js";
import { render } from "./render.js";

export function bindEvents(){

  /* ---------- execução ---------- */
  $("btnDone").addEventListener("click", () => {
    if(S.phase === "work") openForm();
    else if(S.phase === "rest") afterRest();
  });

  $("btnPause").addEventListener("click", () => {
    if(S.phase === "work"){
      if(S.paused){
        S.t0 = performance.now(); S.paused = false;
        $("btnPause").textContent = "Pausar";
      } else {
        S.acc += performance.now() - S.t0; S.paused = true;
        $("btnPause").textContent = "Retomar";
      }
      render();
    }
    else if(S.phase === "rest"){ S.restEnd += 30000; render(); }
  });

  /* pular / voltar: a máquina do exercício está ocupada */
  $("btnNextEx").addEventListener("click", () => goToEx(achaPendente(1)));
  $("btnPrevEx").addEventListener("click", () => goToEx(achaPendente(-1)));

  $("btnStop").addEventListener("click", () => {
    if(confirm("Encerrar o treino agora? O resumo será montado com as séries já registradas."))
      finish();
  });

  /* ---------- registro da série ---------- */
  $("btnSave").addEventListener("click", () => saveSet(true));
  $("btnSkipLog").addEventListener("click", () => saveSet(false));

  $("btnCopy").addEventListener("click", () => {
    const prev = S.log.filter(l => l.exIdx === S.exIdx).pop();
    if(!prev) return;
    if(prev.kg !== null) $("inKg").value = prev.kg;
    $("inReps").value = prev.reps;
  });

  $("inReps").addEventListener("keydown", e => { if(e.key === "Enter") saveSet(true); });
  $("inKg").addEventListener("keydown", e => { if(e.key === "Enter") $("inReps").focus(); });

  /* ---------- confirmação de fim ---------- */
  $("btnFinish").addEventListener("click", finish);

  $("btnMoreSet").addEventListener("click", () => {
    S.extra[S.exIdx] = (S.extra[S.exIdx] || 0) + 1;
    S.serie++;
    esconder("confirm");
    startWork();
  });

  $("btnBackEx").addEventListener("click", () => {
    esconder("confirm");
    const nxt = achaPendente(1);
    /* ⚠️ antes isto ia para startRest(), e o afterRest() fazia exIdx++ para fora
       do array — o render seguinte lia W.exercicios[undefined] e a tela morria. */
    if(nxt === -1) startWork(); else goToEx(nxt);
  });

  /* ---------- resumo ---------- */
  $("btnNew").addEventListener("click", () => {
    S.W = null; S.log = []; S.sessionStart = 0;
    $("topmeta").textContent = "";
    esconder("scSum");
    document.getElementById("scPick").classList.remove("hide");
    window.scrollTo({ top: 0 });
  });
}
