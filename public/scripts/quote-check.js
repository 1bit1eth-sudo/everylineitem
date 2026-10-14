/* "Check my quotes" on /compare/. Runs entirely in the browser:
   nothing typed here is stored or sent anywhere. */
(function () {
  var STAGE_QUESTIONS = {
    soft: "Are design, engineering, plan check, and city/utility fees in this price, or will I pay them directly?",
    site: "Does site work include the sewer lateral, utility trenching, and foundation? What happens if soil or access turns out worse than expected?",
    framing: "Is the lumber package priced at today's rates, or can it change before framing starts?",
    envelope: "Which roofing, windows, exterior doors, and siding are specified?",
    systems: "Does this cover electrical (including any panel or service upgrade), plumbing, HVAC, and kitchen and bath finishes? At what grade?",
    landscape: "Are paths, finish grading, planting, and any required parking replacement included?",
    crane: "Are crane, transport, and staging included, and who arranges the street or crane permits?",
  };
  var FAR_PCT = 30; // flag a stage more than this % above/below the benchmark

  function usd(n) {
    var s = Math.abs(n).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    return n < 0 ? "−" + s : s;
  }
  function diffText(n) {
    if (n === 0) return "$0";
    return (n > 0 ? "+" : "−") + usd(Math.abs(n));
  }
  function parseAmount(v) {
    var cleaned = String(v || "").replace(/[^0-9.kK]/g, "");
    if (!cleaned) return null;
    var mult = /k$/i.test(cleaned) ? 1000 : 1;
    var n = parseFloat(cleaned.replace(/k$/i, ""));
    return Number.isFinite(n) ? Math.round(n * mult) : null;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(href, text) {
    var a = el("a", "text-accent underline decoration-dashed underline-offset-4", text);
    a.href = href;
    return a;
  }

  function init() {
    var root = document.getElementById("quote-check");
    var dataEl = document.getElementById("adu-compare-data");
    if (!root || !dataEl || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    var payload;
    try {
      payload = JSON.parse(dataEl.textContent || "{}");
    } catch (e) {
      return;
    }
    var byId = new Map(payload.scenarios.map(function (s) { return [s.id, s]; }));
    var select = document.getElementById("qc-benchmark");
    var tbody = document.getElementById("qc-tbody");
    var results = document.getElementById("qc-results");
    var source = document.getElementById("qc-source");
    if (!select || !tbody || !results) return;
    var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr[data-stage]"));

    function benchFor(sc, row) {
      var id = row.dataset.stage;
      if (row.dataset.extra) {
        var x = (sc.extraPhases || []).find(function (e) { return e.id === id; });
        return x ? x.amount : null;
      }
      return sc.phases[id] || 0;
    }
    function labelOf(row) {
      return row.cells[0].textContent.trim();
    }
    function field(row, q, f) {
      return row.querySelector('[data-q="' + q + '"][data-field="' + f + '"]');
    }

    function renderSource(sc) {
      if (!source) return;
      source.textContent = "";
      source.append("Benchmark: ", link(sc.href, sc.shortLabel),
        ", modeled median, checked " + sc.lastVerified + ". Built from ");
      (payload.sources || []).forEach(function (s, i, arr) {
        var a = link(s.href, s.label);
        a.rel = "noopener";
        source.append(a, i < arr.length - 1 ? ", " : "");
      });
      source.append(". Not a quote. See ", link("/methodology/", "Methodology"), ".");
    }

    function render() {
      var sc = byId.get(select.value);
      if (!sc) return;
      renderSource(sc);

      var totals = { a: 0, b: 0 };
      var entered = { a: false, b: false };
      var flags = [];
      var questions = [];
      var asked = {};
      function ask(key, text) {
        if (asked[key]) return;
        asked[key] = true;
        questions.push(text);
      }
      var gaps = [];

      rows.forEach(function (row) {
        var bench = benchFor(sc, row);
        var active = bench != null;
        row.classList.toggle("hidden", !active);
        var benchCell = row.querySelector("[data-bench]");
        if (benchCell) benchCell.textContent = active ? usd(bench) : "—";
        if (!active) return;
        var label = labelOf(row);
        var id = row.dataset.stage;
        var amounts = {};

        ["a", "b"].forEach(function (q) {
          var input = field(row, q, "amount");
          var status = field(row, q, "status");
          var out = field(row, q, "diff");
          var amt = parseAmount(input.value);
          var st = status.value;
          var Q = "Quote " + q.toUpperCase();
          out.textContent = "";
          out.className = "text-xs tabular-nums";

          if (st === "excluded" || st === "notlisted") {
            if (rowsTouched(q)) {
              flags.push(Q + ": " + label + " is " +
                (st === "excluded" ? "excluded" : "not listed") +
                " (benchmark " + usd(bench) + ").");
              ask(id + "-missing-" + q, Q + ": " + label + " is " +
                (st === "excluded" ? "excluded" : "missing") +
                ". Who pays for it, and what should I budget? " + (STAGE_QUESTIONS[id] || ""));
              out.textContent = st === "excluded" ? "Excluded" : "Missing";
              out.className += " text-accent";
            }
            return;
          }
          if (amt == null) return;
          entered[q] = true;
          totals[q] += amt;
          amounts[q] = amt;
          var d = amt - bench;
          var pct = bench ? Math.round((d / bench) * 100) : 0;
          out.textContent = diffText(d) + " vs benchmark" + (bench ? " (" + (pct > 0 ? "+" : "") + pct + "%)" : "");
          if (Math.abs(pct) > FAR_PCT) out.className += " text-accent";

          if (st === "allowance") {
            flags.push(Q + ": " + label + " is an allowance (" + usd(amt) + "). The final cost can move.");
            ask(id + "-allow-" + q, Q + ": the " + label + " allowance is " + usd(amt) +
              ". What exactly does it cover, and how are overages billed?");
          }
          if (pct < -FAR_PCT) {
            flags.push(Q + ": " + label + " is " + Math.abs(pct) + "% below the benchmark.");
            ask(id + "-low-" + q, Q + ": " + label + " is well below the benchmark. What scope is left out? " + (STAGE_QUESTIONS[id] || ""));
          } else if (pct > FAR_PCT) {
            flags.push(Q + ": " + label + " is " + pct + "% above the benchmark.");
            ask(id + "-high-" + q, Q + ": " + label + " is well above the benchmark. What drives it: site conditions, finishes, or access?");
          }
        });
        if (amounts.a != null && amounts.b != null) {
          gaps.push({ label: label, id: id, gap: Math.abs(amounts.a - amounts.b) });
        }
      });

      function rowsTouched(q) {
        return rows.some(function (r) {
          return parseAmount(field(r, q, "amount").value) != null ||
            field(r, q, "status").value !== "notlisted";
        });
      }

      ["a", "b"].forEach(function (q) {
        var cell = document.getElementById("qc-total-" + q);
        if (!cell) return;
        cell.textContent = "";
        if (!entered[q]) { cell.textContent = "—"; return; }
        cell.append(usd(totals[q]));
        var d = el("div", "text-xs font-normal", diffText(totals[q] - sc.total) + " vs benchmark");
        cell.append(d);
      });
      var benchTotal = document.getElementById("qc-bench-total");
      if (benchTotal) benchTotal.textContent = usd(sc.total);

      results.textContent = "";
      if (!entered.a && !entered.b && !flags.length) {
        results.append(el("p", "text-foreground/70 text-sm",
          "Enter at least one amount to see flags and questions."));
        return;
      }

      gaps.sort(function (x, y) { return y.gap - x.gap; });
      if (gaps.length && gaps[0].gap > 0) {
        ask("gap", "The quotes differ most on " + gaps[0].label + " (" + usd(gaps[0].gap) +
          "). Ask both contractors to list exactly what that stage includes.");
      }
      ask("contingency", "Is there a contingency line, and how are change orders priced and approved?");
      ask("schedule", "What is the payment schedule, and is each payment tied to a finished stage or inspection?");

      var summary = el("div", "border-border rounded-md border p-4 text-sm");
      summary.append(el("div", "font-semibold", "Against " + sc.shortLabel + " (" + usd(sc.total) + ")"));
      ["a", "b"].forEach(function (q) {
        if (!entered[q]) return;
        summary.append(el("div", "mt-1 tabular-nums",
          "Quote " + q.toUpperCase() + ": " + usd(totals[q]) + " listed, " +
          diffText(totals[q] - sc.total) + " vs benchmark. Excluded and not-listed stages are not counted."));
      });
      results.append(summary);

      if (flags.length) {
        var fh = el("h3", "font-semibold", "Flags");
        var fl = el("ul", "list-disc space-y-1 ps-5 text-sm");
        flags.forEach(function (f) { fl.append(el("li", "", f)); });
        results.append(fh, fl);
      }
      var qh = el("h3", "font-semibold", "Questions to ask the contractor");
      var ql = el("ol", "list-decimal space-y-1 ps-5 text-sm");
      questions.forEach(function (t) { ql.append(el("li", "", t)); });
      results.append(qh, ql);
      results.append(el("p", "text-foreground/70 text-xs",
        "Benchmarks are modeled medians for one defined scenario, not a fair price for your site. A gap is a reason to ask, not proof a quote is wrong."));
    }

    rows.forEach(function (row) {
      ["a", "b"].forEach(function (q) {
        var input = field(row, q, "amount");
        var status = field(row, q, "status");
        input.addEventListener("input", function () {
          if (parseAmount(input.value) != null && status.value === "notlisted") {
            status.value = "included";
          }
          render();
        });
        status.addEventListener("change", render);
      });
    });
    select.addEventListener("change", render);
    render();
  }

  document.addEventListener("astro:page-load", init);
  if (document.readyState !== "loading") init();
})();
