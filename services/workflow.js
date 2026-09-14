const transitions = {
  "Purchase requisition": ["Approval pending", "Approved", "Rejected", "Converted to RFQ"],
  "Purchase order": ["Draft", "Approval pending", "Approved", "Sent to vendor", "Partially received", "Closed"],
  "Vendor bill": ["Exception", "Approved for payment", "Paid", "Rejected"],
  "Sales order": ["Draft", "Reserved", "Invoiced", "Picking", "Dispatched", "Delivered", "Cancelled", "Return inspection"],
  "Return": ["QC pending", "Accepted - restocked", "Rejected - damaged", "Refunded"],
  "Production": ["Planned", "In progress", "Awaiting QC", "Accepted", "Rejected", "Complete"],
};

export function transition(type, current, next) {
  const allowed = transitions[type] || [];
  if (!allowed.includes(next)) throw new Error(`${type} cannot transition to ${next}`);
  if (current === next) return true;
  const index = allowed.indexOf(current);
  const target = allowed.indexOf(next);
  if (index >= 0 && target < index && !["Rejected", "Cancelled"].includes(next)) throw new Error(`${type} cannot move backwards from ${current} to ${next}`);
  return true;
}

export function requiredApprover(rules, transaction, amount = 0, context = {}) {
  const rule = (rules || []).find((candidate) => candidate.transaction === transaction && (candidate.status || "Active") === "Active");
  if (!rule) return null;
  return { ...rule, amount, context };
}
