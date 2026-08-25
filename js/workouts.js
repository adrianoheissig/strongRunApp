/* Carga do workouts.json.

   ⚠️ É lido por fetch(), então o app NÃO funciona por file:// — abrir o
   index.html com dois cliques deixa a tela inicial vazia. Precisa de servidor
   HTTP (`python3 -m http.server`, ou o próprio GitHub Pages). */

import { S } from "./state.js";

export function carregarTreinos(){
  return fetch("workouts.json")
    .then(r => {
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(d => {
      if(!d || !Array.isArray(d.treinos) || !d.treinos.length)
        throw new Error("workouts.json sem a lista `treinos`");
      S.TREINOS = d.treinos;
      return S.TREINOS;
    });
}
