/**
 * Resolve the `location` value (printed as "LOT NO." on the inflow invoice) for
 * a storage record edit.
 *
 * A structured Lot, when assigned, is the source of truth for the printed lot
 * number: the invoice reads `location`, so whenever a lot is linked we mirror
 * the lot's name into `location`. This keeps the printed LOT NO. in sync when
 * the Lot dropdown is changed, instead of leaving the stale location text.
 *
 * When no lot is linked (warehouses that use free-text only), the form's
 * location value is used as-is.
 */
export function resolveInflowLotLocation(
    formLocation: string,
    resolvedLotName: string | null | undefined
): string {
    return resolvedLotName ? resolvedLotName : formLocation;
}
