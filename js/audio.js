/* Som, vibração e "não apague a tela". Tudo falha em silêncio de propósito:
   nenhum destes recursos é essencial, e navegador que não tem não pode
   derrubar o treino. */

let ac = null;    // AudioContext, criado no primeiro bipe
let wake = null;  // trava de tela

export function beep(freq, dur, vol){
  try{
    if(!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    /* ⚠️ o iOS suspende o áudio quando o app perde o foco — sem este resume a
       contagem final fica muda justamente com o telefone parado no banco. */
    if(ac.state === "suspended") ac.resume();

    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(vol || .12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur);
  }catch(e){}
}

export function buzz(padrao){
  if(navigator.vibrate) try{ navigator.vibrate(padrao); }catch(e){}
}

export async function keepAwake(ligar){
  try{
    if(ligar && "wakeLock" in navigator && !wake)
      wake = await navigator.wakeLock.request("screen");
    else if(!ligar && wake){ wake.release(); wake = null; }
  }catch(e){}
}
