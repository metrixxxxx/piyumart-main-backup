// All arithmetic uses integer centavos. Postgres stores PHP NUMERIC(14,2).
export function cents(value) {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(value))) throw new Error("Enter a valid PHP amount with at most two decimal places.");
  const [whole, fraction = ""] = String(value).split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount > 999999999999n) throw new Error("Amount exceeds the supported limit.");
  return Number(amount);
}
export function pesos(amount) {
  if (!Number.isSafeInteger(amount)) throw new Error("Invalid centavo amount.");
  return `${amount < 0 ? "-" : ""}${Math.floor(Math.abs(amount) / 100)}.${String(Math.abs(amount) % 100).padStart(2,"0")}`;
}
export function splitAmount(amount) {
  const commission = Number((BigInt(amount) * 3n + 50n) / 100n);
  return { gross: amount, commission, seller: amount - commission };
}
export function proportional(total, weights) {
  const sum = weights.reduce((a,b)=>a+BigInt(b),0n);
  if (!sum) return weights.map(()=>0);
  const shares = weights.map(weight=>Number(BigInt(total)*BigInt(weight)/sum));
  const ranked = weights.map((weight,i)=>({i,remainder:BigInt(total)*BigInt(weight)%sum})).sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);
  const remainder = total-shares.reduce((a,b)=>a+b,0);
  for(let i=0;i<remainder;i++) shares[ranked[i].i]++;
  return shares;
}
export function roundedRatio(amount, numerator, denominator) {
  return Number((BigInt(amount)*BigInt(numerator)+BigInt(denominator)/2n)/BigInt(denominator));
}
