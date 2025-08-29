(function () {
  function formatISODate(sec) {
    if (!sec || isNaN(sec)) return null;
    const d = new Date(Number(sec) * 1000);
    // force UTC for consistency
    return d.toISOString().split("Z")[0] + ".000";
  }

  function grabDates() {
    const picker = document.querySelector("wdpr-range-datepicker#rangeDatePicker");
    if (!picker) {
      console.log("No wdpr-range-datepicker found");
      return;
    }

    const from = picker.getAttribute("date-from");
    const to = picker.getAttribute("date-to");

    console.log("Check-in:", formatISODate(from));
    console.log("Check-out:", formatISODate(to));
  }

  // Run once on load
  grabDates();

  // Watch for changes (if user changes dates in the UI)
  const mo = new MutationObserver(grabDates);
  const picker = document.querySelector("wdpr-range-datepicker#rangeDatePicker");
  if (picker) {
    mo.observe(picker, { attributes: true, attributeFilter: ["date-from", "date-to"] });
  }
})();
