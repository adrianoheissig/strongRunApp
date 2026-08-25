/* Acesso ao DOM. Tudo que toca em elemento passa por aqui. */

export const $ = id => document.getElementById(id);

export const mostrar  = id => $(id).classList.remove("hide");
export const esconder = id => $(id).classList.add("hide");

export const texto = (id, t) => { $(id).textContent = t; };
export const html  = (id, h) => { $(id).innerHTML = h; };

/* Escapa texto que vem do workouts.json antes de virar HTML. O arquivo é do
   próprio dono do app, mas nome de exercício com & ou < quebraria a marcação. */
export const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
