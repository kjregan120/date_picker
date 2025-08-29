(function () {
  // ---------- helpers ----------
  const pad = n => String(n).padStart(2, "0");
  const toIsoUTC = d => {
    if (!(d instanceof Date) || isNaN(d)) return null;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000`;
  };
  const secToDate = sec => (isFinite(sec) ? new Date(Number(sec) * 1000) : null);

  // Parse "MM/dd/yyyy" -> Date in local time, then convert to UTC ISO for consistency
  function parseMmDdYyyy(s) {
    const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [_, mm, dd, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm)-1, Number(dd), 0, 0, 0, 0);
    return isNaN(d) ? null : d;
  }

  // Try to read attribute seconds -> Date
  function readFromAttributes(picker) {
    const fromAttr = picker.getAttribute("date-from");
    const toAttr   = picker.getAttribute("date-to");
    const from = fromAttr ? secToDate(Number(fromAttr)) : null;
    const to   = toAttr   ? secToDate(Number(toAttr))   : null;
    return { from, to, source: "attributes" };
  }

  // Try common property names used by range date pickers
  function readFromProperties(picker) {
    const candidates = [
      ["dateFrom", "dateTo"],            // camelCase reflection
      ["from", "to"],                    // simple
      ["start", "end"],                  // alternate
      ["startDate", "endDate"],          // verbose
      ["valueFrom", "valueTo"],          // value*
      ["selectedFrom", "selectedTo"],    // selected*
    ];
    for (const [pf, pt] of candidates) {
      const f = picker[pf];
      const t = picker[pt];
      // If they are seconds
      if (typeof f === "number" && typeof t === "number") {
        return { from: secToDate(f), to: secToDate(t), source: `props(${pf}/${pt}:sec)` };
      }
      // If they are Dates
      if (f instanceof Date && t instanceof Date) {
        return { from: f, to: t, source: `props(${pf}/${pt}:Date)` };
      }
      // If they are strings in MM/dd/yyyy
      if (typeof f === "string" && typeof t === "string") {
        const from = parseMmDdYyyy(f);
        const to   = parseMmDdYyyy(t);
        if (from || to) return { from, to, source: `props(${pf}/${pt}:str)` };
      }
      // If there’s a tuple/array
      if (Array.isArray(picker.selectedDates) && picker.selectedDates.length >= 2) {
        const [sf, st] = picker.selectedDates;
        const from = sf instanceof Date ? sf : (typeof sf === "number" ? secToDate(sf) : parseMmDdYyyy(sf));
        const to   = st instanceof Date ? st : (typeof st === "number" ? secToDate(st) : parseMmDdYyyy(st));
        if (from || to) return { from, to, source: "props(selectedDates)" };
      }
    }
    return { from: null, to: null, source: null };
  }

  // Shadow DOM fallback: look for inputs/hidden fields
  function readFromShadow(picker) {
    if (!picker.shadowRoot) return { from: null, to: null, source: null };
    const sr = picker.shadowRoot;

    // Common patterns: placeholders "Check In/Out", aria-labels, or hidden inputs
    const fromInput = sr.querySelector('input[placeholder*="Check In" i], input[aria-label*="Check In" i], input[name*="from" i], input[id*="from" i]');
    const toInput   = sr.querySelector('input[placeholder*="Check Out" i], input[aria-label*="Check Out" i], input[name*="to" i], input[id*="to" i]');
    const fromHidden = sr.querySelector('input[type="hidden"][name*="from" i]');
    const toHidden   = sr.querySelector('input[type="hidden"][name*="to" i]');

    // Try hidden first (often canonical)
    let from = null, to = null;
    if (fromHidden?.value && /^\d+$/.test(fromHidden.value)) from = secToDate(Number(fromHidden.value));
    if (toHidden?.value   && /^\d+$/.test(toHidden.value))   to   = secToDate(Number(toHidden.value));

    // Try visible text inputs as MM/dd/yyyy
    if (!from && fromInput?.value) from = parseMmDdYyyy(fromInput.value);
    if (!to && toInput?.value)     to   = parseMmDdYyyy(toInput.value);

    return { from, to, source: "shadow" };
  }

  function getResortSlugFromLocation() {
    const m = location.pathname.match(/\/resorts\/([^/]+)\/rates-rooms/);
    return m ? m[1] : null;
  }

  function findPicker() {
    // Don’t assume an id; some pages differ.
    return document.querySelector("wdpr-range-datepicker") ||
           document.querySelector("wdpr-range-datepicker#rangeDatePicker");
  }

  function readDates() {
    const picker = findPicker();
    if (!picker) return { from: null, to: null, source: "none" };

    // 1) attributes
    let res = readFromAttributes(picker);
    // 2) properties
    if (!res.from && !res.to) res = readFromProperties(picker);
    // 3) shadow DOM
    if (!res.from && !res.to) res = readFromShadow(picker);

    return res;
  }

  function logAll() {
    const resort = getResortSlugFromLocation();
    const { from, to, source } = readDates();

    console.log("[Disney Grabber] resort:", resort);
    console.log("[Disney Grabber] source:", source);
    console.log("[Disney Grabber] check-in:", toIsoUTC(from));
    console.log("[Disney Grabber] check-out:", toIsoUTC(to));
  }

  // ---------- wire-up ----------
  // Initial
  logAll();

  // Observe host element attribute changes (if/when it reflects)
  const attachAttrObserver = () => {
    const picker = findPicker();
    if (!picker) return;
    const mo = new MutationObserver(logAll);
    mo.observe(picker, { attributes: true });
  };

  // Observe the whole doc for SPA updates / shadow input changes
  const rootObserver = new MutationObserver((muts) => {
    // re-log on any subtree changes near the picker; cheap and robust
    const touchedPicker = muts.some(m =>
      (m.target?.closest && m.target.closest("wdpr-range-datepicker")) || 
      (Array.from(m.addedNodes || []).some(n => n.nodeType === 1 && n.matches?.("wdpr-range-datepicker")))
    );
    if (touchedPicker) logAll();
  });
  rootObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true });

  attachAttrObserver();

  // Also listen to input changes within the picker shadow (if open)
  function attachShadowListeners() {
    const picker = findPicker();
    if (!picker?.shadowRoot) return;
    picker.shadowRoot.addEventListener("input", logAll, true);
    picker.shadowRoot.addEventListener("change", logAll, true);
  }
  attachShadowListeners();
  setTimeout(() => { attachAttrObserver(); attachShadowListeners(); logAll(); }, 1500); // CSR buffer
})();
