// Срок действия бесплатной подписи.
// Внутри установленного приложения лежит файл embedded.mobileprovision — в нём записана дата
// ExpirationDate. При бесплатном Apple ID это ~7 дней с момента подписи. Читаем её, чтобы
// заранее напомнить о переподписи. После «Refresh» в SideStore файл обновляется сам.
import { File, Paths } from 'expo-file-system';

export interface SignInfo {
  expiresAt: number | null; // мс
  createdAt: number | null;
  source: 'profile' | 'none';
}

function latin1(bytes: Uint8Array): string {
  let s = '';
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  }
  return s;
}

export function readSignInfo(): SignInfo {
  try {
    const f = new File(Paths.bundle, 'embedded.mobileprovision');
    if (!f.exists) return { expiresAt: null, createdAt: null, source: 'none' };
    const text = latin1(f.bytesSync());
    const exp = text.match(/<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/);
    const cre = text.match(/<key>CreationDate<\/key>\s*<date>([^<]+)<\/date>/);
    const expiresAt = exp ? Date.parse(exp[1]) : NaN;
    const createdAt = cre ? Date.parse(cre[1]) : NaN;
    return {
      expiresAt: isNaN(expiresAt) ? null : expiresAt,
      createdAt: isNaN(createdAt) ? null : createdAt,
      source: isNaN(expiresAt) ? 'none' : 'profile',
    };
  } catch {
    return { expiresAt: null, createdAt: null, source: 'none' };
  }
}

export function leftTxt(ms: number): string {
  if (ms <= 0) return 'истекла';
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return d + ' д ' + (h % 24) + ' ч';
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? h + ' ч ' + m + ' мин' : m + ' мин';
}
