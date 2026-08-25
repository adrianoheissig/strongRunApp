/* Testes da máquina de estados.  Rodar:  node test/run.js
   Sem dependência nenhuma — só o Node. */

import { readFileSync } from "node:fs";
import { instalarStubs, els, clock, tickAll, beeps } from "./stubs.js";

instalarStubs();

const WORKOUTS = JSON.parse(readFileSync(new URL("../workouts.json", import.meta.url), "utf8"));

/* importados depois dos stubs: os módulos não tocam no DOM ao carregar, mas
   audio.js e session.js leem `window`/`performance` assim que rodam algo */
const { S, resetSessao, seriesOf, achaPendente, progresso, pendente } = await import("../js/state.js");
const session = await import("../js/session.js");
const { render } = await import("../js/render.js");
const { bindEvents } = await import("../js/events.js");

bindEvents();


let passes = 0, fails = 0, grupo = "";
function secao(t){ grupo = t; console.log("\n=== " + t + " ==="); }
function ok(cond, msg){
  if(cond){ passes++; console.log("  ok   " + msg); }
  else { fails++; console.log("  FALHOU  " + msg); }
}
function eq(a, b, msg){
  ok(Object.is(a, b), msg + (Object.is(a, b) ? "" : "   obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b)));
}

/* ---------- utilidades de sessão ---------- */
function novaSessao(t = 0){
  clock.reset();
  beeps.length = 0;
  S.TREINOS = JSON.parse(JSON.stringify(WORKOUTS.treinos));
  S.W = null; S.phase = "idle"; S.sessionStart = 0;
  resetSessao();
  session.startWorkout(t);
}
function concluirSerie(reps = 10, kg = 20){
  session.openForm();
  els.inReps.value = String(reps);
  els.inKg.value = String(kg);
  session.saveSet(true);
}
function passarDescanso(){
  if(S.phase !== "rest") return;
  clock.advance(10 * 60 * 1000);
  tickAll();
}
function correrTreino(limite = 800){
  let g = 0;
  while(S.phase !== "confirm" && g++ < limite){
    if(S.phase === "work") concluirSerie();
    else if(S.phase === "rest") passarDescanso();
    else break;
  }
}
const totalSeries = () => S.W.exercicios.reduce((a, e, i) => a + seriesOf(i), 0);

/* ===================================================================== */
secao("1. Treino inteiro em ordem");
{
  novaSessao(0);
  const esperado = totalSeries();
  correrTreino();
  eq(S.phase, "confirm", "termina pedindo confirmação");
  eq(S.log.length, esperado, "registrou todas as séries");
  eq(els.btnBackEx.style.display, "none", "sem pendência, 'Voltar ao treino' fica escondido");
}

secao("2. Os quatro treinos fecham certo");
{
  for(let t = 0; t < WORKOUTS.treinos.length; t++){
    novaSessao(t);
    const esperado = totalSeries();
    let erro = null;
    try{ correrTreino(); }catch(e){ erro = e; }
    ok(!erro && S.phase === "confirm" && S.log.length === esperado,
       "treino " + S.W.id + ": " + S.log.length + "/" + esperado + " séries" + (erro ? "  ERRO " + erro.message : ""));
  }
}

secao("3. Pular e voltar retoma na série certa");
{
  novaSessao(0);
  concluirSerie(); passarDescanso();
  eq(S.serie, 2, "exercício 0 avançou para a série 2");

  session.goToEx(achaPendente(1));
  eq(S.exIdx, 1, "pulou para o exercício 1");
  eq(S.serie, 1, "exercício 1 começa na série 1");
  eq(S.phase, "work", "volta a executar");

  concluirSerie(); passarDescanso();
  session.goToEx(achaPendente(-1));
  eq(S.exIdx, 0, "voltou ao exercício 0");
  eq(S.serie, 2, "RETOMOU na série 2, não recomeçou");
  eq(S.log.filter(l => l.exIdx === 0).length, 1, "a série já feita continua registrada");
}

secao("4. Exercício pulado impede o fim do treino");
{
  novaSessao(0);
  const esperado = totalSeries();
  session.goToEx(achaPendente(1));      // deixa o exercício 0 inteiro pendente
  correrTreino();
  eq(S.phase, "confirm", "chegou ao confirm");
  eq(S.exIdx, 0, "o último a fechar foi o exercício pulado");
  eq(S.log.length, esperado, "nenhuma série se perdeu");
}

secao("5. Navegação circular");
{
  novaSessao(0);
  S.exIdx = S.W.exercicios.length - 1; S.serie = 1;
  eq(achaPendente(1), 0, "do último, o próximo pendente é o primeiro");
  eq(achaPendente(-1), S.W.exercicios.length - 2, "o anterior é o penúltimo");
}

secao("6. 'Voltar ao treino' não estoura o array (bug da v1)");
{
  novaSessao(0);
  correrTreino();

  let erro = null;
  try{ els.btnBackEx.click(); render(); }catch(e){ erro = e; }
  ok(erro === null, "acionar não quebra" + (erro ? "  " + erro.message : ""));
  ok(S.exIdx < S.W.exercicios.length, "exIdx permanece dentro do array");
}

secao("7. 'Voltar ao treino' com pendência vai ao exercício pendente");
{
  novaSessao(0);
  session.goToEx(achaPendente(1));       // exercício 0 pendente
  // fecha todos os outros sem passar pelo 0
  let g = 0;
  while(g++ < 800){
    if(S.exIdx === 0 || S.phase === "confirm") break;
    if(S.phase === "work") concluirSerie();
    else if(S.phase === "rest") passarDescanso();
    else break;
  }
  ok(S.exIdx === 0 || S.phase === "confirm", "o pulado é retomado antes de encerrar");
}

secao("8. Label do próximo exercício");
{
  novaSessao(0);
  eq(els.nextEx.textContent, "Próximo exercício: " + S.W.exercicios[1].nome, "mostra o próximo pendente");
  session.goToEx(achaPendente(1));
  eq(els.nextEx.textContent, "Próximo exercício: " + S.W.exercicios[2].nome, "após pular, aponta o seguinte");
  eq(els.btnNextEx.disabled, false, "botões ativos havendo mais de um pendente");

  // marca todos menos o atual como fechados
  for(let i = 0; i < S.W.exercicios.length; i++)
    if(i !== S.exIdx) S.pos[i] = seriesOf(i) + 1;
  render();
  eq(els.nextEx.textContent, "Último exercício pendente do treino", "label de último pendente");
  eq(els.btnNextEx.disabled, true, "botão pular desabilitado");
  eq(els.btnPrevEx.disabled, true, "botão voltar desabilitado");
}

secao("9. Contagem final: um bipe por segundo nos últimos 5 s");
{
  novaSessao(0);
  /* `lastBeep` guarda o segundo que acabou de bipar — é o efeito observável da
     contagem, e não exige espionar o AudioContext */
  const vistos = [];
  concluirSerie();
  ok(S.phase === "rest", "entrou em descanso");
  const desc = S.W.exercicios[0].descanso;

  clock.advance((desc - 5.6) * 1000); tickAll();
  eq(S.lastBeep, null, "nada antes dos 5 s finais");

  for(let k = 0; k < 5; k++){
    clock.advance(1000); tickAll();
    if(S.phase !== "rest") break;
    vistos.push(S.lastBeep);
  }
  eq(JSON.stringify(vistos), JSON.stringify([5,4,3,2,1]), "bipou em 5, 4, 3, 2 e 1");
}

secao("10. Progresso conta só o que foi feito de verdade");
{
  novaSessao(0);
  const { total } = progresso();
  eq(progresso().feitas, 0, "começa em zero");

  session.goToEx(achaPendente(1));       // pula o exercício 0 sem fazer nada
  eq(progresso().feitas, 0, "pular NÃO conta as séries do exercício pulado");

  concluirSerie(); passarDescanso();
  eq(progresso().feitas, 1, "uma série feita conta uma");
  eq(progresso().total, total, "o total não muda ao pular");
}

secao("11. 'Mais uma série aqui'");
{
  novaSessao(0);
  correrTreino();
  const antes = seriesOf(S.exIdx);
  els.btnMoreSet.click();
  eq(seriesOf(S.exIdx), antes + 1, "o exercício ganhou uma série");
  eq(S.phase, "work", "voltou a executar");
  eq(S.serie, antes + 1, "está na série extra");
  ok(pendente(S.exIdx), "e voltou a ficar pendente");
}

secao("12. 'Copiar anterior' e 'não registrar'");
{
  novaSessao(0);
  concluirSerie(80, 60); passarDescanso();
  session.openForm();
  els.btnCopy.click();
  eq(els.inReps.value, 80, "copiou as repetições da série anterior");
  eq(els.inKg.value, 60, "copiou o peso");

  const antes = S.log.length;
  session.saveSet(false);
  eq(S.log.length, antes, "'não registrar' não grava a série");
}

console.log("\n---------------------------------------------");
console.log(passes + " passaram, " + fails + " falharam");
process.exit(fails ? 1 : 0);
