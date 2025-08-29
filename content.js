(() => {
  const IS_TOP = self === top;

  // ------------------- helpers -------------------
  const pad = n => String(n).padStart(2, "0");

  // format as ISO UTC with milliseconds: "YYYY-MM-DDTHH:mm:ss.000Z"
  function toISO(d) {
    return d instanceof Date && !isNaN(d) ? d.toISOString().replace(/\.\d{3}Z$/, ".000Z") : null;
  }

  // turn epoch seconds (as string or number) into ISO
  const secToISO = sec => (sec != null && isFinite(sec)) ? toISO(new Date(Number(sec) * 1000)) : null;

  function parseMMDDYYYY(s) {
    const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [, mm, dd, yyyy] = m.map(Number);
    const d = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
    return isNaN(d) ? null : d;
  }

  function resortSlugFromTopPath() {
    // Only safe in top frame
    const m = location.pathname.match(/\/resorts\/([^/]+)\/rates-rooms/);
    return m ? m[1] : null;
  }

  // ------------------- date extraction -------------------
  function extractFromAttributes(el) {
    const fromAttr = el.getAttribute("date-from");
    const toAttr   = el.getAttribute("date-to");
    const fromISO  = secToISO(fromAttr);
    const toISO    = secToISO(toAttr);
    if (fromISO || toISO) return { source: "attributes", checkInISO: fromISO, checkOutISO: toISO };
    return null;
  }

  function extractFromProperties(el) {
    const cands = [
      ["dateFrom","dateTo"], ["from","to"], ["start","end"],
      ["startDate","endDate"], ["valueFrom","valueTo"], ["selectedFrom","selectedTo"]
    ];
    for (const [pf, pt] of cands) {
      const f = el[pf], t = el[pt];
      let inISO = null, outISO = null;

      if (typeof f === "number" || typeof t === "number") {
        inISO  = secToISO(f);
        outISO = secToISO(t);
      } else if (f instanceof Date || t instanceof Date) {
        inISO  = toISO(f);
        outISO = toISO(t);
      } else if (typeof f === "string" || typeof t === "string") {
        const fd = parseMMDDYYYY(f);
        const td = parseMMDDYYYY(t);
        inISO  = toISO(fd);
        outISO = toISO(td);
      }

      if (inISO || outISO) return { source: `props(${pf}/${pt})`, checkInISO: inISO, checkOutISO: outISO };
    }

    // array style (selectedDates)
    if (Array.isArray(el.selectedDates) && el.selectedDates.length >= 2) {
      const [a, b] = el.selectedDates;
      const A = a instanceof Date ? a : (typeof a === "number" ? new Date(a * 1000) : parseMMDDYYYY(a));
      const B = b instanceof Date ? b : (typeof b === "number" ? new Date(b * 1000) : parseMMDDYYYY(b));
      const inISO  = toISO(A);
      const outISO = toISO(B);
      if (inISO || outISO) return { source: "props(selectedDates)", checkInISO: inISO, checkOutISO: outISO };
    }
    return null;
  }

  function extractFromShadow(el) {
    if (!el.shadowRoot) return null;
    // Try common inputs. We avoid tight selectors because markup can churn.
    const sr = el.shadowRoot;
    const fromHidden = sr.querySelector('input[type="hidden"][name*="from" i]');
    const toHidden   = sr.querySelector('input[type="hidden"][name*="to" i]');
    let inISO  = fromHidden?.value && /^\d+$/.test(fromHidden.value) ? secToISO(Number(fromHidden.value)) : null;
    let outISO = toHidden?.value   && /^\d+$/.test(toHidden.value)   ? secToISO(Number(toHidden.value))   : null;

    const fromInput = sr.querySelector('input[placeholder*="Check In" i], input[aria-label*="Check In" i], input[name*="from" i]');
    const toInput   = sr.querySelector('input[placeholder*="Check Out" i], input[aria-label*="Check Out" i], input[name*="to" i]');
    if (!inISO  && fromInput?.value) inISO  = toISO(parseMMDDYYYY(fromInput.value));
    if (!outISO && toInput?.value)   outISO = toISO(parseMMDDYYYY(toInput.value));

    if (inISO || outISO) return { source: "shadow", checkInISO: inISO, checkOutISO: outISO };
    return null;
  }

  function extractDates(el) {
    return (
      extractFromAttributes(el) ||
      extractFromProperties(el) ||
      extractFromShadow(el) ||
      { source: null, checkInISO: null, checkOutISO: null }
    );
  }

  function findPicker() {
    // Don’t assume an id – just the tag.
    return document.querySelector("wdpr-range-datepicker");
  }

  // ------------------- messaging + logging -------------------
  function sendDatesUp(payload) {
    // Send to background; it will forward to TOP frame for logging with slug
    chrome.runtime.sendMessage({ type: "DATES_FOUND", payload });
  }

  if (IS_TOP) {
    // Top frame logs combined payload (resort slug + dates)
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type !== "DATES_FO_
