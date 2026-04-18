import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Box,
    IconButton,
    Tooltip,
    CircularProgress,
    Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet with webpack/vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const Container = styled(Box)(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: '400px',
}));

const MapWrapper = styled(Box)(({ theme }) => ({
    width: '100%',
    height: 250,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    border: `1px solid ${theme.custom?.border?.default ?? 'rgba(255,255,255,0.1)'}`,
    position: 'relative',
    '& .leaflet-container': {
        height: '100%',
        width: '100%',
        background: '#1a1a2e',
    },
}));

const MapControls = styled(Box)(() => ({
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
}));

const ControlButton = styled(IconButton)(({ theme }) => ({
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.custom?.border?.default ?? 'rgba(255,255,255,0.1)'}`,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    '&:hover': {
        backgroundColor: theme.custom?.surface?.white10 ?? 'rgba(255,255,255,0.1)',
    },
    '&.Mui-disabled': {
        opacity: 0.5,
        backgroundColor: theme.palette.background.paper,
    },
}));

const CoordinatesDisplay = styled(Box)(({ theme }) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: theme.custom?.surface?.white5 ?? 'rgba(255,255,255,0.05)',
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.custom?.border?.default ?? 'rgba(255,255,255,0.1)'}`,
}));

const CoordText = styled(Typography)(({ theme }) => ({
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: theme.palette.text.secondary,
    '& span': {
        color: theme.palette.text.primary,
        fontWeight: 500,
    },
}));

const HelpText = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.custom?.palette?.text?.muted ?? theme.palette.text.secondary,
    fontStyle: 'italic',
}));

const ErrorText = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    color: theme.palette.error.main,
}));

export interface LocationPickerValue {
    latitude: number;
    longitude: number;
}

interface LocationPickerProps {
    value: LocationPickerValue;
    onChange: (value: LocationPickerValue) => void;
    error?: string;
    disabled?: boolean;
}

export function LocationPicker({
    value,
    onChange,
    error,
    disabled = false,
}: LocationPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const hasValidCoordinates = value.latitude !== 0 || value.longitude !== 0;
    const defaultCenter: [number, number] = [32.0853, 34.7818]; // Tel Aviv as default

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const initialCenter = hasValidCoordinates
            ? [value.latitude, value.longitude] as [number, number]
            : defaultCenter;

        const map = L.map(mapContainerRef.current, {
            center: initialCenter,
            zoom: hasValidCoordinates ? 13 : 7,
            scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Handle map clicks
        map.on('click', (e: L.LeafletMouseEvent) => {
            if (disabled) return;
            onChange({
                latitude: e.latlng.lat,
                longitude: e.latlng.lng,
            });
        });

        mapRef.current = map;

        // Cleanup
        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
        if (hasValidCoordinates) {
            const marker = L.marker([value.latitude, value.longitude], {
                icon: defaultIcon,
                draggable: !disabled,
            }).addTo(mapRef.current);

            marker.on('dragend', () => {
                const position = marker.getLatLng();
                onChange({
                    latitude: position.lat,
                    longitude: position.lng,
                });
            });

            markerRef.current = marker;

            mapRef.current.setView([value.latitude, value.longitude], mapRef.current.getZoom());
        }
    }, [value.latitude, value.longitude, hasValidCoordinates, disabled, onChange]);

    const handleUseMyLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        setIsLocating(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                onChange(newLocation);

                if (mapRef.current) {
                    mapRef.current.setView(
                        [newLocation.latitude, newLocation.longitude],
                        15
                    );
                }
                setIsLocating(false);
            },
            (err) => {
                setIsLocating(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setLocationError('Location permission denied');
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setLocationError('Location unavailable');
                        break;
                    case err.TIMEOUT:
                        setLocationError('Location request timed out');
                        break;
                    default:
                        setLocationError('Failed to get location');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }, [onChange]);

    return (
        <Container>
            <MapWrapper>
                <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
                <MapControls>
                    <Tooltip title="Use my location" placement="left">
                        <span>
                            <ControlButton
                                onClick={handleUseMyLocation}
                                disabled={disabled || isLocating}
                                size="small"
                            >
                                {isLocating ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    <MyLocationIcon fontSize="small" />
                                )}
                            </ControlButton>
                        </span>
                    </Tooltip>
                </MapControls>
            </MapWrapper>

            {hasValidCoordinates ? (
                <CoordinatesDisplay>
                    <CoordText>
                        Lat: <span>{value.latitude.toFixed(6)}</span>
                    </CoordText>
                    <CoordText>
                        Lng: <span>{value.longitude.toFixed(6)}</span>
                    </CoordText>
                </CoordinatesDisplay>
            ) : (
                <HelpText>Click on the map to select a location</HelpText>
            )}

            {(error || locationError) && (
                <ErrorText>{error || locationError}</ErrorText>
            )}
        </Container>
    );
}
