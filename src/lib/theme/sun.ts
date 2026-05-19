import SunCalc from 'suncalc';

export function getThemeFor(date: Date, lat: number, lng: number): 'light' | 'dark' {
  const times = SunCalc.getTimes(date, lat, lng);
  const now = date.getTime();
  // "Day" = between sunrise and sunset
  return now >= times.sunrise.getTime() && now < times.sunset.getTime()
    ? 'light'
    : 'dark';
}

export function getNextThemeFlip(date: Date, lat: number, lng: number): Date {
  const t = SunCalc.getTimes(date, lat, lng);
  const now = date.getTime();
  if (now < t.sunrise.getTime()) return t.sunrise;
  if (now < t.sunset.getTime()) return t.sunset;
  // After today's sunset → tomorrow's sunrise
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return SunCalc.getTimes(tomorrow, lat, lng).sunrise;
}
