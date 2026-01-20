'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@/types';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface EventsMapProps {
  events: Event[];
  userLocation?: { lat: number; lng: number };
}

// Simple geocoding function (using known locations for Bay Area)
const geocodeLocation = (location: string): { lat: number; lng: number } | null => {
  const locationLower = location.toLowerCase();
  
  // San Francisco locations
  if (locationLower.includes('golden gate park') || locationLower.includes('san francisco')) {
    return { lat: 37.7694, lng: -122.4862 };
  }
  if (locationLower.includes('dolores park')) {
    return { lat: 37.7597, lng: -122.4281 };
  }
  if (locationLower.includes('mission bay')) {
    return { lat: 37.7706, lng: -122.3892 };
  }
  if (locationLower.includes('aquatic park')) {
    return { lat: 37.8067, lng: -122.4231 };
  }
  if (locationLower.includes('market st')) {
    return { lat: 37.7849, lng: -122.4094 };
  }
  
  // Oakland locations
  if (locationLower.includes('oakland')) {
    return { lat: 37.8044, lng: -122.2711 };
  }
  
  // Berkeley locations
  if (locationLower.includes('berkeley')) {
    return { lat: 37.8715, lng: -122.2730 };
  }
  
  // Sausalito
  if (locationLower.includes('sausalito')) {
    return { lat: 37.8591, lng: -122.4853 };
  }
  
  // Fremont / Mission Peak
  if (locationLower.includes('mission peak') || locationLower.includes('fremont')) {
    return { lat: 37.5153, lng: -121.8804 };
  }
  
  // Default to San Francisco center
  return { lat: 37.7749, lng: -122.4194 };
};

// Custom marker icon
const createCustomIcon = (color: string = '#0ef9b4') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to center map on user location
function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function EventsMap({ events, userLocation }: EventsMapProps) {
  const [mounted, setMounted] = useState(false);
  const [eventLocations, setEventLocations] = useState<Array<{ event: Event; lat: number; lng: number }>>([]);
  const mapIdRef = useRef(`map-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const locations = events
      .map(event => {
        const coords = geocodeLocation(event.location);
        if (coords) {
          return { event, ...coords };
        }
        return null;
      })
      .filter((loc): loc is { event: Event; lat: number; lng: number } => loc !== null);
    
    setEventLocations(locations);
  }, [events]);

  // Default center (San Francisco)
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const center = userLocation ? [userLocation.lat, userLocation.lng] as [number, number] : defaultCenter;

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-gray-200 rounded-3xl flex items-center justify-center">
        <div className="text-gray-600">Loading map...</div>
      </div>
    );
  }

  // Get sport emoji/icon
  const getSportIcon = (sportName?: string) => {
    const sportIcons: { [key: string]: string } = {
      'Running': '🏃',
      'Cycling': '🚴',
      'Swimming': '🏊',
      'Yoga': '🧘',
      'Basketball': '🏀',
      'Tennis': '🎾',
      'Weightlifting': '🏋️',
      'Hiking': '🥾',
    };
    return sportIcons[sportName || ''] || '📍';
  };

  return (
    <div className="w-full h-[600px] rounded-3xl overflow-hidden shadow-lg border border-gray-200">
      <MapContainer
        key={mapIdRef.current}
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userLocation && (
          <>
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createCustomIcon('#3B82F6')}
            >
              <Popup>
                <div className="text-center">
                  <p className="font-semibold">You are here</p>
                </div>
              </Popup>
            </Marker>
            <MapCenter center={[userLocation.lat, userLocation.lng]} />
          </>
        )}
        
        {eventLocations.map(({ event, lat, lng }) => (
          <Marker
            key={event.id}
            position={[lat, lng]}
            icon={createCustomIcon('#0ef9b4')}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="flex items-start space-x-2 mb-2">
                  <span className="text-2xl">{getSportIcon(event.sport?.name)}</span>
                  <div className="flex-1">
                    <Link
                      href={`/events/${event.id}`}
                      className="font-bold text-gray-900 hover:text-[#0ef9b4] transition-colors"
                    >
                      {event.title}
                    </Link>
                    <p className="text-xs text-gray-600 mt-1">{event.location}</p>
                  </div>
                </div>
                {event.start_time && (
                  <p className="text-xs text-gray-500">
                    {new Date(event.start_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                )}
                {event.participant_count !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">
                    👥 {event.participant_count}
                    {event.max_participants && ` / ${event.max_participants}`} participants
                  </p>
                )}
                <Link
                  href={`/events/${event.id}`}
                  className="mt-2 inline-block text-xs bg-[#0ef9b4] text-black px-3 py-1 rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors"
                >
                  View Event →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

