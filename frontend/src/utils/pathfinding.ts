interface Point {
  x: number;
  y: number;
}

interface Grid {
  occupancy_grid: number[];
  width: number;
  height: number;
}

class PriorityQueue<T> {
  items: { element: T; priority: number }[] = [];

  enqueue(element: T, priority: number) {
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority < this.items[i].priority) {
        this.items.splice(i, 0, { element, priority });
        added = true;
        break;
      }
    }
    if (!added) {
      this.items.push({ element, priority });
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.element;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export const aStar = (grid: Grid, start: Point, goal: Point): Point[] => {
  if (!grid || !grid.occupancy_grid) return [];

  const width = grid.width;
  const height = grid.height;
  
  const startX = Math.round(start.x);
  const startY = Math.round(start.y);
  const goalX = Math.round(goal.x);
  const goalY = Math.round(goal.y);

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return [];
  if (goalX < 0 || goalX >= width || goalY < 0 || goalY >= height) return [];

  const getIdx = (x: number, y: number) => y * width + x;

  const pq = new PriorityQueue<Point>();
  pq.enqueue({ x: startX, y: startY }, 0);

  const cameFrom = new Map<number, Point>();
  const costSoFar = new Map<number, number>();

  const startIdx = getIdx(startX, startY);
  costSoFar.set(startIdx, 0);

  const heuristic = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  const neighbors = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ];

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;

    if (current.x === goalX && current.y === goalY) {
      break;
    }

    const currentIdx = getIdx(current.x, current.y);
    const currentCost = costSoFar.get(currentIdx) || 0;

    for (const dir of neighbors) {
      const nextX = current.x + dir.x;
      const nextY = current.y + dir.y;

      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
        const nextIdx = getIdx(nextX, nextY);
        const cellVal = grid.occupancy_grid[nextIdx];

        if (cellVal >= 50 || cellVal === -1) continue; 

        const moveCost = (dir.x !== 0 && dir.y !== 0) ? Math.SQRT2 : 1.0;
        const newCost = currentCost + moveCost + (cellVal / 10); 

        if (!costSoFar.has(nextIdx) || newCost < costSoFar.get(nextIdx)!) {
          costSoFar.set(nextIdx, newCost);
          const priority = newCost + heuristic({ x: nextX, y: nextY }, { x: goalX, y: goalY });
          pq.enqueue({ x: nextX, y: nextY }, priority);
          cameFrom.set(nextIdx, current);
        }
      }
    }
  }

  const goalIdx = getIdx(goalX, goalY);
  if (!cameFrom.has(goalIdx) && (startX !== goalX || startY !== goalY)) {
    return []; 
  }

  const path: Point[] = [];
  let curr: Point | undefined = { x: goalX, y: goalY };

  while (curr && (curr.x !== startX || curr.y !== startY)) {
    path.push(curr);
    curr = cameFrom.get(getIdx(curr.x, curr.y));
  }
  
  path.push({ x: startX, y: startY });
  path.reverse();

  return path;
};
