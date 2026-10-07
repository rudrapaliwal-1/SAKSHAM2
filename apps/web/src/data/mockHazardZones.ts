export interface HazardZone {
  id: string;
  name: string;
  type: 'FLOOD_INUNDATION' | 'STRUCTURAL_COLLAPSE_PERIMETER' | 'FIRE_BUFFER' | 'HAZARD_ISOLATION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  affectedRadiusMeters: number;
  centerCoordinates: { lat: number; lng: number };
  polygonCoordinates: [number, number][]; // [lng, lat] GeoJSON format
}

export const mockHazardZones: HazardZone[] = [
  {
    id: 'HZ-DEL-01',
    name: 'Yamuna River Inundation Belt (North Delhi)',
    type: 'FLOOD_INUNDATION',
    severity: 'CRITICAL',
    description: 'Active floodwater breach corridor covering Kashmiri Gate Ghats, Ring Road underpass, and Yamuna Khadar settlements.',
    affectedRadiusMeters: 1800,
    centerCoordinates: { lat: 28.6692, lng: 77.2315 },
    polygonCoordinates: [
      [77.2200, 28.6800],
      [77.2400, 28.6850],
      [77.2480, 28.6650],
      [77.2350, 28.6550],
      [77.2180, 28.6620],
      [77.2200, 28.6800]
    ]
  },
  {
    id: 'HZ-DEL-02',
    name: 'Okhla Phase II Structural Collapse Debris Perimeter',
    type: 'STRUCTURAL_COLLAPSE_PERIMETER',
    severity: 'CRITICAL',
    description: 'High-risk collapse zone around industrial plot 44-B with unstable concrete debris and restricted heavy vehicle access.',
    affectedRadiusMeters: 450,
    centerCoordinates: { lat: 28.5355, lng: 77.2732 },
    polygonCoordinates: [
      [77.2680, 28.5380],
      [77.2780, 28.5385],
      [77.2770, 28.5320],
      [77.2670, 28.5325],
      [77.2680, 28.5380]
    ]
  },
  {
    id: 'HZ-DEL-03',
    name: 'Mayur Vihar Agricultural Khadar Stormwater Zone',
    type: 'FLOOD_INUNDATION',
    severity: 'HIGH',
    description: 'Drain backflow inundation across low-lying temporary farm camps and riverbed cattle shelters.',
    affectedRadiusMeters: 1200,
    centerCoordinates: { lat: 28.5910, lng: 77.2980 },
    polygonCoordinates: [
      [77.2880, 28.6000],
      [77.3080, 28.6010],
      [77.3050, 28.5820],
      [77.2850, 28.5830],
      [77.2880, 28.6000]
    ]
  }
];
