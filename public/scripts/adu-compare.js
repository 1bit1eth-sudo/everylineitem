function money(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return n < 0 ? "−" + formatted : formatted;
}

function moneyDiff(n) {
  if (n === 0) return "$0";
  const abs = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return n > 0 ? "+" + abs : "−" + abs;
}

function largestPhase(s, phases) {
  let best = { label: (phases[0] && phases[0].label) || "—", amount: 0 };
  for (const p of phases) {
    const amount = s.phases[p.id] || 0;
    if (amount > best.amount) best = { label: p.label, amount: amount };
  }
  for (const e of s.extraPhases || []) {
    if (e.amount > best.amount) best = { label: e.label, amount: e.amount };
  }
  return best;
}

function initCompare() {
  const dataEl = document.getElementById("adu-compare-data");
  const root = document.getElementById("adu-compare");
  if (!dataEl || !root) return;
  if (root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  let payload;
  try {
    payload = JSON.parse(dataEl.textContent || "{}");
  } catch (e) {
    return;
  }

  const byId = new Map(payload.scenarios.map(function (s) {
    return [s.id, s];
  }));
  const selectA = document.getElementById("compare-a");
  const selectB = document.getElementById("compare-b");
  if (!selectA || !selectB) return;

  function render() {
    const a = byId.get(selectA.value);
    const b = byId.get(selectB.value);
    if (!a || !b) return;

    const colA = document.getElementById("col-a-label");
    const colB = document.getElementById("col-b-label");
    if (colA) colA.textContent = a.shortLabel;
    if (colB) colB.textContent = b.shortLabel;

    const tbody = document.getElementById("compare-tbody");
    const tfoot = document.getElementById("compare-tfoot");
    if (!tbody || !tfoot) return;

    const rows = [];
    for (const phase of payload.phases) {
      const av = a.phases[phase.id] || 0;
      const bv = b.phases[phase.id] || 0;
      const diff = bv - av;
      const diffClass =
        diff > 0
          ? "text-accent"
          : diff < 0
            ? "text-green-600 dark:text-green-400"
            : "";
      rows.push(
        '<tr class="border-border border-b">' +
          '<td class="py-2 pe-3">' +
          phase.label +
          "</td>" +
          '<td class="py-2 pe-3 tabular-nums">' +
          money(av) +
          "</td>" +
          '<td class="py-2 pe-3 tabular-nums">' +
          money(bv) +
          "</td>" +
          '<td class="py-2 tabular-nums ' +
          diffClass +
          '">' +
          moneyDiff(diff) +
          "</td>" +
          "</tr>"
      );
    }

    const extraIds = new Map();
    for (const e of [].concat(a.extraPhases || [], b.extraPhases || [])) {
      if (!extraIds.has(e.id)) extraIds.set(e.id, e.label);
    }
    extraIds.forEach(function (label, id) {
      const aExtra = (a.extraPhases || []).find(function (e) {
        return e.id === id;
      });
      const bExtra = (b.extraPhases || []).find(function (e) {
        return e.id === id;
      });
      const av = aExtra ? aExtra.amount : null;
      const bv = bExtra ? bExtra.amount : null;
      const diff = av == null && bv == null ? 0 : (bv || 0) - (av || 0);
      const diffClass =
        av == null || bv == null
          ? "text-foreground/70"
          : diff > 0
            ? "text-accent"
            : diff < 0
              ? "text-green-600 dark:text-green-400"
              : "";
      rows.push(
        '<tr class="border-border border-b bg-muted/20">' +
          '<td class="py-2 pe-3">' +
          label +
          ' <span class="text-foreground/60 text-xs">(extra)</span></td>' +
          '<td class="py-2 pe-3 tabular-nums">' +
          (av == null ? "—" : money(av)) +
          "</td>" +
          '<td class="py-2 pe-3 tabular-nums">' +
          (bv == null ? "—" : money(bv)) +
          "</td>" +
          '<td class="py-2 tabular-nums ' +
          diffClass +
          '">' +
          (av == null || bv == null ? "—" : moneyDiff(diff)) +
          "</td>" +
          "</tr>"
      );
    });

    tbody.innerHTML = rows.join("");

    const totalDiff = b.total - a.total;
    const psfDiff = b.costPerSqFt - a.costPerSqFt;
    const totalDiffClass =
      totalDiff > 0
        ? "text-accent"
        : totalDiff < 0
          ? "text-green-600 dark:text-green-400"
          : "";
    const psfText =
      psfDiff === 0
        ? "$0"
        : (psfDiff > 0 ? "+" : "−") +
          "$" +
          Math.abs(psfDiff).toLocaleString("en-US");

    tfoot.innerHTML =
      '<tr class="border-border border-t-2 font-semibold">' +
      '<td class="py-3 pe-3">Total</td>' +
      '<td class="py-3 pe-3 tabular-nums">' +
      money(a.total) +
      "</td>" +
      '<td class="py-3 pe-3 tabular-nums">' +
      money(b.total) +
      "</td>" +
      '<td class="py-3 tabular-nums ' +
      totalDiffClass +
      '">' +
      moneyDiff(totalDiff) +
      "</td>" +
      "</tr>" +
      '<tr class="text-foreground/90">' +
      '<td class="py-2 pe-3">$/sq ft</td>' +
      '<td class="py-2 pe-3 tabular-nums">$' +
      a.costPerSqFt.toLocaleString("en-US") +
      "</td>" +
      '<td class="py-2 pe-3 tabular-nums">$' +
      b.costPerSqFt.toLocaleString("en-US") +
      "</td>" +
      '<td class="py-2 tabular-nums">' +
      psfText +
      "</td>" +
      "</tr>";

    const la = largestPhase(a, payload.phases);
    const lb = largestPhase(b, payload.phases);
    const summary = document.getElementById("compare-summary");
    if (summary) {
      summary.innerHTML =
        '<div class="border-border rounded-md border p-4">' +
        '<div class="text-foreground/70 text-xs tracking-wide uppercase">Build A · ' +
        a.shortLabel +
        "</div>" +
        '<div class="mt-1 text-2xl font-semibold tabular-nums">' +
        money(a.total) +
        "</div>" +
        '<div class="mt-1 text-sm">$' +
        a.costPerSqFt.toLocaleString("en-US") +
        "/sq ft · " +
        a.sqFt.toLocaleString("en-US") +
        " sq ft</div>" +
        '<div class="text-foreground/80 mt-2 text-sm">Largest phase: ' +
        la.label +
        " (" +
        money(la.amount) +
        ")</div>" +
        "</div>" +
        '<div class="border-border rounded-md border p-4">' +
        '<div class="text-foreground/70 text-xs tracking-wide uppercase">Build B · ' +
        b.shortLabel +
        "</div>" +
        '<div class="mt-1 text-2xl font-semibold tabular-nums">' +
        money(b.total) +
        "</div>" +
        '<div class="mt-1 text-sm">$' +
        b.costPerSqFt.toLocaleString("en-US") +
        "/sq ft · " +
        b.sqFt.toLocaleString("en-US") +
        " sq ft</div>" +
        '<div class="text-foreground/80 mt-2 text-sm">Largest phase: ' +
        lb.label +
        " (" +
        money(lb.amount) +
        ")</div>" +
        "</div>" +
        '<div class="border-border border-accent/40 rounded-md border p-4 sm:col-span-2 lg:col-span-1">' +
        '<div class="text-foreground/70 text-xs tracking-wide uppercase">Difference (B − A)</div>' +
        '<div class="mt-1 text-2xl font-semibold tabular-nums ' +
        totalDiffClass +
        '">' +
        moneyDiff(totalDiff) +
        "</div>" +
        '<div class="mt-1 text-sm">' +
        psfText +
        "/sq ft</div>" +
        "</div>";
    }

    const notes = document.getElementById("compare-notes");
    if (notes) {
      const bits = [a.note, b.note].filter(Boolean);
      notes.textContent = bits.length ? bits.join(" ") : "";
    }

    const links = document.getElementById("compare-links");
    if (links) {
      links.innerHTML =
        '<a class="text-accent underline decoration-dashed underline-offset-4" href="' +
        a.href +
        '">Full post: ' +
        a.shortLabel +
        " →</a>" +
        '<a class="text-accent underline decoration-dashed underline-offset-4" href="' +
        b.href +
        '">Full post: ' +
        b.shortLabel +
        " →</a>";
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("a", a.id);
      url.searchParams.set("b", b.id);
      history.replaceState({}, "", url);
    } catch (e) {
      /* ignore */
    }
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const qa = params.get("a");
    const qb = params.get("b");
    if (qa && byId.has(qa)) selectA.value = qa;
    if (qb && byId.has(qb)) selectB.value = qb;
  } catch (e) {
    /* ignore */
  }

  selectA.addEventListener("change", render);
  selectB.addEventListener("change", render);
  render();
}

document.addEventListener("astro:page-load", initCompare);
if (document.readyState !== "loading") {
  initCompare();
}
