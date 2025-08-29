(function () {
  // ---------- helpers ----------
  const pad = n => String(n).padStart(2, "0");

  // Format as "YYYY-MM-DDT00:00:00.000" using the America/New_York calendar day
  function formatMidnightInTZFromEpochSeconds(sec, tz = "America/New_York") {
    if (!isFinite(sec)) return null;
    const d = new Date(Number(sec) * 1000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(d);
    const Y = parts.find(p => p.type === "year")?.value;
    const M = parts.find(p => p.type === "month")?.value;
    const D = parts.find(p => p.type === "day")?.value;
    if (!Y || !M || !D) return null;
    return `${Y}-${M}-${D}T00:00:00.000`;
  }

  function getResortSlugFromLocation() {
    const m = location.pathname.match(/\/resorts\/([^/]+)\/rates-rooms/);
    return m ? m[1] : null;
  }

  function findPicker() {
    // Don’t assume an id; just target the element type.
    return document.querySelector("wdpr-range-datepicker");
  }

  function readFromAttributes(picker) {
    const fromAttr = picker?.getAttribute("date-from");
    const toAttr = picker?.getAttribute("date-to");
    const fromSec = fromAttr ? Number(fromAttr) : NaN;
    const toSec = toAttr ? Number(toAttr) : NaN;
    return { fromSec, toSec, raw: { fromAttr, toAttr } };
  }

  function logDates() {
    const picker = findPicker();
    const resort = getResortSlugFromLocation();
    if (!picker) {
      console.log("[Disney Grabber] frame:", self === top ? "top" : "iframe",
                  "| resort:", resort, "| picker not found yet");
      return;
    }

    const { fromSec, toSec, raw } = readFromAttributes(picker);
    const checkIn = formatMidnightInTZFromEpochSeconds(fromSec);
    const checkOut = formatMidnightInTZFromEpochSeconds(toSec);

    console.log("[Disney Grabber]",
      {
        frame: (self === top ? "top" : "iframe"),
        resort,
        source: "host-attributes",
        raw,
        formatted: { checkIn, checkOut }
      }
    );
  }

  // Wait for the element to exist (covers SPA/iframes that render late)
  function waitForPicker(timeoutMs = 15000) {
    return new Promise(resolve => {
      const existing = findPicker();
      if (existing) return resolve(existing);

      const start = Date.now();
      const obs = new MutationObserver(() => {
        const el = findPicker();
        if (el) {
          obs.disconnect();
          resolve(el);
        } else if (Date.now() - start > timeoutMs) {
          obs.disconnect();
          resolve(null);
        }
      });
      obs.observe(document.documentElement, { subtree: true, childList: true });
      // Also check periodically in case mutations are minimal
      const iv = setInterval(() => {
        const el = findPicker();
        if (el || Date.now() - start > timeoutMs) {
          clearInterval(iv);
          obs.disconnect();
          resolve(el || null);
        }
      }, 300);
    });
  }

  async function main() {
    // Initial attempt
    logDates();

    // Wait until the picker actually appears, then log again
    const picker = await waitForPicker();
    if (picker) {
      logDates();
      // Keep logs updated if attributes change (user edits)
      const mo = new MutationObserver(muts => {
        if (muts.some(m => m.type === "attributes" &&
                           (m.attributeName === "date-from" || m.attributeName === "date-to"))) {
          logDates();
        }
      });
      mo.observe(picker, { attributes: true, attributeFilter: ["date-from", "date-to"] });
    }

    // Handle SPA route changes (slug can change)
    window.addEventListener("popstate", logDates);
    window.addEventListener("hashchange", logDates);
  }

  main();
})();
