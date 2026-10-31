/* Jurisdiction combobox — progressive enhancement for jurisdiction <select>s.
 *
 * Any <select data-combobox> on the page becomes a searchable combobox:
 * type to filter 161 jurisdictions by name, arrow keys + Enter to pick,
 * Escape / outside click to close. The native <select> stays in the DOM
 * (hidden) as the source of truth: picking an option sets its value and
 * dispatches a change event, so the existing calculator scripts run
 * untouched. Without JavaScript nothing changes — the native select is
 * the fallback.
 *
 * Recently viewed jurisdictions (localStorage only, never sent anywhere)
 * appear as a group at the top of the dropdown when the input is empty.
 * Site strings are English: everylineitem.com is an English-only site.
 */
(function () {
  "use strict";

  var RECENT_KEY = "eli-recent-juris";
  var RECENT_MAX = 4;

  function readRecents() {
    try {
      var raw = window.localStorage.getItem(RECENT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (v) { return typeof v === "string"; }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecent(value) {
    try {
      var arr = readRecents().filter(function (v) { return v !== value; });
      arr.unshift(value);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX)));
    } catch (e) {
      /* private mode etc. — recents are a convenience, not required */
    }
  }

  function labelText(select) {
    var label = select.closest("label");
    if (label) {
      var span = label.querySelector("span");
      if (span && span.textContent) return span.textContent.trim();
    }
    return select.getAttribute("aria-label") || "Jurisdiction";
  }

  function enhance(select, index) {
    if (select.dataset.comboboxDone) return;
    select.dataset.comboboxDone = "1";

    var options = [];
    Array.prototype.forEach.call(select.options, function (opt) {
      var region = "";
      var parent = opt.parentElement;
      if (parent && parent.tagName === "OPTGROUP") region = parent.label || "";
      options.push({ value: opt.value, name: opt.textContent.trim(), region: region });
    });
    if (options.length === 0) return;
    var byValue = {};
    options.forEach(function (o) { byValue[o.value] = o; });

    var wrap = document.createElement("div");
    wrap.className = "jscb-wrap";
    var input = document.createElement("input");
    input.type = "text";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-label", labelText(select));
    input.placeholder = "Type to search cities…";
    input.className = select.className;
    var listId = "jscb-list-" + index;
    input.setAttribute("aria-controls", listId);
    var list = document.createElement("div");
    list.id = listId;
    list.className = "jscb-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(input);
    wrap.appendChild(list);
    wrap.appendChild(select);
    select.hidden = true;

    var activeEl = null;
    var open = false;

    function currentName() {
      var cur = byValue[select.value];
      return cur ? cur.name : "";
    }

    function setActive(el) {
      if (activeEl) {
        activeEl.classList.remove("active");
        activeEl.setAttribute("aria-selected", "false");
      }
      activeEl = el || null;
      if (activeEl) {
        activeEl.classList.add("active");
        activeEl.setAttribute("aria-selected", "true");
        input.setAttribute("aria-activedescendant", activeEl.id);
        if (typeof activeEl.scrollIntoView === "function") {
          activeEl.scrollIntoView({ block: "nearest" });
        }
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function makeOption(o, id) {
      var el = document.createElement("div");
      el.className = "jscb-opt";
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", "false");
      el.id = id;
      el.dataset.value = o.value;
      var nameSpan = document.createElement("span");
      nameSpan.textContent = o.name;
      el.appendChild(nameSpan);
      if (o.region) {
        var regionSpan = document.createElement("span");
        regionSpan.className = "jscb-region";
        regionSpan.textContent = o.region;
        el.appendChild(regionSpan);
      }
      el.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        pick(o.value);
      });
      return el;
    }

    function groupHeader(text) {
      var el = document.createElement("div");
      el.className = "jscb-group";
      el.setAttribute("role", "presentation");
      el.textContent = text;
      return el;
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      list.innerHTML = "";
      setActive(null);
      var rows = [];
      if (!q) {
        var recents = readRecents()
          .map(function (v) { return byValue[v]; })
          .filter(Boolean);
        if (recents.length > 0) {
          list.appendChild(groupHeader("Recently viewed"));
          recents.forEach(function (o, i) {
            var el = makeOption(o, listId + "-r" + i);
            list.appendChild(el);
            rows.push(el);
          });
        }
        var lastRegion = null;
        options.forEach(function (o, i) {
          if (o.region !== lastRegion) {
            list.appendChild(groupHeader(o.region || "All jurisdictions"));
            lastRegion = o.region;
          }
          var el = makeOption(o, listId + "-o" + i);
          list.appendChild(el);
          rows.push(el);
        });
      } else {
        var matches = options.filter(function (o) {
          return o.name.toLowerCase().indexOf(q) !== -1;
        });
        if (matches.length === 0) {
          var empty = document.createElement("div");
          empty.className = "jscb-empty";
          empty.textContent = "No matching cities.";
          list.appendChild(empty);
        } else {
          matches.forEach(function (o, i) {
            var el = makeOption(o, listId + "-m" + i);
            list.appendChild(el);
            rows.push(el);
          });
        }
      }
      list._rows = rows;
    }

    function openList() {
      if (!open) {
        render();
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
        open = true;
      }
    }

    function closeList() {
      if (open) {
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
        setActive(null);
        open = false;
      }
    }

    function pick(value) {
      if (!byValue[value]) return;
      select.value = value;
      input.value = byValue[value].name;
      saveRecent(value);
      closeList();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function move(dir) {
      var rows = list._rows || [];
      if (rows.length === 0) return;
      var idx = activeEl ? rows.indexOf(activeEl) : -1;
      var next = dir > 0 ? (idx + 1) % rows.length : (idx - 1 + rows.length) % rows.length;
      setActive(rows[next]);
    }

    input.addEventListener("focus", function () {
      // Clear for searching: the full list (recents first) shows, and
      // blur without a pick restores the current selection's name.
      // Other scripts (e.g. share-URL prefill) may set the select's
      // value without a change event, so the select is the truth here.
      input.value = "";
      openList();
    });
    input.addEventListener("input", function () {
      openList();
      render();
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        openList();
        move(1);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        openList();
        move(-1);
      } else if (ev.key === "Enter") {
        if (open && activeEl) {
          ev.preventDefault();
          pick(activeEl.dataset.value);
        }
      } else if (ev.key === "Escape") {
        closeList();
        input.value = currentName();
      }
    });
    input.addEventListener("blur", function () {
      // Blur fires before a click lands; mousedown on options already
      // handles picking, so a plain blur just closes and restores text.
      window.setTimeout(function () {
        if (document.activeElement !== input) {
          closeList();
          input.value = currentName();
        }
      }, 0);
    });
    document.addEventListener("click", function (ev) {
      if (!wrap.contains(ev.target)) closeList();
    });
    select.addEventListener("change", function () {
      input.value = currentName();
    });

    input.value = currentName();
  }

  var selects = document.querySelectorAll("select[data-combobox]");
  Array.prototype.forEach.call(selects, function (sel, i) {
    try {
      enhance(sel, i);
    } catch (e) {
      /* one broken select must not break the others */
      if (typeof console !== "undefined") console.error("[juris-combobox]", e);
    }
  });
})();
