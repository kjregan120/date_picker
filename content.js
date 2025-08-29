// ---- helpers ---------------------------------------------------------------

function resortSlugFromPath(pathname = location.pathname) {
  // grabs whatever is after /resorts/ and before /rates-rooms
  const m = pathname.match(/\/resorts\/([^/]+)(?=\/rates-rooms|\/?$)/i);
  return m ? m[1] : null;
}

function unixSecToISOString(sec) {
  if (!sec || isNaN(sec)) return null;
  // disney component uses seconds since epoch; convert to ms
  const d = new Date(Number(sec) * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function mmddyyyyToISO(str) {
  // fallback if we only see "MM/dd/yyyy" in an input
  if (!str) return null;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [ , mm, dd, yyyy ] = m.map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function logPayload(source, { resort, checkInISO, checkOutISO }) {
  console.log(`[Disney Dates Grabber] (${source})`, {
    resort,
    checkInISO,
    checkOutISO
  });
}

// ---- core extraction --------------------------------------------------------

function extractFromDatepicker(el) {
  if (!el) return { checkInISO: null, checkOutISO: null };

  // 1) try attributes (kebab-case)
  let fromAttr = el.getAttribute('date-from');
  let toAttr   = el.getAttribute('date-to');

  // 2) try JS properties (camelCase) exposed by the web component
  // (some frameworks reflect to properties instead of attributes)
  let fromProp = el.dateFrom ?? el.from ?? el.start ?? null;
  let toProp   = el.dateTo   ?? el.to   ?? el.end   ?? null;

  // prefer attributes if present; else properties
  const fromRaw = fromAttr ?? fromProp;
  const toRaw   = toAttr   ?? toProp;

  let checkInISO  = unixSecToISOString(fromRaw);
  let checkOutISO = unixSecToISOString(toRaw);

  // 3) fallback: peek into shadow DOM for text inputs like "MM/dd/yyyy"
  // names and structure may vary; we try a few selectors defensively.
  if ((!checkInISO || !checkOutISO) && el.shadowRoot) {
    const fromInput = el.shadowRoot.querySelector('input[name="from"], input#from, input[name="date-from"]');
    const toInput   = el.shadowRoot.querySelector('input[name="to"],   input#to,   input[name="date-to"]');

    if (!checkInISO && fromInput?.value)  checkInISO  = mmddyyyyToISO(fromInput.value);
    if (!checkOutISO && toInput?.value)   checkOutISO = mmddyyyyToISO(toInput.value);
  }

  return { checkInISO, checkOutISO };
}

function getAndLog() {
  const dp =
    document.querySelector('wdpr-range-datepicker#rangeDatePicker') ||
    document.querySelector('wdpr-range-datepicker');

  const resort = resortSlugFromPath();
  const { checkInISO, checkOutISO } = extractFromDatepicker(dp);

  logPayload(dp ? 'found-element' : 'no-element-yet', { resort, checkInISO, checkOutISO });
}

// ---- observers & listeners --------------------------------------------------

// run once at idle (in case it’s already on the page)
getAndLog();

// watch DOM for the datepicker appearing later (SPA hydration / route changes)
const domObserver = new MutationObserver(() => {
  const dp = document.querySelector('wdpr-range-datepicker#rangeDatePicker, wdpr-range-datepicker');
  if (dp) {
    getAndLog();

    // also observe attribute changes on the component (when dates change)
    const attrObserver = new MutationObserver(() => getAndLog());
    attrObserver.observe(dp, { attributes: true, attributeFilter: ['date-from', 'date-to'] });

    // and generic change/input bubbling from within the component
    dp.addEventListener('change', getAndLog, true);
    dp.addEventListener('input',  getAndLog, true);

    // optional: listen for custom events if they exist (guessing common names)
    dp.addEventListener('valueChanged', getAndLog, true);
    dp.addEventListener('wdprChange',  getAndLog, true);

    // no need to watch the whole DOM anymore
    domObserver.disconnect();
  }
});
domObserver.observe(document.documentElement, { childList: true, subtree: true });

// as a final fallback, re-run on SPA navigations that don’t reload the page
let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    getAndLog();
  }
}, 1000);
