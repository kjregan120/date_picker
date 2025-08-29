(function () {
  // ---- Formatting helpers ----
  function pad(n) { return String(n).padStart(2, "0"); }

  // Format strictly as "YYYY-MM-DDTHH:mm:ss.000" in UTC (no timezone suffix).
  function formatUTCFromEpochSeconds(sec) {
    if (!isFinite(sec)) return null;
    const d = new Date(Number(sec) * 1000);
    const Y = d.getUTCFullYear();
    const M = pad(d.getUTCMonth() + 1);
    const D = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const m = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    return `${Y}-${M}-${D}T${h}:${m}:${s}.000`;
  }

  // Extract slug between /resorts/ and /rates-rooms in the current URL
  function getResortSlugFromLocation() {
    const m = location.pathname.match(/\/resorts\/([^/]+)\/rates-rooms/);
    return m ? m[1] : null;
  }

  // Main read
  function grabAndLog() {
    const picker = document.querySelector("wdpr-range-datepicker#rangeDatePicker");
    const fromSec = picker ? Number(picker.getAttribute("date-from")) : NaN;
    const toSec   = picker ? Number(picker.getAttribute("date-to"))   : NaN;

    const checkIn  = formatUTCFromEpochSeconds(fromSec);
    const checkOut = formatUTCFromEpochSeconds(toSec);
    const resortSlug = getResortSlugFromLocation();

    console.log("[Disney Grabber] resort:", resortSlug);
    console.log("[Disney Grabber] check-in:", checkIn);
    console.log("[Disney Grabber] check-out:", checkOut);
  }

  // Initial pass (covers most SSR/CSR cases)
  grabAndLog();

  // Watch for date changes in the picker (user edits)
  const attachObserver = () => {
    const picker = document.querySelector("wdpr-range-datepicker#rangeDatePicker");
    if (!picker) return;
    const mo = new MutationObserver(grabAndLog);
    mo.observe(picker, {
      attributes: true,
      attributeFilter: ["date-from", "date-to"]
    });
  };

  // Try to attach observer now and also after small delay (for SPA render)
  attachObserver();
  setTimeout(attachObserver, 1500);

  // If the site is a SPA and changes the URL, re-read the slug
  window.addEventListener("popstate", grabAndLog);
  window.addEventListener("pushstate", grabAndLog);   // some routers dispatch custom events
  window.addEventListener("replacestate", grabAndLog);
})();
