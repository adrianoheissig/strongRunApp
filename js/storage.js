/* Guarda a sessão EM ANDAMENTO, para um refresh ou o iPhone descartando a aba
   não jogarem fora o treino do dia.

   ⚠️ Isto NÃO é histórico. É resiliência da sessão em curso, e a diferença é
   deliberada: o registro é apagado assim que o treino termina ou é descartado.
   Nada sobrevive a um treino concluído — o resumo continua sendo mostrado e
   jogado fora, que é a decisão do dono do app. Não transforme isto em histórico,
   gráfico ou exportação sem ele pedir.

   Também não sobrevive para sempre: sessão parada há mais de VALIDADE_H horas é
   tratada como esquecida, não como retomável. */

import { S } from "./state.js";

const CHAVE = "strongrun.sessao";
const VALIDADE_H = 6;

/* localStorage pode lançar: aba anônima do Safari, cota cheia, cookies
   bloqueados. Nada disso pode derrubar o treino, então tudo falha em silêncio
   e o app segue funcionando sem salvar. */
function store(){
  try{ return window.localStorage; }catch(e){ return null; }
}

export function salvar(){
  const ls = store();
  if(!ls || !S.W || S.phase === "idle") return;
  try{
    ls.setItem(CHAVE, JSON.stringify({
      v: 1,
      treinoId: S.W.id,          // pelo id, não pelo índice: o workouts.json muda
      exIdx: S.exIdx,
      serie: S.serie,
      pos: S.pos,
      extra: S.extra,
      log: S.log,
      sessionStart: S.sessionStart,
      salvoEm: Date.now()
    }));
  }catch(e){}
}

export function limpar(){
  const ls = store();
  if(!ls) return;
  try{ ls.removeItem(CHAVE); }catch(e){}
}

/* Devolve a sessão salva se ela ainda fizer sentido para os treinos atuais,
   ou null. Nunca devolve algo que faria o app quebrar ao restaurar. */
export function lerSalva(){
  const ls = store();
  if(!ls) return null;

  let d;
  try{ d = JSON.parse(ls.getItem(CHAVE) || "null"); }catch(e){ return null; }
  if(!d || d.v !== 1) return null;

  if(Date.now() - d.salvoEm > VALIDADE_H * 3600 * 1000){ limpar(); return null; }

  /* o treino tem de existir HOJE — o workouts.json é editado à mão */
  const idx = S.TREINOS.findIndex(t => t.id === d.treinoId);
  if(idx === -1){ limpar(); return null; }

  /* e a posição salva tem de caber no treino como ele está agora */
  const W = S.TREINOS[idx];
  if(!Number.isInteger(d.exIdx) || d.exIdx < 0 || d.exIdx >= W.exercicios.length){
    limpar(); return null;
  }
  if(!Array.isArray(d.log) || d.log.some(l => l.exIdx >= W.exercicios.length)){
    limpar(); return null;
  }

  return { ...d, treinoIdx: idx, W };
}
