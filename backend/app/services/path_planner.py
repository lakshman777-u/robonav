import math
import heapq
from typing import List, Tuple, Optional, Dict, Any

def heuristic(a: Tuple[int, int], b: Tuple[int, int]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])

def get_neighbors(node: Tuple[int, int], grid: List[List[int]], width: int, height: int) -> List[Tuple[int, int]]:
    neighbors = []
    for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, 1), (1, -1), (-1, -1)]:
        nx, ny = node[0] + dx, node[1] + dy
        if 0 <= nx < width and 0 <= ny < height:
            if grid[ny][nx] < 50:
                safe = True
                for cdx in [-1, 0, 1]:
                    for cdy in [-1, 0, 1]:
                        if 0 <= nx+cdx < width and 0 <= ny+cdy < height:
                            if grid[ny+cdy][nx+cdx] >= 50:
                                safe = False
                                break
                    if not safe: break
                if safe:
                    neighbors.append((nx, ny))
    return neighbors

def smooth_path(path: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    if len(path) <= 2:
        return path
    smoothed = [path[0]]
    for i in range(1, len(path) - 1):
        prev = smoothed[-1]
        curr = path[i]
        next_node = path[i+1]
        
        dx1, dy1 = curr[0] - prev[0], curr[1] - prev[1]
        dx2, dy2 = next_node[0] - curr[0], next_node[1] - curr[1]
        
        if dx1 != dx2 or dy1 != dy2:
            smoothed.append(curr)
    smoothed.append(path[-1])
    return smoothed

def plan_path(occupancy_grid: List[List[int]], start: Tuple[float, float], goal: Tuple[float, float], resolution: float, origin_x: float = 0.0, origin_y: float = 0.0) -> Optional[Dict[str, Any]]:
    if not occupancy_grid or not occupancy_grid[0]:
        return None
        
    height = len(occupancy_grid)
    width = len(occupancy_grid[0])
    
    start_x = int((start[0] - origin_x) / resolution)
    start_y = int((start[1] - origin_y) / resolution)
    goal_x = int((goal[0] - origin_x) / resolution)
    goal_y = int((goal[1] - origin_y) / resolution)
    
    start_node = (start_x, start_y)
    goal_node = (goal_x, goal_y)
    
    if not (0 <= start_x < width and 0 <= start_y < height and 0 <= goal_x < width and 0 <= goal_y < height):
        return None
        
    frontier = []
    heapq.heappush(frontier, (0, start_node))
    came_from = {start_node: None}
    cost_so_far = {start_node: 0.0}
    
    while frontier:
        _, current = heapq.heappop(frontier)
        
        if current == goal_node:
            break
            
        for next_node in get_neighbors(current, occupancy_grid, width, height):
            move_cost = 1.414 if next_node[0] != current[0] and next_node[1] != current[1] else 1.0
            new_cost = cost_so_far[current] + move_cost
            
            if next_node not in cost_so_far or new_cost < cost_so_far[next_node]:
                cost_so_far[next_node] = new_cost
                priority = new_cost + heuristic(goal_node, next_node)
                heapq.heappush(frontier, (priority, next_node))
                came_from[next_node] = current
                
    if goal_node not in came_from:
        return None
        
    path = []
    current = goal_node
    while current is not None:
        path.append(current)
        current = came_from[current]
    path.reverse()
    
    smoothed = smooth_path(path)
    
    world_path = [((x * resolution) + origin_x, (y * resolution) + origin_y) for x, y in smoothed]
    
    distance = cost_so_far[goal_node] * resolution
    estimated_time = estimate_time(distance)
    
    return {
        "path": world_path,
        "distance": distance,
        "estimated_time": estimated_time
    }

def estimate_time(distance: float, velocity: float = 0.3) -> float:
    return distance / velocity
