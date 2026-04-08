export function getTrialDaysRemaining(trialEndDate: string | Date | null): number {
  if (!trialEndDate) return 0;
  
  const end = new Date(trialEndDate);
  const now = new Date();
  
  // Calculate difference in milliseconds
  const diff = end.getTime() - now.getTime();
  
  // Convert to days (rounding up so 0.1 days = 1 day left)
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isTrialExpiringSoon(trialEndDate: string | Date | null, thresholdDays = 3): boolean {
  if (!trialEndDate) return false;
  const daysRemaining = getTrialDaysRemaining(trialEndDate);
  return daysRemaining <= thresholdDays && daysRemaining > 0;
}
