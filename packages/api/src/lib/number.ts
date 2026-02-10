/**
 * Formats a number for display with intelligent abbreviation
 * @param num - The number to format
 * @returns Object with formatted string and whether it was rounded
 */
export function formatCount(num: number): { text: string; isRounded: boolean } {
  if (num < 1000) {
    return { text: num.toString(), isRounded: false };
  }

  if (num < 10000) {
    const thousands = num / 1000;
    const rounded = Math.round(thousands * 10) / 10;
    return {
      text: rounded % 1 === 0 ? `${rounded}K` : `${rounded.toFixed(1)}K`,
      isRounded: true,
    };
  }

  if (num < 1000000) {
    const thousands = Math.round(num / 1000);
    return { text: `${thousands}K`, isRounded: true };
  }

  const millions = num / 1000000;
  const rounded = Math.round(millions * 10) / 10;
  return {
    text: rounded % 1 === 0 ? `${rounded}M` : `${rounded.toFixed(1)}M`,
    isRounded: true,
  };
}
