/* Formatação de tempo. Segundos -> MM:SS, sempre com dois dígitos. */

export function fmt(s){
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" +
         String(s % 60).padStart(2, "0");
}
