// Map minutes 0-59 → set of word IDs to highlight

const HOUR_IDS: Record<number, string> = {
  1:  'one',
  2:  'two',
  3:  'three',
  4:  'four',
  5:  'five-hr',
  6:  'six',
  7:  'seven',
  8:  'eight',
  9:  'nine',
  10: 'ten-min', // grid only has one TEN — shares with minute marker
  11: 'eleven',
  12: 'twelve',
};

function getHourId(h24: number, useNext: boolean): string {
  let h = h24 % 12;
  if (useNext) h = (h + 1) % 12;
  if (h === 0) h = 12;
  return HOUR_IDS[h] ?? 'twelve';
}

export function computeActiveWords(date: Date): Set<string> {
  const active = new Set<string>();

  // Always on
  active.add('it');
  active.add('is');

  const h = date.getHours();
  const m = date.getMinutes();

  // Determine which bucket the minute falls in
  const bucket = Math.floor(m / 5) * 5;
  // Map minute bucket → word IDs
  if (bucket === 0) {
    // o'clock
    active.add('oclock');
    active.add(getHourId(h, false));
  } else if (bucket === 5) {
    // five past
    active.add('five-min');
    active.add('past');
    active.add(getHourId(h, false));
  } else if (bucket === 10) {
    // ten past
    active.add('ten-min');
    active.add('past');
    active.add(getHourId(h, false));
  } else if (bucket === 15) {
    // quarter past
    active.add('quarter');
    active.add('past');
    active.add(getHourId(h, false));
  } else if (bucket === 20) {
    // twenty past
    active.add('twenty');
    active.add('past');
    active.add(getHourId(h, false));
  } else if (bucket === 25) {
    // twenty five past
    active.add('twenty');
    active.add('five-min');
    active.add('past');
    active.add(getHourId(h, false));
  } else if (bucket === 30) {
    // half past
    active.add('half');
    active.add('past');
    active.add(getHourId(h, false));
  } else if (bucket === 35) {
    // twenty five to
    active.add('twenty');
    active.add('five-min');
    active.add('to');
    active.add(getHourId(h, true));
  } else if (bucket === 40) {
    // twenty to
    active.add('twenty');
    active.add('to');
    active.add(getHourId(h, true));
  } else if (bucket === 45) {
    // quarter to
    active.add('quarter');
    active.add('to');
    active.add(getHourId(h, true));
  } else if (bucket === 50) {
    // ten to
    active.add('ten-min');
    active.add('to');
    active.add(getHourId(h, true));
  } else if (bucket === 55) {
    // five to
    active.add('five-min');
    active.add('to');
    active.add(getHourId(h, true));
  }

  return active;
}
