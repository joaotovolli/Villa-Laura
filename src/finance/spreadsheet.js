export const reconcileSpreadsheetRecords = (records, existing = []) => {
  const creates = [];
  const updates = [];
  const ignored = [];
  const ambiguous = [];
  for (const record of records) {
    const byKey = existing.find((entry) => entry.external_uid === record.importKey);
    if (byKey) {
      const unchanged = byKey.check_in === record.checkIn && byKey.check_out === record.checkOut &&
        Number(byKey.guests) === record.guests && Number(byKey.revenue_cents) === record.revenueCents &&
        Number(byKey.riccardo_minutes) === record.riccardoMinutes && Number(byKey.hourly_rate_cents) === record.hourlyRateCents &&
        Number(byKey.laundry_rate_cents) === record.laundryRateCents && Number(byKey.commission_bps) === record.commissionBps &&
        Number(byKey.purchases_cents) === record.purchasesCents;
      if (unchanged) ignored.push({ record, id: byKey.id, reason: "already_imported" });
      else updates.push({ record, id: byKey.id, reason: "repeat_import_changed" });
      continue;
    }
    const dateMatches = existing.filter((entry) => entry.check_in === record.checkIn && entry.check_out === record.checkOut);
    if (dateMatches.length === 1) updates.push({ record, id: dateMatches[0].id, reason: "dates" });
    else if (dateMatches.length > 1) ambiguous.push({ row: record.rowNumber, candidateCount: dateMatches.length });
    else creates.push(record);
  }
  return { creates, updates, ignored, ambiguous };
};

