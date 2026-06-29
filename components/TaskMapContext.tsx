import { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

function PlaceSearchMap({ query, userLocation }: { query: string, userLocation: { lat: number, lng: number } | null }) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [places, setPlaces] = useState<google.maps.places.Place[]>([]);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    if (!placesLib || !query || !map) return;
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      const center = userLocation || map.getCenter();
      if (!center) return;

      // Provide a 50km radius bias
      const locationBias = {
        center: center,
        radius: 50000, 
      };

      placesLib.Place.searchByText({
        textQuery: query,
        fields: ['displayName', 'location', 'formattedAddress'],
        locationBias: locationBias as any,
        maxResultCount: 3,
      }).then(({ places }) => {
        setPlaces(places);
        
        if (places.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          if (userLocation) bounds.extend(userLocation);
          
          let addedPlace = false;
          places.forEach(p => {
             if (p.location) {
               bounds.extend(p.location);
               addedPlace = true;
             }
          });
          if (addedPlace) {
             map.fitBounds(bounds, 40);
          }
        } else if (userLocation) {
          map.setCenter(userLocation);
          map.setZoom(13);
        }
      }).catch(err => console.error("Place search error", err));
    }, 600); // debounce to wait for geolocation

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [placesLib, query, map, userLocation]);

  return (
    <>
      {userLocation && (
        <AdvancedMarker position={userLocation} title="Your Location" zIndex={100}>
          <Pin background="#0f9d58" glyphColor="#fff" borderColor="#00693e" />
        </AdvancedMarker>
      )}

      {places.map(p => p.location ? (
        <AdvancedMarker key={p.id} position={p.location} title={p.displayName}>
          <Pin background="#4285F4" glyphColor="#fff" />
        </AdvancedMarker>
      ) : null)}
      
      {places.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-lg text-[10px] text-white/80 pointer-events-none z-10">
          <div className="font-bold text-white mb-0.5 truncate">{places[0].displayName}</div>
          <div className="truncate opacity-70">{places[0].formattedAddress}</div>
        </div>
      )}
    </>
  );
}



export default function TaskMapContext({ query }: { query: string }) {
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  if (!API_KEY) {
    return (
      <div className="w-full h-32 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center p-4">
        <MapPin className="w-6 h-6 text-white/20 mb-2" />
        <p className="text-[10px] font-mono text-white/40 mb-2">Location context available</p>
        <p className="text-[9px] text-white/30">Provide Google Maps API Key in project settings to view locations for "{query}"</p>
      </div>
    );
  }

  const initialCenter = userLocation || { lat: 20.5937, lng: 78.9629 };

  return (
    <div className="w-full h-32 rounded-xl overflow-hidden border border-white/10 relative isolate">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={initialCenter}
          defaultZoom={userLocation ? 10 : 4}
          mapId="TASKPULSE_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="cooperative"
          disableDefaultUI={true}
        >
          <PlaceSearchMap query={query} userLocation={userLocation} />
        </Map>
      </APIProvider>
    </div>
  );
}
