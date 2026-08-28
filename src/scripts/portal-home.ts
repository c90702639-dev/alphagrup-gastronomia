// Portal dashboard client-side behaviors

/* KPI: merge AI usage from localStorage */
const iaNum = document.getElementById("kpi-ia-num");
try {
  const stats = JSON.parse(localStorage.getItem("ga_ai_usage_v1") || "[]");
  if (iaNum) iaNum.textContent = String(stats.length);
} catch {}

/* AI connection test */
const btn = document.getElementById("btn-test-ai");
const result = document.getElementById("ai-test-result");
btn?.addEventListener("click", async () => {
  const b = btn as HTMLButtonElement;
  b.disabled = true;
  const original = b.textContent;
  b.textContent = "Probando…";
  result?.removeAttribute("hidden");
  try {
    const res = await fetch("/api/portal/ai-test", { method: "POST" });
    const j = await res.json();
    (result as HTMLElement).textContent = j.ok
      ? `✓ Conectado en ${(j.ms / 1000).toFixed(1)}s
Modelo: ${j.model}
Key usada: #${j.keyIndex + 1}
Respuesta: ${j.reply}`
      : `✗ ${j.error}`;
    const dot = document.getElementById("ai-dot");
    const txt = document.getElementById("ai-text");
    if (dot && txt) {
      dot.className = j.ok ? "text-exito" : "text-alerta";
      txt.textContent = j.ok ? `${j.model.split("/")[1]} respondió` : j.error.slice(0, 60);
    }
  } catch (e) {
    (result as HTMLElement).textContent = `✗ ${(e as Error).message}`;
  } finally {
    b.disabled = false;
    b.textContent = original;
  }
});

/* Purge demo data */
document.getElementById("btn-purge-demo")?.addEventListener("click", async () => {
  if (!confirm("¿Eliminar leads, cotizaciones y actividad de demostración?")) return;
  const res = await fetch("/api/portal/demo", { method: "POST" });
  if (res.ok) location.reload();
});
