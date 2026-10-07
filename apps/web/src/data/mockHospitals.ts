export interface HospitalItem {
  id: string;
  name: string;
  type: 'AIIMS_TRAUMA_CENTER' | 'GOVERNMENT_HOSPITAL' | 'SUPER_SPECIALITY' | 'TRIAGE_FIELD_HOSPITAL';
  bedsTotal: number;
  bedsAvailable: number;
  icuAvailable: number;
  bloodUnitsAvailable: number;
  oxygenStatus: 'NORMAL' | 'SURGE_REQUIRED' | 'CRITICAL';
  coordinates: { lat: number; lng: number };
  locationName: string;
  contactEmergency: string;
}

export const mockHospitals: HospitalItem[] = [
  {
    id: 'HOSP-DEL-01',
    name: 'AIIMS Apex Trauma Center & Emergency Wing',
    type: 'AIIMS_TRAUMA_CENTER',
    bedsTotal: 320,
    bedsAvailable: 42,
    icuAvailable: 8,
    bloodUnitsAvailable: 180,
    oxygenStatus: 'NORMAL',
    coordinates: { lat: 28.5672, lng: 77.2100 },
    locationName: 'Safdarjung Enclave, Ring Road',
    contactEmergency: '+91-11-2659-4400'
  },
  {
    id: 'HOSP-DEL-02',
    name: 'Lok Nayak Jai Prakash (LNJP) Civil Hospital',
    type: 'GOVERNMENT_HOSPITAL',
    bedsTotal: 450,
    bedsAvailable: 68,
    icuAvailable: 12,
    bloodUnitsAvailable: 110,
    oxygenStatus: 'NORMAL',
    coordinates: { lat: 28.6360, lng: 77.2410 },
    locationName: 'Delhi Gate, Central Delhi',
    contactEmergency: '+91-11-2323-3000'
  },
  {
    id: 'HOSP-DEL-03',
    name: 'Safdarjung Emergency Medical Center',
    type: 'GOVERNMENT_HOSPITAL',
    bedsTotal: 380,
    bedsAvailable: 35,
    icuAvailable: 6,
    bloodUnitsAvailable: 95,
    oxygenStatus: 'NORMAL',
    coordinates: { lat: 28.5700, lng: 77.2080 },
    locationName: 'Sri Aurobindo Marg',
    contactEmergency: '+91-11-2616-5060'
  },
  {
    id: 'HOSP-DEL-04',
    name: 'Indraprastha Apollo Emergency Care',
    type: 'SUPER_SPECIALITY',
    bedsTotal: 250,
    bedsAvailable: 55,
    icuAvailable: 14,
    bloodUnitsAvailable: 220,
    oxygenStatus: 'NORMAL',
    coordinates: { lat: 28.5385, lng: 77.2840 },
    locationName: 'Sarita Vihar, Mathura Road',
    contactEmergency: '+91-11-2692-5858'
  }
];
