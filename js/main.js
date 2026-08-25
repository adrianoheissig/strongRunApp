/* Ponto de entrada. É o único arquivo com efeito colateral no carregamento:
   todos os outros só exportam. */

import { carregarTreinos } from "./workouts.js";
import { renderPick, erroDeCarga } from "./render.js";
import { startWorkout } from "./session.js";
import { bindEvents } from "./events.js";

bindEvents();

carregarTreinos()
  .then(() => renderPick(startWorkout))
  .catch(erroDeCarga);

if("serviceWorker" in navigator)
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
