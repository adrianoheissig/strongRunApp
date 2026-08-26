/* DOM, áudio e relógio falsos, para rodar a máquina de estados no Node.

   Só o suficiente para o app funcionar: nada aqui tenta ser um navegador de
   verdade. O tempo é controlado pelo teste — nenhum teste espera de fato. */

function mkEl(id){
  const handlers = {};
  return {
    id,
    textContent: "", innerHTML: "", value: "", disabled: false,
    style: {}, dataset: {},
    className: "",
    classList: {
      _s: new Set(),
      add(c){ this._s.add(c); },
      remove(c){ this._s.delete(c); },
      contains(c){ return this._s.has(c); },
      toggle(c, on){ if(on === undefined) on = !this._s.has(c);
                     if(on) this._s.add(c); else this._s.delete(c); return on; }
    },
    addEventListener(ev, fn){ (handlers[ev] = handlers[ev] || []).push(fn); },
    focus(){},
    /* o <video> da demonstracao do exercicio */
    src: "", removeAttribute(){}, load(){}, play(){ return Promise.resolve(); },
    click(){ (handlers.click || []).forEach(f => f()); },
    press(key){ (handlers.keydown || []).forEach(f => f({ key })); }
  };
}

export const els = {};

/* localStorage de mentira, em memória */
function memStorage(){
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
    get size(){ return m.size; }
  };
}
export const storage = () => globalThis.window.localStorage;

/* relógio: performance.now() e Date.now() andam juntos, e só quando o teste manda */
export const clock = {
  ms: 0,
  advance(d){ this.ms += d; },
  reset(){ this.ms = 0; }
};

/* tudo que o app agendou com setInterval */
let intervals = [];
export function tickAll(){ intervals.forEach(f => f()); }

/* bipes emitidos, para conferir a contagem final */
export const beeps = [];

export function instalarStubs(){
  intervals = [];
  beeps.length = 0;
  for(const k of Object.keys(els)) delete els[k];

  globalThis.document = {
    getElementById(id){ return els[id] = els[id] || mkEl(id); },
    querySelectorAll(){ return picks; }
  };
  globalThis.window = {
    addEventListener(){},
    scrollTo(){},
    localStorage: memStorage(),
    AudioContext: function(){
      return {
        state: "running", currentTime: 0, resume(){},
        destination: {},
        createOscillator(){ return { frequency:{}, connect(){}, start(){}, stop(){} }; },
        createGain(){
          return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} },
                   connect(){} };
        }
      };
    }
  };
  /* `navigator` e `performance` são getters no Node — defineProperty é o único
     jeito de substituí-los */
  const forcar = (nome, valor) =>
    Object.defineProperty(globalThis, nome, { value: valor, configurable: true, writable: true });

  forcar("navigator", { vibrate(){} });      // sem wakeLock, sem serviceWorker
  forcar("performance", { now: () => clock.ms });
  globalThis.Date.now = () => 1700000000000 + clock.ms;
  globalThis.setInterval = fn => { intervals.push(fn); return intervals.length; };
  globalThis.clearInterval = () => { intervals = []; };
  globalThis.setTimeout = () => 0;          // o focus diferido não importa aqui
  globalThis.confirm = () => true;
  globalThis.fetch = () => Promise.reject(new Error("teste não usa rede"));
}

/* os botões da tela de escolha, criados por renderPick via innerHTML.
   Como não há parser de HTML, o teste registra os cliques por aqui. */
export let picks = [];
export function setPicks(p){ picks = p; }
