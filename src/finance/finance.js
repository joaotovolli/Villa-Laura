const app = document.querySelector("#finance-app");
const currentYear = new Date().getFullYear();
const state = {
  session: null, dashboard: null, bookings: [], expenses: [], payments: [], categories: [], audit: [], settings: null,
  filters: { year: String(currentYear), month: "", from: "", to: "", status: "", search: "", sort: "checkIn", direction: "asc" },
  message: "", error: ""
};

const api = async (path, options = {}) => {
  const response = await fetch(`/api/finance${path}`, {
    ...options,
    credentials: "include",
    headers: options.body ? { "content-type": "application/json", ...(options.headers || {}) } : options.headers
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("Finance access expired. Sign in through Cloudflare Access again.");
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Finance request failed");
    error.fields = body.fields || [];
    throw error;
  }
  return body;
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const money = (cents, currency = "EUR") => new Intl.NumberFormat("en-IE", { style: "currency", currency }).format((Number(cents) || 0) / 100);
const decimal = (cents) => ((Number(cents) || 0) / 100).toFixed(2);
const percent = (bps) => `${((Number(bps) || 0) / 100).toFixed(2)}%`;
const hours = (minutes) => ((Number(minutes) || 0) / 60).toFixed(2);
const dateTime = (value) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value)) : "Not available";
const dateValue = (value) => escapeHtml(String(value || "").slice(0, 10));
const query = () => {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString() ? `?${params}` : "";
};

const formObject = (form) => Object.fromEntries(new FormData(form));
const empty = (message) => `<div class="finance-empty">${escapeHtml(message)}</div>`;
const statusPill = (status) => `<span class="status ${["cancelled", "removed_from_calendar", "void"].includes(status) ? "attention" : status === "completed" ? "complete" : "ready"}">${escapeHtml(String(status || "unknown").replace(/_/g, " "))}</span>`;

const nav = () => `<nav class="finance-nav" aria-label="Finance sections">
  <a href="#overview">Overview</a><a href="#bookings">Bookings</a><a href="#expenses">Expenses</a>
  <a href="#payments">Riccardo payments</a><a href="#reports">Reports</a><a href="#settings">Settings</a><a href="#audit">Audit</a>
</nav>`;

const filters = () => `<form id="finance-filter" class="panel finance-filter" aria-label="Finance reporting filters">
  <label>Year<input name="year" inputmode="numeric" pattern="[0-9]{4}" value="${escapeHtml(state.filters.year)}" placeholder="All years"></label>
  <label>Month<select name="month"><option value="">All months</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${String(index + 1) === state.filters.month ? "selected" : ""}>${new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2026, index, 1))}</option>`).join("")}</select></label>
  <label>From<input type="date" name="from" value="${dateValue(state.filters.from)}"></label>
  <label>To<input type="date" name="to" value="${dateValue(state.filters.to)}"></label>
  <label>Booking status<select name="status"><option value="">All statuses</option>${["active", "confirmed", "completed", "cancelled", "removed_from_calendar", "needs_review"].map((value) => `<option value="${value}" ${value === state.filters.status ? "selected" : ""}>${value.replace(/_/g, " ")}</option>`).join("")}</select></label>
  <div class="actions"><button type="submit">Apply</button><button class="secondary" type="button" data-action="clear-filters">Clear</button></div>
</form>`;

const card = (label, value, className = "", title = "") => `<article class="finance-card ${className}" ${title ? `title="${escapeHtml(title)}"` : ""}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;

const overview = () => {
  const summary = state.dashboard?.summary || {};
  const lastSync = state.dashboard?.lastSync;
  return `<section id="overview" class="finance-section" aria-labelledby="overview-title">
    <div class="section-heading"><div><h2 id="overview-title">Finance overview</h2><p>Accrual performance and actual cash movement for the selected period.</p></div></div>
    <div class="finance-cards">
      ${card("Booking Revenue", money(summary.revenueCents), "", "Booking revenue earned in the selected period.")}
      ${card("Riccardo Accrued", money(summary.riccardoAccruedCents), "", "Amounts incurred for Riccardo, whether paid or unpaid.")}
      ${card("Riccardo Paid", money(summary.riccardoPaidCents), "", "Cash payments actually made to Riccardo.")}
      ${card("Riccardo Outstanding", money(summary.riccardoOutstandingCents), "outstanding", "Accrued amount less payments actually made.")}
      ${card("Other Property Expenses", money(summary.propertyExpensesCents))}
      ${card("Net Operating Profit", money(summary.operatingProfitCents), Number(summary.operatingProfitCents) < 0 ? "money-negative" : "", "Revenue minus all incurred costs and expenses, regardless of payment timing.")}
      ${card("Cash Net Position", money(summary.cashPositionCents), Number(summary.cashPositionCents) < 0 ? "money-negative" : "", "Cash received less owner-paid expenses and payments to Riccardo.")}
      ${card("Profit Margin", summary.profitMarginBps == null ? "—" : percent(summary.profitMarginBps))}
      ${card("Occupied Nights", String(summary.occupiedNights || 0))}
      ${card("Revenue Received", money(summary.revenueReceivedCents))}
    </div>
    <dl class="finance-help">
      <div><dt>Operating profit</dt><dd>Recognises revenue, Riccardo costs, and property expenses when earned or incurred.</dd></div>
      <div><dt>Cash position</dt><dd>Tracks actual cash received and paid. Paying Riccardo does not reduce profit twice.</dd></div>
      <div><dt>Accrued</dt><dd>The liability created by work, laundry, purchases, commission, and reimbursable property expenses.</dd></div>
      <div><dt>Outstanding</dt><dd>Total accrued to Riccardo minus all non-voided payments made to him.</dd></div>
    </dl>
    <p class="muted">Last iCal finance reconciliation: ${lastSync ? `${dateTime(lastSync.completedAt || lastSync.startedAt)} — ${escapeHtml(lastSync.status)}` : "No finance reconciliation recorded"}.</p>
  </section>`;
};

const calculated = (booking) => {
  const c = booking.calculations;
  return `<dl class="finance-calculated" aria-label="Calculated booking values">
    <div><dt>Nights</dt><dd>${c.nights}</dd></div><div><dt>Hours cost</dt><dd>${money(c.hoursCostCents)}</dd></div>
    <div><dt>Laundry</dt><dd>${money(c.laundryCostCents)}</dd></div><div><dt>Reimbursable extras</dt><dd>${money(c.reimbursableExtrasCents)}</dd></div>
    <div><dt>Commission</dt><dd>${money(c.commissionCents)}</dd></div><div><dt>Riccardo accrued</dt><dd>${money(c.riccardoAccruedCents)}</dd></div>
    <div><dt>Payments allocated</dt><dd>${money(c.allocatedPaymentsCents)}</dd></div><div><dt>Booking outstanding</dt><dd>${money(c.outstandingCents)}</dd></div>
    <div><dt>Booking operating profit</dt><dd>${money(c.operatingProfitCents)}</dd></div><div><dt>Related property expenses</dt><dd>${money(booking.propertyExpensesCents)}</dd></div>
    <div><dt>Final net profit</dt><dd>${money(c.netProfitCents)}</dd></div><div><dt>Profit per night</dt><dd>${c.profitPerNightCents == null ? "—" : money(c.profitPerNightCents)}</dd></div>
  </dl>`;
};

const bookingFields = (booking = {}) => `<div class="grid">
  <label>Guest name or reference<input name="title" maxlength="180" required value="${escapeHtml(booking.title || "")}"></label>
  <label>Booking source<input name="source" maxlength="80" required value="${escapeHtml(booking.source || "Manual")}"></label>
  <label>Booking reference<input name="bookingReference" maxlength="100" value="${escapeHtml(booking.bookingReference || "")}"></label>
  <label class="${booking.origin === "ical" ? "imported-field" : ""}">Check-in<input type="date" name="checkIn" required value="${dateValue(booking.checkIn)}"></label>
  <label class="${booking.origin === "ical" ? "imported-field" : ""}">Check-out<input type="date" name="checkOut" required value="${dateValue(booking.checkOut)}"></label>
  <label>Status<select name="status">${["active", "confirmed", "completed", "cancelled", "removed_from_calendar", "needs_review"].map((value) => `<option value="${value}" ${value === (booking.status || "active") ? "selected" : ""}>${value.replace(/_/g, " ")}</option>`).join("")}</select></label>
  <label>Number of guests<input type="number" name="guests" min="0" max="100" required value="${booking.guests || 0}"></label>
  <label>Booking revenue (€)<input type="number" name="revenueCents" min="0" step="0.01" required value="${decimal(booking.revenueCents)}"></label>
  <label>Cash received (€)<input type="number" name="revenueReceivedCents" min="0" step="0.01" required value="${decimal(booking.revenueReceivedCents)}"></label>
  <label>Cash received date<input type="date" name="revenueReceivedDate" value="${dateValue(booking.revenueReceivedDate)}"></label>
  <label>Riccardo hours<input type="number" name="riccardoHours" min="0" step="0.01" required value="${hours(booking.riccardoMinutes)}"></label>
  <label>Applied hourly rate (€)<input type="number" name="hourlyRateCents" min="0" step="0.01" required value="${decimal(booking.hourlyRateCents ?? state.settings?.hourlyRateCents)}"><span class="field-note">Snapshot: changing defaults will not alter this booking.</span></label>
  <label>Applied laundry rate (€)<input type="number" name="laundryRateCents" min="0" step="0.01" required value="${decimal(booking.laundryRateCents ?? state.settings?.laundryRateCents)}"><span class="field-note">Per guest, saved on this booking.</span></label>
  <label>Applied commission (%)<input type="number" name="commissionPercent" min="0" max="100" step="0.01" required value="${((booking.commissionBps ?? state.settings?.commissionBps ?? 0) / 100).toFixed(2)}"></label>
  <label>Riccardo purchase value (€)<input type="number" name="purchasesCents" min="0" step="0.01" required value="${decimal(booking.purchasesCents)}"></label>
  <label>Other reimbursable (€)<input type="number" name="otherReimbursableCents" min="0" step="0.01" required value="${decimal(booking.otherReimbursableCents)}"></label>
  ${booking.origin === "ical" ? `<label><span>Manual date override</span><select name="manualDateOverride"><option value="false" ${!booking.manualDateOverride ? "selected" : ""}>Use iCal dates</option><option value="true" ${booking.manualDateOverride ? "selected" : ""}>Keep manual dates</option></select></label>` : ""}
</div>
<label>Purchase description<textarea name="purchasesDescription" maxlength="1000">${escapeHtml(booking.purchasesDescription || "")}</textarea></label>
<label>Finance notes<textarea name="notes" maxlength="5000">${escapeHtml(booking.notes || "")}</textarea></label>`;

const bookingRecord = (booking) => `<details class="finance-record" data-booking-id="${escapeHtml(booking.id)}">
  <summary><span><strong>${escapeHtml(booking.title || booking.bookingReference || "Booking")}</strong><br><small>${escapeHtml(booking.checkIn)} → ${escapeHtml(booking.checkOut)} · ${escapeHtml(booking.origin)}</small></span><span>${statusPill(booking.needsReview ? "needs_review" : booking.status)}</span><span>${money(booking.revenueCents)}</span><span class="${booking.calculations.netProfitCents < 0 ? "money-negative" : ""}">${money(booking.calculations.netProfitCents)}</span></summary>
  <div class="finance-record__body">
    ${calculated(booking)}
    <form class="stack" data-form="booking-edit" data-id="${escapeHtml(booking.id)}" data-version="${booking.version}">${bookingFields(booking)}
      <div class="finance-form-actions"><button type="submit">Save booking</button>${state.session?.role === "owner" ? `<button type="button" class="danger" data-action="void-booking" data-id="${escapeHtml(booking.id)}">Void booking</button>` : ""}</div>
    </form>
    <p class="muted">Created ${dateTime(booking.createdAt)} by ${escapeHtml(booking.createdBy)}. Last updated ${dateTime(booking.updatedAt)} by ${escapeHtml(booking.updatedBy)}.${booking.externalUid ? " Imported identifier stored." : " Manual record."}</p>
  </div>
</details>`;

const bookings = () => `<section id="bookings" class="finance-section" aria-labelledby="bookings-title">
  <div class="section-heading"><div><h2 id="bookings-title">Booking finances</h2><p>Key figures stay compact; open a booking to edit operational fields and view every calculation.</p></div><div class="actions"><a class="button secondary" href="/api/finance/export?type=bookings&${query().slice(1)}">Export CSV</a></div></div>
  <form id="booking-search" class="panel finance-filter"><label>Search<input name="search" value="${escapeHtml(state.filters.search)}" placeholder="Guest, reference, source"></label><label>Sort<select name="sort"><option value="checkIn">Check-in</option><option value="revenue" ${state.filters.sort === "revenue" ? "selected" : ""}>Revenue</option><option value="updatedAt" ${state.filters.sort === "updatedAt" ? "selected" : ""}>Last updated</option><option value="title" ${state.filters.sort === "title" ? "selected" : ""}>Name/reference</option></select></label><label>Direction<select name="direction"><option value="asc">Ascending</option><option value="desc" ${state.filters.direction === "desc" ? "selected" : ""}>Descending</option></select></label><div class="actions"><button type="submit">Search & sort</button></div></form>
  <details class="panel"><summary><strong>Create manual booking</strong></summary><form id="booking-create" class="stack">${bookingFields({})}<button type="submit">Create booking</button></form></details>
  <div class="stack">${state.bookings.length ? state.bookings.map(bookingRecord).join("") : empty("No finance bookings match these filters. Run iCal sync or create a manual booking.")}</div>
</section>`;

const categoryOptions = (selected = "") => state.categories.filter((entry) => entry.active).map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === selected ? "selected" : ""}>${escapeHtml(entry.name)}</option>`).join("");
const bookingOptions = (selected = "") => `<option value="">No related booking</option>${state.bookings.map((booking) => `<option value="${escapeHtml(booking.id)}" ${booking.id === selected ? "selected" : ""}>${escapeHtml(booking.checkIn)} · ${escapeHtml(booking.title || booking.bookingReference)}</option>`).join("")}`;

const expenseFields = (expense = {}) => `<div class="grid">
  <label>Expense date<input type="date" name="expenseDate" required value="${dateValue(expense.expenseDate || new Date().toISOString())}"></label>
  <label>Category<select name="categoryId" required>${categoryOptions(expense.categoryId || "other")}</select></label>
  <label>Description<input name="description" maxlength="500" required value="${escapeHtml(expense.description || "")}"></label>
  <label>Supplier or beneficiary<input name="supplier" maxlength="180" value="${escapeHtml(expense.supplier || "")}"></label>
  <label>Amount (€)<input type="number" name="amountCents" min="0" step="0.01" required value="${decimal(expense.amountCents)}"></label>
  <label>Incurred status<select name="incurredStatus">${["planned", "incurred"].map((value) => `<option value="${value}" ${value === (expense.incurredStatus || "incurred") ? "selected" : ""}>${value}</option>`).join("")}</select></label>
  <label>Payment status<select name="paymentStatus">${["unpaid", "partially_paid", "paid"].map((value) => `<option value="${value}" ${value === (expense.paymentStatus || "unpaid") ? "selected" : ""}>${value.replace(/_/g, " ")}</option>`).join("")}</select></label>
  <label>Payment date<input type="date" name="paymentDate" value="${dateValue(expense.paymentDate)}"></label>
  <label>Payment method<input name="paymentMethod" maxlength="100" value="${escapeHtml(expense.paymentMethod || "")}"></label>
  <label>Who paid?<select name="paidBy">${["owner", "riccardo", "other"].map((value) => `<option value="${value}" ${value === (expense.paidBy || "owner") ? "selected" : ""}>${value}</option>`).join("")}</select></label>
  <label>Related booking<select name="bookingId">${bookingOptions(expense.bookingId)}</select></label>
  <label>Reimbursable to Riccardo<select name="reimbursableToRiccardo"><option value="false" ${!expense.reimbursableToRiccardo ? "selected" : ""}>No</option><option value="true" ${expense.reimbursableToRiccardo ? "selected" : ""}>Yes — only when Riccardo paid</option></select></label>
</div><label>Notes<textarea name="notes" maxlength="5000">${escapeHtml(expense.notes || "")}</textarea></label>`;

const expenseRecord = (expense) => `<details class="finance-record">
  <summary><span><strong>${escapeHtml(expense.description)}</strong><br><small>${escapeHtml(expense.categoryName)} · ${escapeHtml(expense.expenseDate)}</small></span><span>${statusPill(expense.paymentStatus)}</span><span>${escapeHtml(expense.paidBy)}</span><span>${money(expense.amountCents)}</span></summary>
  <div class="finance-record__body"><form class="stack" data-form="expense-edit" data-id="${escapeHtml(expense.id)}" data-version="${expense.version}">${expenseFields(expense)}<div class="finance-form-actions"><button type="submit">Save expense</button>${state.session?.role === "owner" ? `<button type="button" class="danger" data-action="void-expense" data-id="${escapeHtml(expense.id)}">Void expense</button>` : ""}</div></form>
  <p class="muted">${expense.reimbursableToRiccardo ? `Recognised once as a property expense and payable to Riccardo. Allocated reimbursement: ${money(expense.allocatedPaymentsCents)}.` : "Does not increase Riccardo payable."} Created ${dateTime(expense.createdAt)} by ${escapeHtml(expense.createdBy)}.</p></div>
</details>`;

const expenses = () => `<section id="expenses" class="finance-section" aria-labelledby="expenses-title">
  <div class="section-heading"><div><h2 id="expenses-title">General property expenses</h2><p>Owner-paid costs reduce profit only. Riccardo-paid reimbursable costs reduce profit once and also increase his payable.</p></div><a class="button secondary" href="/api/finance/export?type=expenses&${query().slice(1)}">Export CSV</a></div>
  <details class="panel"><summary><strong>Add property expense</strong></summary><form id="expense-create" class="stack">${expenseFields({})}<button type="submit">Add expense</button></form></details>
  <div class="stack">${state.expenses.length ? state.expenses.map(expenseRecord).join("") : empty("No property expenses match this period.")}</div>
</section>`;

const allocationTargetOptions = () => {
  const bookingTargets = state.bookings.filter((booking) => booking.calculations.outstandingCents > 0).map((booking) => `<option value="booking:${escapeHtml(booking.id)}">Booking · ${escapeHtml(booking.checkIn)} · ${escapeHtml(booking.title)} · ${money(booking.calculations.outstandingCents)} due</option>`);
  const expenseTargets = state.expenses.filter((expense) => expense.reimbursableToRiccardo && expense.amountCents > expense.allocatedPaymentsCents).map((expense) => `<option value="expense:${escapeHtml(expense.id)}">Expense · ${escapeHtml(expense.expenseDate)} · ${escapeHtml(expense.description)} · ${money(expense.amountCents - expense.allocatedPaymentsCents)} due</option>`);
  return `<option value="">Keep unallocated</option>${bookingTargets.join("")}${expenseTargets.join("")}`;
};

const paymentRecord = (payment) => `<tr><td>${escapeHtml(payment.paymentDate)}</td><td>${escapeHtml(payment.paymentMethod || "—")}</td><td>${escapeHtml(payment.reference || "—")}</td><td class="numeric">${money(payment.amountCents)}</td><td class="numeric">${money(payment.allocatedCents)}</td><td class="numeric ${payment.unallocatedCents ? "money-negative" : ""}">${money(payment.unallocatedCents)}</td><td><details><summary>Allocate</summary><form data-form="allocation-create" data-id="${escapeHtml(payment.id)}" class="stack"><label>Target<select name="target" required>${allocationTargetOptions()}</select></label><label>Amount (€)<input type="number" name="amountCents" min="0.01" max="${decimal(payment.unallocatedCents)}" step="0.01" required></label><button type="submit" ${payment.unallocatedCents <= 0 ? "disabled" : ""}>Allocate balance</button></form>${state.session?.role === "owner" ? `<button type="button" class="danger" data-action="void-payment" data-id="${escapeHtml(payment.id)}">Void payment</button>` : ""}</details></td></tr>`;

const payments = () => `<section id="payments" class="finance-section" aria-labelledby="payments-title">
  <div class="section-heading"><div><h2 id="payments-title">Riccardo payment ledger</h2><p>Payments affect cash and reduce the payable; they never create a second operating expense.</p></div><div class="actions"><a class="button secondary" href="/api/finance/export?type=payments&${query().slice(1)}">Payments CSV</a><a class="button secondary" href="/api/finance/export?type=allocations">Allocations CSV</a></div></div>
  <details class="panel"><summary><strong>Record payment</strong></summary><form id="payment-create" class="stack"><div class="grid">
    <label>Payment date<input type="date" name="paymentDate" required value="${dateValue(new Date().toISOString())}"></label>
    <label>Amount (€)<input type="number" name="amountCents" min="0.01" step="0.01" required></label>
    <label>Payment method<input name="paymentMethod" maxlength="100" placeholder="Bank transfer"></label>
    <label>Reference<input name="reference" maxlength="180"></label>
    <label>Optional initial allocation<select name="target">${allocationTargetOptions()}</select></label>
    <label>Allocated amount (€)<input type="number" name="allocatedAmountCents" min="0" step="0.01" value="0.00"></label>
  </div><label>Notes<textarea name="notes" maxlength="5000"></textarea></label><button type="submit">Record payment once</button></form></details>
  ${state.payments.length ? `<div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="numeric">Amount</th><th class="numeric">Allocated</th><th class="numeric">Unallocated</th><th>Actions</th></tr></thead><tbody>${state.payments.map(paymentRecord).join("")}</tbody></table></div>` : empty("No payments to Riccardo match this period.")}
</section>`;

const reports = () => {
  const months = state.dashboard?.monthly || [];
  const maximum = Math.max(1, ...months.flatMap((month) => [Math.abs(month.revenueCents || 0), Math.abs(month.propertyExpensesCents || 0), Math.abs(month.operatingProfitCents || 0)]));
  const chart = months.map((month) => `<div class="finance-chart__month"><div class="finance-chart__bars" title="${escapeHtml(`${money(month.revenueCents)} revenue; ${money(month.propertyExpensesCents)} other expenses; ${money(month.operatingProfitCents)} operating profit`)}"><span class="finance-chart__bar" style="height:${Math.max(2, Math.abs(month.revenueCents || 0) / maximum * 100)}%"></span><span class="finance-chart__bar expense" style="height:${Math.max(2, Math.abs(month.propertyExpensesCents || 0) / maximum * 100)}%"></span><span class="finance-chart__bar ${month.operatingProfitCents < 0 ? "loss" : "profit"}" style="height:${Math.max(2, Math.abs(month.operatingProfitCents || 0) / maximum * 100)}%"></span></div><small>${new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2026, month.month - 1, 1))}</small></div>`).join("");
  return `<section id="reports" class="finance-section" aria-labelledby="reports-title"><div class="section-heading"><div><h2 id="reports-title">Monthly and annual reports</h2><p>Blue: revenue. Gold: other expenses. Green/red: operating profit or loss.</p></div><a class="button secondary" href="/api/finance/export?type=monthly&year=${encodeURIComponent(state.filters.year || currentYear)}">Monthly CSV</a></div><div class="panel finance-chart" role="img" aria-label="Monthly revenue, property expenses, and operating profit chart">${chart}</div>
  <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Month</th><th class="numeric">Revenue</th><th class="numeric">Riccardo accrued</th><th class="numeric">Other expenses</th><th class="numeric">Operating profit</th><th class="numeric">Cash position</th><th class="numeric">Nights</th></tr></thead><tbody>${months.map((month) => `<tr><td>${month.month}</td><td class="numeric">${money(month.revenueCents)}</td><td class="numeric">${money(month.riccardoAccruedCents)}</td><td class="numeric">${money(month.propertyExpensesCents)}</td><td class="numeric ${month.operatingProfitCents < 0 ? "money-negative" : ""}">${money(month.operatingProfitCents)}</td><td class="numeric ${month.cashPositionCents < 0 ? "money-negative" : ""}">${money(month.cashPositionCents)}</td><td class="numeric">${month.occupiedNights}</td></tr>`).join("")}</tbody></table></div></section>`;
};

const settings = () => `<section id="settings" class="finance-section" aria-labelledby="settings-title"><div><h2 id="settings-title">Finance settings</h2><p>Defaults apply only to new bookings. Existing booking snapshots never change automatically.</p></div>
  <form id="settings-form" class="panel stack"><div class="grid"><label>Default hourly rate (€)<input type="number" name="hourlyRateCents" min="0" step="0.01" required value="${decimal(state.settings?.hourlyRateCents)}" ${state.session?.canManageSettings ? "" : "disabled"}></label><label>Default laundry rate (€)<input type="number" name="laundryRateCents" min="0" step="0.01" required value="${decimal(state.settings?.laundryRateCents)}" ${state.session?.canManageSettings ? "" : "disabled"}></label><label>Default commission (%)<input type="number" name="commissionPercent" min="0" max="100" step="0.01" required value="${((state.settings?.commissionBps || 0) / 100).toFixed(2)}" ${state.session?.canManageSettings ? "" : "disabled"}></label><label>Currency<input name="currency" value="${escapeHtml(state.settings?.currency || "EUR")}" maxlength="3" required ${state.session?.canManageSettings ? "" : "disabled"}></label><label>Financial year starts<select name="reportingMonth" ${state.session?.canManageSettings ? "" : "disabled"}>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${index + 1 === state.settings?.reportingMonth ? "selected" : ""}>${new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2026, index, 1))}</option>`).join("")}</select></label></div>${state.session?.canManageSettings ? `<button type="submit">Save defaults</button>` : `<p class="muted">Finance Collaborators can view applied defaults but only the owner can change them.</p>`}</form>
  ${state.session?.role === "owner" ? `<aside class="finance-banner"><strong>Finance Collaborator access</strong><p>Add or remove approved addresses privately in the Cloudflare Pages <code>FINANCE_COLLABORATOR_EMAILS</code> secret and the matching Cloudflare Access allow policy. Never commit an address. Collaborators can use finance APIs, but owner-only admin/document APIs return 403.</p></aside>` : ""}
</section>`;

const audit = () => `<section id="audit" class="finance-section" aria-labelledby="audit-title"><div><h2 id="audit-title">Audit history</h2><p>Recent finance creation, modification, void, allocation, settings, import, and reconciliation events.</p></div>${state.audit.length ? `<div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Changed fields</th></tr></thead><tbody>${state.audit.map((event) => `<tr><td>${dateTime(event.occurredAt)}</td><td>${escapeHtml(event.actor)}</td><td>${escapeHtml(event.action)}</td><td>${escapeHtml(event.entityType)}</td><td>${escapeHtml(event.changedFields.join(", ") || "—")}</td></tr>`).join("")}</tbody></table></div>` : empty("No finance audit events recorded yet.")}</section>`;

const render = () => {
  app.innerHTML = `<div class="finance-shell">${nav()}${state.error ? `<div class="finance-banner error" role="alert">${escapeHtml(state.error)}</div>` : ""}${state.message ? `<div class="finance-banner" role="status">${escapeHtml(state.message)}</div>` : ""}${filters()}${overview()}${bookings()}${expenses()}${payments()}${reports()}${settings()}${audit()}</div>`;
  bindEvents();
};

const payloadFromBooking = (form) => {
  const body = formObject(form);
  body.commissionBps = Math.round(Number(body.commissionPercent) * 100);
  delete body.commissionPercent;
  if (form.dataset.version) body.version = Number(form.dataset.version);
  return body;
};

const payloadFromExpense = (form) => {
  const body = formObject(form);
  if (form.dataset.version) body.version = Number(form.dataset.version);
  return body;
};

const allocationFromTarget = (target, amountCents) => {
  const [type, id] = String(target || "").split(":");
  if (!id) return null;
  return { bookingId: type === "booking" ? id : "", expenseId: type === "expense" ? id : "", amountCents };
};

const mutate = async (work, success) => {
  state.error = "";
  state.message = "";
  try {
    await work();
    state.message = success;
    await load(false);
  } catch (error) {
    state.error = error.message;
    render();
  }
};

function bindEvents() {
  document.querySelector("#finance-filter")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = formObject(event.currentTarget);
    state.filters = { ...state.filters, year: values.year, month: values.month, from: values.from, to: values.to, status: values.status };
    await load();
  });
  document.querySelector("[data-action='clear-filters']")?.addEventListener("click", async () => {
    state.filters = { year: "", month: "", from: "", to: "", status: "", search: "", sort: "checkIn", direction: "asc" };
    await load();
  });
  document.querySelector("#booking-search")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = formObject(event.currentTarget);
    state.filters = { ...state.filters, search: values.search, sort: values.sort, direction: values.direction }; await load();
  });
  document.querySelector("#booking-create")?.addEventListener("submit", (event) => {
    event.preventDefault(); const form = event.currentTarget;
    mutate(() => api("/bookings", { method: "POST", body: JSON.stringify(payloadFromBooking(form)) }), "Manual booking created.");
  });
  document.querySelectorAll("[data-form='booking-edit']").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault(); mutate(() => api(`/bookings/${encodeURIComponent(form.dataset.id)}`, { method: "PATCH", body: JSON.stringify(payloadFromBooking(form)) }), "Booking finance saved.");
  }));
  document.querySelector("#expense-create")?.addEventListener("submit", (event) => {
    event.preventDefault(); const form = event.currentTarget;
    mutate(() => api("/expenses", { method: "POST", body: JSON.stringify(payloadFromExpense(form)) }), "Property expense added.");
  });
  document.querySelectorAll("[data-form='expense-edit']").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault(); mutate(() => api(`/expenses/${encodeURIComponent(form.dataset.id)}`, { method: "PATCH", body: JSON.stringify(payloadFromExpense(form)) }), "Expense saved.");
  }));
  document.querySelector("#payment-create")?.addEventListener("submit", (event) => {
    event.preventDefault(); const form = event.currentTarget; const body = formObject(form);
    const allocation = allocationFromTarget(body.target, body.allocatedAmountCents);
    const payload = { paymentDate: body.paymentDate, amountCents: body.amountCents, paymentMethod: body.paymentMethod, reference: body.reference, notes: body.notes, idempotencyKey: form.dataset.idempotencyKey || crypto.randomUUID(), allocations: allocation && Number(body.allocatedAmountCents) > 0 ? [allocation] : [] };
    form.dataset.idempotencyKey = payload.idempotencyKey;
    mutate(() => api("/payments", { method: "POST", body: JSON.stringify(payload) }), "Payment recorded. Any unallocated balance remains available for later allocation.");
  });
  document.querySelectorAll("[data-form='allocation-create']").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault(); const body = formObject(form); const allocation = allocationFromTarget(body.target, body.amountCents);
    mutate(() => api(`/payments/${encodeURIComponent(form.dataset.id)}/allocations`, { method: "POST", body: JSON.stringify(allocation) }), "Payment allocation recorded.");
  }));
  document.querySelector("#settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); const body = formObject(event.currentTarget); body.commissionBps = Math.round(Number(body.commissionPercent) * 100); delete body.commissionPercent;
    mutate(() => api("/settings", { method: "PATCH", body: JSON.stringify(body) }), "Finance defaults updated. Historical booking snapshots were preserved.");
  });
  for (const [action, noun, endpoint] of [["void-booking", "booking", "bookings"], ["void-expense", "expense", "expenses"], ["void-payment", "payment", "payments"]]) {
    document.querySelectorAll(`[data-action='${action}']`).forEach((button) => button.addEventListener("click", () => {
      if (!confirm(`Void this ${noun}? It will remain in the audit history and reports will exclude it.`)) return;
      mutate(() => api(`/${endpoint}/${encodeURIComponent(button.dataset.id)}/void`, { method: "POST", body: "{}" }), `${noun[0].toUpperCase()}${noun.slice(1)} voided.`);
    }));
  }
}

const load = async (showLoading = true) => {
  if (showLoading) app.innerHTML = `<section class="panel"><p>Loading finance records…</p></section>`;
  try {
    const suffix = query();
    const [session, dashboard, bookingsResult, expensesResult, paymentsResult, categoriesResult, settingsResult, auditResult] = await Promise.all([
      api("/session"), api(`/dashboard${suffix}`), api(`/bookings${suffix}`), api(`/expenses${suffix}`), api(`/payments${suffix}`), api("/categories"), api("/settings"), api("/audit?limit=100")
    ]);
    Object.assign(state, { session, dashboard, bookings: bookingsResult.bookings, expenses: expensesResult.expenses, payments: paymentsResult.payments, categories: categoriesResult.categories, settings: settingsResult.settings, audit: auditResult.events, error: "" });
    render();
  } catch (error) {
    app.innerHTML = `<section class="panel stack"><h2>Finance area unavailable</h2><p class="error">${escapeHtml(error.message)}</p><p>Sign in through the approved Cloudflare Access account or ask the owner to verify the finance database binding and role configuration.</p><a class="button secondary" href="/cdn-cgi/access/logout?returnTo=%2F">Log out through Cloudflare Access</a></section>`;
  }
};

load();

