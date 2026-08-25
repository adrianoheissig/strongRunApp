/* Ponto de entrada. É o único arquivo com efeito colateral no carregamento:
   todos os outros só exportam. */

import { carregarTreinos } from "./workouts.js";
import { renderPick, erroDeCarga } from "./render.js";
import { startWorkout } from "./session.js";
import { bindEvents, oferecerSessao } from "./events.js";
import { lerSalva } from "./storage.js";

bindEvents();

carregarTreinos()
  .then(() => {
    renderPick(startWorkout);
    /* depois dos treinos: a sessão salva só vale se o treino dela ainda existir */
    oferecerSessao(lerSalva());
  })
  .catch(erroDeCarga);

if("serviceWorker" in navigator)
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
