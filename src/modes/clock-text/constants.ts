// Classic text clock grid — 11 cols × 10 rows
// Each cell: { letter, wordId }
// wordId '' means decorative (always dim)

export interface GridCell {
  letter: string;
  wordId: string;
}

export const GRID_COLS = 11;
export const GRID_ROWS = 10;

// Layout (read top-left → right, row by row):
// Row 0:  I T L I S A S T I M E
// Row 1:  A C Q U A R T E R D C
// Row 2:  T W E N T Y F I V E X
// Row 3:  H A L F S T E N F T O
// Row 4:  P A S T E R U N I N E
// Row 5:  O N E S I X T H R E E
// Row 6:  F O U R F I V E T W O
// Row 7:  E I G H T E L E V E N
// Row 8:  S E V E N T W E L V E
// Row 9:  O C L O C K A M P M S

export const GRID: GridCell[] = [
  // Row 0: IT L IS A S TIME  → "IT", "IS", (decorative filler)
  { letter: 'I', wordId: 'it' },
  { letter: 'T', wordId: 'it' },
  { letter: 'L', wordId: '' },
  { letter: 'I', wordId: 'is' },
  { letter: 'S', wordId: 'is' },
  { letter: 'A', wordId: '' },
  { letter: 'S', wordId: '' },
  { letter: 'T', wordId: '' },
  { letter: 'I', wordId: '' },
  { letter: 'M', wordId: '' },
  { letter: 'E', wordId: '' },

  // Row 1: A C QUARTER D C
  { letter: 'A', wordId: '' },
  { letter: 'C', wordId: '' },
  { letter: 'Q', wordId: 'quarter' },
  { letter: 'U', wordId: 'quarter' },
  { letter: 'A', wordId: 'quarter' },
  { letter: 'R', wordId: 'quarter' },
  { letter: 'T', wordId: 'quarter' },
  { letter: 'E', wordId: 'quarter' },
  { letter: 'R', wordId: 'quarter' },
  { letter: 'D', wordId: '' },
  { letter: 'C', wordId: '' },

  // Row 2: TWENTY FIVE X
  { letter: 'T', wordId: 'twenty' },
  { letter: 'W', wordId: 'twenty' },
  { letter: 'E', wordId: 'twenty' },
  { letter: 'N', wordId: 'twenty' },
  { letter: 'T', wordId: 'twenty' },
  { letter: 'Y', wordId: 'twenty' },
  { letter: 'F', wordId: 'five-min' },
  { letter: 'I', wordId: 'five-min' },
  { letter: 'V', wordId: 'five-min' },
  { letter: 'E', wordId: 'five-min' },
  { letter: 'X', wordId: '' },

  // Row 3: HALF S TEN F TO
  { letter: 'H', wordId: 'half' },
  { letter: 'A', wordId: 'half' },
  { letter: 'L', wordId: 'half' },
  { letter: 'F', wordId: 'half' },
  { letter: 'S', wordId: '' },
  { letter: 'T', wordId: 'ten-min' },
  { letter: 'E', wordId: 'ten-min' },
  { letter: 'N', wordId: 'ten-min' },
  { letter: 'F', wordId: '' },
  { letter: 'T', wordId: 'to' },
  { letter: 'O', wordId: 'to' },

  // Row 4: PAST E R U NINE
  { letter: 'P', wordId: 'past' },
  { letter: 'A', wordId: 'past' },
  { letter: 'S', wordId: 'past' },
  { letter: 'T', wordId: 'past' },
  { letter: 'E', wordId: '' },
  { letter: 'R', wordId: '' },
  { letter: 'U', wordId: '' },
  { letter: 'N', wordId: 'nine' },
  { letter: 'I', wordId: 'nine' },
  { letter: 'N', wordId: 'nine' },
  { letter: 'E', wordId: 'nine' },

  // Row 5: ONE SIX THREE
  { letter: 'O', wordId: 'one' },
  { letter: 'N', wordId: 'one' },
  { letter: 'E', wordId: 'one' },
  { letter: 'S', wordId: 'six' },
  { letter: 'I', wordId: 'six' },
  { letter: 'X', wordId: 'six' },
  { letter: 'T', wordId: 'three' },
  { letter: 'H', wordId: 'three' },
  { letter: 'R', wordId: 'three' },
  { letter: 'E', wordId: 'three' },
  { letter: 'E', wordId: 'three' },

  // Row 6: FOUR FIVE TWO
  { letter: 'F', wordId: 'four' },
  { letter: 'O', wordId: 'four' },
  { letter: 'U', wordId: 'four' },
  { letter: 'R', wordId: 'four' },
  { letter: 'F', wordId: 'five-hr' },
  { letter: 'I', wordId: 'five-hr' },
  { letter: 'V', wordId: 'five-hr' },
  { letter: 'E', wordId: 'five-hr' },
  { letter: 'T', wordId: 'two' },
  { letter: 'W', wordId: 'two' },
  { letter: 'O', wordId: 'two' },

  // Row 7: EIGHT ELEVEN
  { letter: 'E', wordId: 'eight' },
  { letter: 'I', wordId: 'eight' },
  { letter: 'G', wordId: 'eight' },
  { letter: 'H', wordId: 'eight' },
  { letter: 'T', wordId: 'eight' },
  { letter: 'E', wordId: 'eleven' },
  { letter: 'L', wordId: 'eleven' },
  { letter: 'E', wordId: 'eleven' },
  { letter: 'V', wordId: 'eleven' },
  { letter: 'E', wordId: 'eleven' },
  { letter: 'N', wordId: 'eleven' },

  // Row 8: SEVEN TWELVE
  { letter: 'S', wordId: 'seven' },
  { letter: 'E', wordId: 'seven' },
  { letter: 'V', wordId: 'seven' },
  { letter: 'E', wordId: 'seven' },
  { letter: 'N', wordId: 'seven' },
  { letter: 'T', wordId: 'twelve' },
  { letter: 'W', wordId: 'twelve' },
  { letter: 'E', wordId: 'twelve' },
  { letter: 'L', wordId: 'twelve' },
  { letter: 'V', wordId: 'twelve' },
  { letter: 'E', wordId: 'twelve' },

  // Row 9: OCLOCK A M P M S
  { letter: 'O', wordId: 'oclock' },
  { letter: 'C', wordId: 'oclock' },
  { letter: 'L', wordId: 'oclock' },
  { letter: 'O', wordId: 'oclock' },
  { letter: 'C', wordId: 'oclock' },
  { letter: 'K', wordId: 'oclock' },
  { letter: 'A', wordId: '' },
  { letter: 'M', wordId: '' },
  { letter: 'P', wordId: '' },
  { letter: 'M', wordId: '' },
  { letter: 'S', wordId: '' },
];

export const THEMES = {
  dark:  { bg: '#000000', on: '#ffffff', off: '#1a1a1a' },
  light: { bg: '#ffffff', on: '#000000', off: '#e8e8e8' },
  nude:  { bg: '#f5e6d3', on: '#3a2515', off: '#e8d5b8' },
  cream: { bg: '#fffaf0', on: '#4a3520', off: '#f0e5d0' },
} as const;

export type ThemeKey = keyof typeof THEMES;
