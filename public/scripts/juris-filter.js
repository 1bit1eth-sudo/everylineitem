/* Progressive-enhancement filter for long jurisdiction <select>s.
 * Markup contract: an <input type="search" data-juris-filter="SELECT_ID">
 * placed just above the select. Typing narrows the options (case-insensitive
 * substring on the visible label); clearing restores the full list and the
 * previous selection. Works with flat options and <optgroup>s. Without
 * JavaScript the select keeps working exactly as before.
 * Safe to load on any page: inputs already wired are skipped. */
(function () {
  function snapshot(select) {
    var groups = [];
    Array.prototype.forEach.call(select.childNodes, function (node) {
      if (node.tagName === "OPTGROUP") {
        var opts = [];
        Array.prototype.forEach.call(node.options, function (o) {
          opts.push({
            value: o.value,
            text: o.text,
            disabled: o.disabled,
          });
        });
        groups.push({ label: node.label, options: opts });
      } else if (node.tagName === "OPTION") {
        groups.push({
          label: null,
          options: [
            {
              value: node.value,
              text: node.text,
              disabled: node.disabled,
            },
          ],
        });
      }
    });
    return groups;
  }

  function init(input) {
    var selectId = input.getAttribute("data-juris-filter");
    var select = selectId ? document.getElementById(selectId) : null;
    if (!select || input.dataset.jurisFilterInit) return;
    input.dataset.jurisFilterInit = "1";

    var original = snapshot(select);
    var lastSelected = select.value;

    select.addEventListener("change", function () {
      lastSelected = select.value;
    });

    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var prevValue = select.value;
      while (select.firstChild) select.removeChild(select.firstChild);
      var any = false;

      original.forEach(function (grp) {
        var matches = grp.options.filter(function (o) {
          return (
            o.disabled || q === "" || o.text.toLowerCase().indexOf(q) !== -1
          );
        });
        if (!matches.length) return;
        any = true;
        var parent = select;
        if (grp.label !== null) {
          var og = document.createElement("optgroup");
          og.label = grp.label;
          select.appendChild(og);
          parent = og;
        }
        matches.forEach(function (o) {
          var opt = document.createElement("option");
          opt.value = o.value;
          opt.text = o.text;
          opt.disabled = o.disabled;
          parent.appendChild(opt);
        });
      });

      if (!any) {
        var empty = document.createElement("option");
        empty.disabled = true;
        empty.text =
          "No jurisdiction matches '" + input.value.trim() + "'";
        select.appendChild(empty);
      }

      // Restore the selection: keep the current value when it is still
      // visible; on clear, fall back to the last user-picked value; else
      // take the first available choice.
      var next = null;
      Array.prototype.forEach.call(select.options, function (o) {
        if (!o.disabled && o.value === prevValue) next = o.value;
      });
      if (next === null && q === "" && lastSelected) {
        Array.prototype.forEach.call(select.options, function (o) {
          if (!o.disabled && o.value === lastSelected) next = o.value;
        });
      }
      if (next === null) {
        Array.prototype.forEach.call(select.options, function (o) {
          if (!o.disabled && next === null) next = o.value;
        });
      }
      if (next !== null) select.value = next;
      if (select.value !== prevValue) {
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function boot() {
    var inputs = document.querySelectorAll("input[data-juris-filter]");
    Array.prototype.forEach.call(inputs, init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("astro:after-swap", boot);
})();
