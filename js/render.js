/* Desenha as três telas a partir do estado.

   Regra deste arquivo: ele SÓ LÊ. Nenhuma função daqui muda `S` nem dispara
   transição — é isso que permite chamar render() de qualquer lugar sem efeito
   colateral, e o que evita ciclo de import com session.js. */

import { $, texto, html, esc } from "./dom.js";
import { fmt } from "./format.js";
import { S, seriesOf, achaPendente, progresso, workSecs,
         pendente, podeIrPara, feitasDe } from "./state.js";

/* ---------- TELA 1: escolha ---------- */
/* Recebe o que fazer no clique em vez de importar session.js — sem isso,
   render e session se importariam em círculo. */
export function renderPick(aoEscolher){
  html("pickList", S.TREINOS.map((t, i) => {
    const s = t.exercicios.reduce((a, e) => a + e.series, 0);
    return '<button class="pick" data-i="' + i + '"><span class="pickin">' +
      '<span class="badge">' + esc(t.id) + '</span>' +
      '<span class="pickbody"><h3>' + esc(t.nome) + '</h3><p>' + esc(t.descricao) + '</p>' +
      '<span class="n mono">' + t.exercicios.length + ' exercícios · ' + s + ' séries</span>' +
      '</span></span></button>';
  }).join(""));

  document.querySelectorAll(".pick").forEach(b =>
    b.addEventListener("click", () => aoEscolher(+b.dataset.i)));
}

export function erroDeCarga(){
  html("pickList",
    '<p class="empty">Não consegui carregar <b>workouts.json</b>. ' +
    'Confirme que o arquivo está publicado ao lado do index.html.</p>');
}

/* ---------- TELA 2: sessão ---------- */
export function renderTop(){
  if(!S.sessionStart) return;
  texto("topmeta", "Treino " + S.W.id + " · " + fmt((Date.now() - S.sessionStart) / 1000));
}

export function render(){
  renderTop();
  const ex = S.W.exercicios[S.exIdx], tot = seriesOf(S.exIdx);

  texto("step", "Exercício " + (S.exIdx + 1) + " de " + S.W.exercicios.length +
                " · Série " + S.serie + " de " + tot);
  texto("exNome", ex.nome);
  texto("exAlvo", (ex.alvo || "") + (ex.peso ? "" : " · sem carga"));

  /* qual exercício vem depois deste, para dar tempo de se preparar */
  const nx = achaPendente(1);
  texto("nextEx", nx === -1
    ? "Último exercício pendente do treino"
    : "Próximo exercício: " + S.W.exercicios[nx].nome);
  $("btnPrevEx").disabled = nx === -1;
  $("btnNextEx").disabled = nx === -1;

  let t = "";
  for(let s = 1; s <= tot; s++)
    t += '<span class="st ' + (s < S.serie ? "done" : (s === S.serie ? "on" : "")) + '"></span>';
  html("ticks", t);

  if(S.phase === "rest"){
    texto("dialTime", fmt(S.restLeft));
    texto("dialSub", S.serie >= tot
      ? "A seguir: " + (S.W.exercicios[achaPendente(1)] ? S.W.exercicios[achaPendente(1)].nome : "fim")
      : "A seguir: série " + (S.serie + 1) + " de " + tot);
  } else {
    texto("dialTime", fmt(workSecs()));
    texto("dialSub", S.paused && S.phase === "work" ? "Pausado" : "");
  }

  renderLedger();
  renderPlan();

  const { total, feitas } = progresso();
  $("progFill").style.width = (feitas / total * 100) + "%";
  texto("progA", feitas + " de " + total + " séries");
  texto("progB", (total - feitas) + " restantes");
}

export function renderLedger(){
  const rows = S.log.filter(l => l.exIdx === S.exIdx);
  html("ledgerBody", rows.length ? rows.map(l =>
    '<div class="lrow"><span class="idx mono">' + l.serie + '</span>' +
    '<span class="val mono">' + (l.kg !== null ? l.kg + " kg × " : "") + l.reps + ' reps</span>' +
    '<span class="t mono">' + fmt(l.secs) + '</span></div>'
  ).join("") : '<div class="empty">Nenhuma série registrada ainda.</div>');

  /* desfazer só faz sentido com série registrada deste exercício, e só fora do
     formulário e da confirmação */
  const podeDesfazer = rows.length > 0 && (S.phase === "work" || S.phase === "rest");
  $("btnUndo").classList.toggle("hide", !podeDesfazer);
}

/* Lista dos exercícios do treino, para saltar direto ao que estiver livre. */
export function renderPlan(){
  html("planList", S.W.exercicios.map((ex, i) => {
    const tot = seriesOf(i), feitas = feitasDe(i);
    const atual = i === S.exIdx;
    const feito = !pendente(i);
    const cls = "pex" + (atual ? " atual" : "") + (feito ? " feito" : "");
    return '<button class="' + cls + '" data-ex="' + i + '"' +
             (podeIrPara(i) ? "" : " disabled") + '>' +
      '<span class="n">' + (i + 1) + '</span>' +
      '<span class="nm">' + esc(ex.nome) + '</span>' +
      '<span class="qt">' + feitas + " de " + tot + (feito ? " ✓" : "") + '</span>' +
    '</button>';
  }).join(""));
}

/* Bloco "treino em andamento" da tela inicial. */
export function renderResume(salva){
  if(!salva){ $("resume").classList.add("hide"); return; }
  const total = salva.W.exercicios.reduce(
    (a, e, i) => a + e.series + (salva.extra[i] || 0), 0);
  $("resumeTxt").innerHTML =
    "Treino <b>" + esc(salva.W.id) + " · " + esc(salva.W.nome) + "</b><br>" +
    salva.log.length + " de " + total + " séries registradas.";
  $("resume").classList.remove("hide");
}

/* ---------- TELA 3: resumo ---------- */
export function renderSummary(){
  const dur = (Date.now() - S.sessionStart) / 1000;
  const vol = S.log.reduce((a, l) => a + (l.kg || 0) * l.reps, 0);
  const tos = S.log.reduce((a, l) => a + l.secs, 0);

  texto("sumHead", "Treino " + S.W.id + " · " + S.W.nome);
  texto("sDur", fmt(dur));
  texto("sSets", S.log.length);
  $("sVol").innerHTML = Math.round(vol) + '<span class="u"> kg</span>';
  texto("sTos", fmt(tos));

  const byEx = {};
  S.log.forEach(l => { (byEx[l.exIdx] = byEx[l.exIdx] || []).push(l); });

  html("sumList", Object.keys(byEx).map(k => {
    const ex = S.W.exercicios[k];
    const sets = byEx[k].map(l =>
      (l.kg !== null ? l.kg + " kg × " : "") + l.reps + " (" + fmt(l.secs) + ")").join("  ·  ");
    return '<div class="sumex"><div class="nm">' + esc(ex.nome) + '</div>' +
           '<div class="sets">' + sets + '</div></div>';
  }).join("") || '<div class="empty">Nenhuma série registrada.</div>');
}
