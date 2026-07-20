const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_FINANCE_SETTINGS = Object.freeze({
  hourlyRateCents: 1200,
  laundryRateCents: 1000,
  commissionBps: 2000,
  currency: "EUR",
  reportingMonth: 1
});

export const assertInteger = (value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new FinanceValidationError(`${field} must be an integer between ${min} and ${max}`, [field]);
  }
  return value;
};

export class FinanceValidationError extends Error {
  constructor(message, fields = []) {
    super(message);
    this.name = "FinanceValidationError";
    this.fields = fields;
  }
}

export const assertDateOnly = (value, field, { optional = false } = {}) => {
  if (optional && !value) return "";
  if (!DATE_ONLY.test(String(value || ""))) throw new FinanceValidationError(`${field} must use YYYY-MM-DD`, [field]);
  const [year, month, day] = String(value).split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new FinanceValidationError(`${field} is not a valid civil date`, [field]);
  }
  return String(value);
};

export const nightsBetween = (checkIn, checkOut) => {
  assertDateOnly(checkIn, "checkIn");
  assertDateOnly(checkOut, "checkOut");
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (end < start) throw new FinanceValidationError("checkOut must not be before checkIn", ["checkOut"]);
  return Math.round((end - start) / 86400000);
};

export const centsFromDecimal = (value, field = "amount") => {
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new FinanceValidationError(`${field} must have at most two decimal places`, [field]);
  }
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new FinanceValidationError(`${field} is too large`, [field]);
  return negative ? -cents : cents;
};

export const decimalFromCents = (cents) => {
  assertInteger(Math.abs(cents), "cents");
  return `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
};

export const minutesFromHours = (value, field = "riccardoHours") => {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new FinanceValidationError(`${field} is invalid`, [field]);
  const minutes = Math.round(Number(normalized) * 60);
  return assertInteger(minutes, field, { max: 24 * 60 * 366 });
};

export const roundRatio = (numerator, denominator) => {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new FinanceValidationError("Invalid financial ratio");
  }
  return Math.round(numerator / denominator);
};

export const calculateBooking = (booking = {}) => {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const guests = assertInteger(booking.guests ?? 0, "guests", { max: 100 });
  const revenueCents = assertInteger(booking.revenueCents ?? 0, "revenueCents");
  const riccardoMinutes = assertInteger(booking.riccardoMinutes ?? 0, "riccardoMinutes", { max: 24 * 60 * 366 });
  const hourlyRateCents = assertInteger(booking.hourlyRateCents, "hourlyRateCents", { max: 1_000_000 });
  const laundryRateCents = assertInteger(booking.laundryRateCents, "laundryRateCents", { max: 1_000_000 });
  const commissionBps = assertInteger(booking.commissionBps, "commissionBps", { max: 10_000 });
  const purchasesCents = assertInteger(booking.purchasesCents ?? 0, "purchasesCents");
  const otherReimbursableCents = assertInteger(booking.otherReimbursableCents ?? 0, "otherReimbursableCents");
  const propertyExpensesCents = assertInteger(booking.propertyExpensesCents ?? 0, "propertyExpensesCents");
  const allocatedPaymentsCents = assertInteger(booking.allocatedPaymentsCents ?? 0, "allocatedPaymentsCents");

  const hoursCostCents = roundRatio(riccardoMinutes * hourlyRateCents, 60);
  const laundryCostCents = guests * laundryRateCents;
  const reimbursableExtrasCents = hoursCostCents + purchasesCents + laundryCostCents + otherReimbursableCents;
  const commissionCents = roundRatio(revenueCents * commissionBps, 10_000);
  const riccardoAccruedCents = reimbursableExtrasCents + commissionCents;
  const operatingProfitCents = revenueCents - riccardoAccruedCents;
  const netProfitCents = operatingProfitCents - propertyExpensesCents;
  const profitPerNightCents = nights > 0 ? roundRatio(netProfitCents, nights) : null;
  const outstandingCents = riccardoAccruedCents - allocatedPaymentsCents;
  const paymentStatus = allocatedPaymentsCents <= 0 ? "unpaid" : allocatedPaymentsCents < riccardoAccruedCents ? "partially_paid" : "paid";

  return {
    nights,
    hoursCostCents,
    laundryCostCents,
    reimbursableExtrasCents,
    commissionCents,
    riccardoAccruedCents,
    allocatedPaymentsCents,
    outstandingCents,
    paymentStatus,
    operatingProfitCents,
    netProfitCents,
    profitPerNightCents
  };
};

export const calculateSummary = ({ bookings = [], expenses = [], payments = [] } = {}) => {
  const activeBookings = bookings.filter((entry) => !entry.voidedAt && entry.status !== "calendar_block");
  const activeExpenses = expenses.filter((entry) => !entry.voidedAt && entry.incurredStatus === "incurred");
  const activePayments = payments.filter((entry) => !entry.voidedAt);
  const bookingTotals = activeBookings.map((booking) => calculateBooking(booking));
  const revenueCents = activeBookings.reduce((sum, booking) => sum + (booking.revenueCents || 0), 0);
  const revenueReceivedCents = activeBookings.reduce((sum, booking) => sum + (booking.revenueReceivedCents || 0), 0);
  const bookingAccruedCents = bookingTotals.reduce((sum, value) => sum + value.riccardoAccruedCents, 0);
  const propertyExpensesCents = activeExpenses.reduce((sum, expense) => sum + (expense.amountCents || 0), 0);
  const riccardoExpensePayableCents = activeExpenses
    .filter((expense) => expense.paidBy === "riccardo" && expense.reimbursableToRiccardo)
    .reduce((sum, expense) => sum + (expense.amountCents || 0), 0);
  const ownerCashExpensesCents = activeExpenses
    .filter((expense) => expense.paymentStatus === "paid" && expense.paidBy !== "riccardo")
    .reduce((sum, expense) => sum + (expense.amountCents || 0), 0);
  const riccardoPaidCents = activePayments.reduce((sum, payment) => sum + (payment.amountCents || 0), 0);
  const riccardoAccruedCents = bookingAccruedCents + riccardoExpensePayableCents;
  const operatingProfitCents = revenueCents - bookingAccruedCents - propertyExpensesCents;
  const cashPositionCents = revenueReceivedCents - ownerCashExpensesCents - riccardoPaidCents;
  const occupiedNights = bookingTotals.reduce((sum, value) => sum + value.nights, 0);

  return {
    revenueCents,
    revenueReceivedCents,
    riccardoAccruedCents,
    riccardoPaidCents,
    riccardoOutstandingCents: riccardoAccruedCents - riccardoPaidCents,
    propertyExpensesCents,
    operatingProfitCents,
    cashPositionCents,
    profitMarginBps: revenueCents ? roundRatio(operatingProfitCents * 10_000, revenueCents) : null,
    occupiedNights
  };
};

export const allocationStatus = (accruedCents, allocatedCents) => {
  if (allocatedCents <= 0) return "unpaid";
  if (allocatedCents < accruedCents) return "partially_paid";
  return "paid";
};
