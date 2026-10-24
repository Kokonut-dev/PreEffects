// POC 7: Bidirectional DAG Node Graph Topological Sort & Cycle Guard
export interface PocNode {
  id: string;
  kind: 'source' | 'effect' | 'merge' | 'output';
  inputs: string[];
}

export function topologicalSortDag(nodes: PocNode[]): { order: string[]; hasCycle: boolean } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, 0 | 1 | 2>();
  const order: string[] = [];
  let hasCycle = false;

  const visit = (id: string) => {
    const st = state.get(id) ?? 0;
    if (st === 1) {
      hasCycle = true;
      return;
    }
    if (st === 2) return;
    state.set(id, 1);
    const node = byId.get(id);
    if (node) {
      for (const inp of node.inputs) visit(inp);
      order.push(id);
    }
    state.set(id, 2);
  };

  for (const n of nodes) visit(n.id);
  return { order, hasCycle };
}
