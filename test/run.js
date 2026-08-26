/* Testes da máquina de estados.  Rodar:  node test/run.js
   Sem dependência nenhuma — só o Node. */

import { readFileSync } from "node:fs";
import { instalarStubs, els, clock, tickAll, beeps, storage as stubStorage } from "./stubs.js";

instalarStubs();

const WORKOUTS = JSON.parse(readFileSync(new URL("../workouts.json", import.meta.url), "utf8"));

/* importados depois dos stubs: os módulos não tocam no DOM ao carregar, mas
   audio.js e session.js leem `window`/`performance` assim que rodam algo */
const { S, resetSessao, seriesOf, achaPendente, progresso, pendente, podeIrPara } = await import("../js/state.js");
const session = await import("../js/session.js");
const { render } = await import("../js/render.js");
const { bindEvents } = await import("../js/events.js");
const storage = await import("../js/storage.js");

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
  stubStorage().clear();
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
/* Alguns testes precisam de um exercicio com CARGA (senao `kg` entra como null)
   ou com um minimo de SERIES (senao o exercicio fecha antes da 3a).

   ⚠️ Nao fixe o indice 0. Estes testes assumiam que o exercicio 0 do treino A
   servia, e quebraram calados quando a rotina mudou e o primeiro virou o Monster
   Walk — sem carga e com 2 series. O workouts.json e editavel por design; o teste
   e que tem de procurar um exercicio que sirva. Se nenhum servir, estoura aqui,
   com o motivo, em vez de falhar tres secoes adiante. */
function achaEx(cond, descricao, t = 0){
  const i = WORKOUTS.treinos[t].exercicios.findIndex(cond);
  if(i === -1) throw new Error(
    "workouts.json: o treino " + WORKOUTS.treinos[t].id +
    " nao tem exercicio " + descricao + " — o teste nao tem como rodar");
  return i;
}
const exComPeso   = min => achaEx(e => e.peso && e.series >= min,
                                  "com carga e ao menos " + min + " series");
const exComSeries = min => achaEx(e => e.series >= min,
                                  "com ao menos " + min + " series");

/* Leva a sessao ate esse exercicio. No-op se ja for o que esta em foco. */
function irPara(i){ if(i !== S.exIdx) session.goToEx(i); }

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
  /* precisa de carga (para haver kg a copiar) e de 2 series (para haver uma
     serie seguinte no MESMO exercicio de onde copiar) */
  irPara(exComPeso(2));
  concluirSerie(80, 60); passarDescanso();
  session.openForm();
  els.btnCopy.click();
  eq(els.inReps.value, 80, "copiou as repetições da série anterior");
  eq(els.inKg.value, 60, "copiou o peso");

  const antes = S.log.length;
  session.saveSet(false);
  eq(S.log.length, antes, "'não registrar' não grava a série");
}

secao("13. Lista do treino: salto direto");
{
  novaSessao(0);
  const n = S.W.exercicios.length;
  ok(!podeIrPara(S.exIdx), "não dá para saltar para o exercício em foco");
  ok(podeIrPara(1), "dá para saltar para um pendente");

  S.pos[2] = seriesOf(2) + 1;                 // fecha o exercício 2
  ok(!podeIrPara(2), "não dá para saltar para um exercício concluído");

  render();
  const h = els.planList.innerHTML;
  ok(h.includes('data-ex="0"') && h.includes('data-ex="' + (n-1) + '"'),
     "a lista traz todos os " + n + " exercícios");
  ok(h.includes("pex atual"), "marca o exercício em foco");
  ok(h.includes("pex feito"), "marca o concluído");
  ok((h.match(/disabled/g) || []).length >= 2, "em foco e concluído não são clicáveis");
  ok(h.includes("0 de " + seriesOf(0)), "mostra quantas séries de cada");

  session.goToEx(1);
  eq(S.exIdx, 1, "saltar leva ao exercício escolhido");
}

secao("14. Aviso visual nos últimos 5 s");
{
  novaSessao(0);
  concluirSerie();
  const desc = S.W.exercicios[0].descanso;
  clock.advance((desc - 8) * 1000); tickAll();
  ok(!els.dial.classList.contains("urgente"), "ainda não avisa a 8 s do fim");

  clock.advance(3500); tickAll();
  ok(els.dial.classList.contains("urgente"), "avisa dentro dos 5 s finais");

  passarDescanso();
  ok(!els.dial.classList.contains("urgente"), "o aviso some ao voltar a executar");
}

secao("15. Desfazer a última série");
{
  novaSessao(0);
  irPara(exComSeries(3));                     // duas séries feitas e ainda pendente
  concluirSerie(10, 40); passarDescanso();
  concluirSerie(8, 45); passarDescanso();
  eq(S.log.length, 2, "duas séries registradas");
  eq(S.serie, 3, "está na série 3");

  ok(session.desfazerUltima(), "desfaz");
  eq(S.log.length, 1, "a última saiu do registro");
  eq(S.serie, 2, "voltou para a série desfeita");
  eq(S.phase, "work", "volta a executar");
  eq(S.log[0].reps, 10, "a série anterior continua intacta");

  ok(session.desfazerUltima(), "desfaz de novo");
  eq(S.log.length, 0, "sem séries");
  ok(!session.desfazerUltima(), "sem nada a desfazer, não faz nada");
}

secao("16. Desfazer não invade outro exercício");
{
  novaSessao(0);
  concluirSerie(); passarDescanso();          // 1 série no exercício 0
  session.goToEx(achaPendente(1));            // vai para o 1, sem registrar nada
  eq(S.exIdx, 1, "está no exercício 1");
  ok(!session.desfazerUltima(), "não apaga a série do exercício 0");
  eq(S.log.length, 1, "o registro do outro exercício continua lá");
}

secao("17. Desfazer devolve o exercício à pendência");
{
  novaSessao(0);
  correrTreino();                              // fecha o treino inteiro
  eq(S.phase, "confirm", "chegou ao confirm");
  ok(!session.desfazerUltima(), "não desfaz durante a confirmação");

  els.btnMoreSet.click();                      // sai do confirm para work
  ok(session.desfazerUltima(), "desfaz já em execução");
  ok(pendente(S.exIdx), "o exercício voltou a ficar pendente");
}

secao("18. Sessão em andamento: salvar, ler e limpar");
{
  novaSessao(0);
  concluirSerie(12, 50); passarDescanso();

  const salva = storage.lerSalva();
  ok(salva !== null, "a sessão foi salva");
  eq(salva.treinoId, S.W.id, "guarda o treino pelo id, não pelo índice");
  eq(salva.log.length, 1, "guarda as séries registradas");
  eq(salva.exIdx, S.exIdx, "guarda a posição");

  storage.limpar();
  eq(storage.lerSalva(), null, "limpar apaga");
}

secao("19. Sessão salva é descartada quando não faz mais sentido");
{
  novaSessao(0);
  concluirSerie(); passarDescanso();
  ok(storage.lerSalva() !== null, "há sessão salva");

  clock.advance(7 * 3600 * 1000);
  eq(storage.lerSalva(), null, "sessão parada há mais de 6 h é esquecida");

  novaSessao(0);
  concluirSerie(); passarDescanso();
  const idOriginal = S.W.id;
  S.TREINOS = S.TREINOS.filter(t => t.id !== idOriginal);   // o treino sumiu do json
  eq(storage.lerSalva(), null, "treino que não existe mais é descartado");

  novaSessao(0);
  concluirSerie(); passarDescanso();
  const cru = JSON.parse(stubStorage().getItem("strongrun.sessao"));
  cru.exIdx = 99;                                            // posição impossível
  stubStorage().setItem("strongrun.sessao", JSON.stringify(cru));
  eq(storage.lerSalva(), null, "posição fora do treino atual é descartada");
}

secao("20. Retomar restaura onde parou");
{
  novaSessao(0);
  irPara(exComPeso(1));                       // sem carga, o kg registrado seria null
  concluirSerie(9, 70); passarDescanso();
  session.goToEx(achaPendente(1));
  concluirSerie(7, 30); passarDescanso();

  const salva = storage.lerSalva();
  const exIdxAntes = S.exIdx, serieAntes = S.serie, logAntes = S.log.length;

  /* simula o app sendo fechado e aberto de novo */
  S.W = null; S.phase = "idle"; resetSessao();
  session.retomarSessao(salva);

  eq(S.exIdx, exIdxAntes, "voltou ao mesmo exercício");
  eq(S.serie, serieAntes, "voltou à mesma série");
  eq(S.log.length, logAntes, "as séries registradas voltaram");
  eq(S.phase, "work", "retoma executando, nunca no meio de um descanso");
  eq(S.log[0].kg, 70, "os pesos registrados sobreviveram");
}

secao("21. Treino concluído não deixa sessão para retomar");
{
  novaSessao(0);
  correrTreino();
  els.btnFinish.click();
  eq(storage.lerSalva(), null, "finalizar apaga a sessão salva");
}

console.log("\n---------------------------------------------");
console.log(passes + " passaram, " + fails + " falharam");
process.exit(fails ? 1 : 0);
