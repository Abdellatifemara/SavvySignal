export interface SpeedPost {
  id: string;
  device_id: string;
  hotel_name: string;
  place_type: 'Hotel' | 'Motel' | 'Hostel' | 'Airbnb' | 'Resort' | 'Other';
  download_speed: number;
  upload_speed: number;
  ping_ms: number;
  latitude: number;
  longitude: number;
  created_at: string;
}

export type PlaceType = SpeedPost['place_type'];

export type SpeedTestStatus =
  | { kind: 'idle' }
  | { kind: 'pinging' }
  | { kind: 'downloading'; progress: number; speedMbps: number }
  | { kind: 'uploading'; progress: number; speedMbps: number }
  | { kind: 'done'; pingMs: number; downloadMbps: number; uploadMbps: number; simulated: boolean }
  | { kind: 'error'; message: string };
