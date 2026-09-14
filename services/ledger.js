const round = (value) => Math.round(Number(value || 0) * 100) / 100;

export function balancedJournal({ id, reference, description, debit, credit, amount, user = "System", occurredAt = new Date().toISOString() }) {
  const value = round(amount);
  if (!reference || !debit || !credit || value <= 0 || debit === credit) throw new Error("A journal requires two different accounts and a positive amount");
  return { id, reference, description, debit, credit, amount: value, lines: [{ account: debit, direction: "Debit", amount: value }, { account: credit, direction: "Credit", amount: value }], user, occurredAt, status: "Posted" };
}

export function validateJournal(entry) {
  const lines = Array.isArray(entry.lines) && entry.lines.length ? entry.lines : [{ account: entry.debit, direction: "Debit", amount: entry.amount }, { account: entry.credit, direction: "Credit", amount: entry.amount }];
  const debits = round(lines.filter((line) => line.direction === "Debit").reduce((sum, line) => sum + Number(line.amount || 0), 0));
  const credits = round(lines.filter((line) => line.direction === "Credit").reduce((sum, line) => sum + Number(line.amount || 0), 0));
  return debits > 0 && debits === credits;
}

export function trialBalance(entries = []) {
  const accounts = new Map();
  for (const entry of entries) {
    const lines = Array.isArray(entry.lines) && entry.lines.length ? entry.lines : [{ account: entry.debit, direction: "Debit", amount: entry.amount }, { account: entry.credit, direction: "Credit", amount: entry.amount }];
    for (const line of lines) {
      const current = accounts.get(line.account) || { account: line.account, debit: 0, credit: 0 };
      current[line.direction.toLowerCase()] = round(current[line.direction.toLowerCase()] + Number(line.amount || 0));
      accounts.set(line.account, current);
    }
  }
  return [...accounts.values()].map((row) => ({ ...row, balance: round(row.debit - row.credit) }));
}
