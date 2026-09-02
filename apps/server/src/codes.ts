const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomCode(length: number, reserved: Set<string> = new Set()): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    let s = "";
    for (let i = 0; i < length; i++) {
      s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!reserved.has(s)) return s;
  }
  throw new Error("无法生成唯一代码");
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
