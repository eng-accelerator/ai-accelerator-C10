export function shortModel(id: string): string {
  return id.split("/").pop() ?? id;
}

export function formatCost(n: number, digits = 3): string {
  return `$${n.toFixed(digits)}`;
}
