/* Liga os botões às transições.

   Exporta uma função em vez de registrar no import: assim importar este módulo
   não toca no DOM, e o teste pode carregar session.js/state.js sem precisar de
   uma página. */

import { $, esconder } from "./dom.js";
import { S, achaPendente, podeIrPara } from "./state.js";
import {
  startWork, openForm, saveSet, afterRest, askFinish, finish, goToEx,
  desfazerUltima, retomarSessao
} from "./session.js";
import { render, renderResume } from "./render.js";
import { limpar } from "./storage.js";

/* A sessão interrompida que a tela inicial está oferecendo, se houver.
   main.js a informa depois de carregar os treinos. */
let sessaoSalva = null;
export function oferecerSessao(s){
  sessaoSalva = s;
  renderResume(s);
}

export function bindEvents(){

  /* ---------- retomar treino interrompido ---------- */
  $("btnResume").addEventListener("click", () => {
    if(sessaoSalva) retomarSessao(sessaoSalva);
  });

  $("btnDiscard").addEventListener("click", () => {
    limpar();
    oferecerSessao(null);
  });

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

  /* salto direto pela lista do treino. O listener fica no container, não nos
     itens: eles são refeitos a cada render e os listeners vazariam. */
  $("planList").addEventListener("click", e => {
    const alvo = e.target.closest ? e.target.closest("[data-ex]") : null;
    if(!alvo) return;
    const i = +alvo.dataset.ex;
    if(podeIrPara(i)) goToEx(i);
  });

  /* desfazer a última série registrada deste exercício */
  $("btnUndo").addEventListener("click", () => {
    const ex = S.W.exercicios[S.exIdx];
    const ultima = S.log.filter(l => l.exIdx === S.exIdx).pop();
    if(!ultima) return;
    const desc = (ultima.kg !== null ? ultima.kg + " kg × " : "") + ultima.reps + " reps";
    if(confirm("Desfazer a série " + ultima.serie + " de " + ex.nome + " (" + desc + ")?\n\nEla volta a ser executada."))
      desfazerUltima();
  });

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
    limpar();                  // o treino acabou: não há sessão a retomar
    oferecerSessao(null);
    esconder("scSum");
    $("scPick").classList.remove("hide");
    window.scrollTo({ top: 0 });
  });
}
