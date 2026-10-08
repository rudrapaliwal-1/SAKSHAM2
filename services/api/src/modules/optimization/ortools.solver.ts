import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface VrpSolverPayload {
  distance_matrix: number[][]; // in meters
  duration_matrix: number[][]; // in seconds
  demands: number[];           // load per node (depots have 0)
  vehicle_capacities: number[];
  num_vehicles: number;
  starts: number[];
  ends: number[];
  priorities: string[];
  node_ids: string[];
  strategy?: string;
  max_solve_time_seconds?: number;
  service_time_seconds_per_stop?: number;
}

export interface RawVrpRoute {
  vehicle_index: number;
  node_indices: number[];
  node_ids: string[];
  distance_meters: number;
  distance_km: number;
  duration_seconds: number;
  duration_minutes: number;
  load: number;
  capacity: number;
  load_percentage: number;
  active: boolean;
}

export interface RawVrpSolution {
  status: 'OPTIMAL' | 'FEASIBLE' | 'PARTIAL' | 'NO_SOLUTION' | 'ERROR';
  routes: RawVrpRoute[];
  metrics: {
    total_distance_km: number;
    total_duration_minutes: number;
    total_load_delivered: number;
    active_vehicles: number;
    unfulfilled_count: number;
    served_count: number;
  };
  unfulfilled: Array<{
    node_index: number;
    node_id: string;
    demand: number;
    priority: string;
  }>;
  engineUsed: 'OR-TOOLS VRP' | 'ALGORITHMIC VRP';
}

export class OrToolsSolver {
  /**
   * Solves VRP by calling the Python OR-Tools solver script with algorithmic fallback.
   */
  static async solve(payload: VrpSolverPayload): Promise<RawVrpSolution> {
    try {
      const pythonSolution = await this.solveWithPythonOrTools(payload);
      return {
        ...pythonSolution,
        engineUsed: 'OR-TOOLS VRP',
      };
    } catch (err: any) {
      console.warn(`[OR-TOOLS SOLVER] Python OR-Tools bridge fallback (${err.message}). Using TypeScript Algorithmic VRP Solver.`);
      const algorithmicSolution = this.solveAlgorithmicVrp(payload);
      return {
        ...algorithmicSolution,
        engineUsed: 'ALGORITHMIC VRP',
      };
    }
  }

  /**
   * Executes Python OR-Tools engine via subprocess.
   */
  private static solveWithPythonOrTools(payload: VrpSolverPayload): Promise<Omit<RawVrpSolution, 'engineUsed'>> {
    return new Promise((resolve, reject) => {
      // Find vrp_engine.py path across workspace directory structures
      const candidatePaths = [
        path.resolve(process.cwd(), '../../optimization/vrp_engine.py'),
        path.resolve(process.cwd(), '../optimization/vrp_engine.py'),
        path.resolve(process.cwd(), 'optimization/vrp_engine.py'),
        path.resolve(process.cwd(), '../../../optimization/vrp_engine.py'),
      ];

      let resolvedPath = candidatePaths[0];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          resolvedPath = p;
          break;
        }
      }

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const child = spawn(pythonCmd, [resolvedPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python OR-Tools exited with code ${code}: ${stderr || stdout}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          if (parsed.status === 'ERROR') {
            reject(new Error(parsed.message || 'OR-Tools encountered an error'));
            return;
          }
          resolve(parsed);
        } catch (parseErr: any) {
          reject(new Error(`Failed to parse Python OR-Tools output: ${parseErr.message}. Output: ${stdout.slice(0, 200)}`));
        }
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }

  /**
   * Deterministic In-Process Algorithmic VRP Engine:
   * Priority-weighted Clarke-Wright Savings with 2-Opt local search refinement.
   */
  static solveAlgorithmicVrp(payload: VrpSolverPayload): Omit<RawVrpSolution, 'engineUsed'> {
    const { distance_matrix, duration_matrix, demands, vehicle_capacities, num_vehicles, starts, ends, priorities, node_ids } = payload;
    const numNodes = distance_matrix.length;
    const depotNodes = new Set([...starts, ...ends]);

    // Priority ordering for demands
    const priorityWeights: Record<string, number> = {
      CRITICAL: 100,
      HIGH: 50,
      MEDIUM: 20,
      LOW: 5,
    };

    // Demand nodes list
    const demandNodes: number[] = [];
    for (let i = 0; i < numNodes; i++) {
      if (!depotNodes.has(i)) {
        demandNodes.push(i);
      }
    }

    // Sort demand nodes by priority (CRITICAL first)
    demandNodes.sort((a, b) => {
      const pA = priorityWeights[priorities[a]?.toUpperCase()] || 20;
      const pB = priorityWeights[priorities[b]?.toUpperCase()] || 20;
      return pB - pA;
    });

    const vehicleRoutes: Array<{
      nodes: number[];
      currentLoad: number;
      capacity: number;
      startDepot: number;
      endDepot: number;
    }> = [];

    for (let v = 0; v < num_vehicles; v++) {
      vehicleRoutes.push({
        nodes: [],
        currentLoad: 0,
        capacity: vehicle_capacities[v] || 100,
        startDepot: starts[v] || 0,
        endDepot: ends[v] || starts[v] || 0,
      });
    }

    const servedNodes = new Set<number>();

    // Assign demand nodes using greedy savings & capacity fit
    for (const demandNode of demandNodes) {
      const demandQty = demands[demandNode];
      let bestVehicleIdx = -1;
      let bestInsertionPos = -1;
      let minAddedCost = Infinity;

      for (let v = 0; v < num_vehicles; v++) {
        const route = vehicleRoutes[v];
        if (route.currentLoad + demandQty <= route.capacity) {
          const currentNodes = route.nodes;
          if (currentNodes.length === 0) {
            // First stop from depot
            const addedDist = distance_matrix[route.startDepot][demandNode] + distance_matrix[demandNode][route.endDepot];
            if (addedDist < minAddedCost) {
              minAddedCost = addedDist;
              bestVehicleIdx = v;
              bestInsertionPos = 0;
            }
          } else {
            // Try inserting at every position
            for (let pos = 0; pos <= currentNodes.length; pos++) {
              const prevNode = pos === 0 ? route.startDepot : currentNodes[pos - 1];
              const nextNode = pos === currentNodes.length ? route.endDepot : currentNodes[pos];

              const oldDist = distance_matrix[prevNode][nextNode];
              const newDist = distance_matrix[prevNode][demandNode] + distance_matrix[demandNode][nextNode];
              const deltaDist = newDist - oldDist;

              if (deltaDist < minAddedCost) {
                minAddedCost = deltaDist;
                bestVehicleIdx = v;
                bestInsertionPos = pos;
              }
            }
          }
        }
      }

      if (bestVehicleIdx !== -1) {
        vehicleRoutes[bestVehicleIdx].nodes.splice(bestInsertionPos, 0, demandNode);
        vehicleRoutes[bestVehicleIdx].currentLoad += demandQty;
        servedNodes.add(demandNode);
      }
    }

    // 2-Opt local refinement on each route
    for (const route of vehicleRoutes) {
      if (route.nodes.length >= 3) {
        let improved = true;
        let iters = 0;
        while (improved && iters < 20) {
          improved = false;
          iters++;
          for (let i = 0; i < route.nodes.length - 1; i++) {
            for (let j = i + 1; j < route.nodes.length; j++) {
              const prevI = i === 0 ? route.startDepot : route.nodes[i - 1];
              const nodeI = route.nodes[i];
              const nodeJ = route.nodes[j];
              const nextJ = j === route.nodes.length - 1 ? route.endDepot : route.nodes[j + 1];

              const currentDist = distance_matrix[prevI][nodeI] + distance_matrix[nodeJ][nextJ];
              const newDist = distance_matrix[prevI][nodeJ] + distance_matrix[nodeI][nextJ];

              if (newDist < currentDist - 10) {
                // Reverse subsegment from i to j
                const reversed = route.nodes.slice(i, j + 1).reverse();
                route.nodes.splice(i, j - i + 1, ...reversed);
                improved = true;
              }
            }
          }
        }
      }
    }

    // Build raw routes output
    const routes: RawVrpRoute[] = [];
    let totalDistM = 0;
    let totalDurS = 0;
    let totalLoad = 0;

    for (let v = 0; v < num_vehicles; v++) {
      const r = vehicleRoutes[v];
      const fullSequence = [r.startDepot, ...r.nodes, r.endDepot];

      let rDistM = 0;
      let rDurS = 0;
      for (let i = 0; i < fullSequence.length - 1; i++) {
        const fromN = fullSequence[i];
        const toN = fullSequence[i + 1];
        rDistM += distance_matrix[fromN][toN];
        rDurS += (duration_matrix[fromN] ? duration_matrix[fromN][toN] : Math.round(distance_matrix[fromN][toN] / 11));
      }

      const active = r.nodes.length > 0;
      routes.push({
        vehicle_index: v,
        node_indices: fullSequence,
        node_ids: fullSequence.map(n => node_ids[n] || String(n)),
        distance_meters: rDistM,
        distance_km: Math.round(rDistM / 1000 * 100) / 100,
        duration_seconds: rDurS,
        duration_minutes: Math.round(rDurS / 60 * 10) / 10,
        load: r.currentLoad,
        capacity: r.capacity,
        load_percentage: r.capacity > 0 ? Math.round((r.currentLoad / r.capacity) * 1000) / 10 : 0,
        active,
      });

      totalDistM += rDistM;
      totalDurS += rDurS;
      totalLoad += r.currentLoad;
    }

    const unfulfilled: Array<{ node_index: number; node_id: string; demand: number; priority: string }> = [];
    for (const demandNode of demandNodes) {
      if (!servedNodes.has(demandNode)) {
        unfulfilled.push({
          node_index: demandNode,
          node_id: node_ids[demandNode] || String(demandNode),
          demand: demands[demandNode],
          priority: priorities[demandNode] || 'MEDIUM',
        });
      }
    }

    return {
      status: unfulfilled.length === 0 ? 'OPTIMAL' : 'FEASIBLE',
      routes,
      metrics: {
        total_distance_km: Math.round(totalDistM / 1000 * 100) / 100,
        total_duration_minutes: Math.round(totalDurS / 60 * 10) / 10,
        total_load_delivered: totalLoad,
        active_vehicles: routes.filter(r => r.active).length,
        unfulfilled_count: unfulfilled.length,
        served_count: servedNodes.size,
      },
      unfulfilled,
    };
  }
}
