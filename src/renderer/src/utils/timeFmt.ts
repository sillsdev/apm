import { pad2 } from './pad2';
import { pad3 } from './pad3';

export const timeFmt = (t: number) => {
  const val = parseFloat(t.toFixed(3));
  const sec = val - Math.floor(val / 60) * 60;
  let min = Math.floor(val / 60);
  min = min - Math.floor(min / 60) * 60;
  let hour = Math.floor(min / 60);
  hour = hour - Math.floor(hour / 24) * 24;
  return `${pad3(hour)}:${pad2(min)}:${('0' + sec.toFixed(3)).slice(-6)}`;
};
