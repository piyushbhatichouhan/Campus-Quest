import { Fragment } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import "./GameMap.css";

const playerIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Keeps the map centered on the player's current location
function RecenterMap({ location }) {
  const map = useMap();

  if (location) {
    map.setView([location.latitude, location.longitude], map.getZoom(), {
      animate: true,
    });
  }

  return null;
}

function GameMap({
  location,
  error,
  loading,
  checkpointStates,
  onCheckpointSelect,
}) {
  // Mystery-checkpoint rule: only show checkpoints that have been discovered, claimed, or completed
  const visibleCheckpoints = (checkpointStates || []).filter(
    (checkpoint) =>
      checkpoint.status === "DISCOVERED" ||
      checkpoint.status === "CHALLENGE" ||
      checkpoint.status === "COMPLETED",
  );

  return (
    <div className="game-map-wrapper">
      <div className="gps-debug">
        {loading && <div className="gps-loading">Getting your location...</div>}
        {error && <div className="gps-error">GPS Error: {error}</div>}
        {location && (
          <div className="gps-success">
            GPS ±{location.accuracy.toFixed(1)}m
          </div>
        )}
      </div>

      <MapContainer
        center={[22.6819, 75.8796]}
        zoom={17}
        scrollWheelZoom={true}
        className="game-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap location={location} />

        {location && (
          <>
            <Marker
              position={[location.latitude, location.longitude]}
              icon={playerIcon}
            >
              <Popup>
                <strong>You are here</strong>
                <br />
                Latitude: {location.latitude.toFixed(6)}
                <br />
                Longitude: {location.longitude.toFixed(6)}
                <br />
                Accuracy: ±{location.accuracy.toFixed(1)}m
              </Popup>
            </Marker>

            <Circle
              center={[location.latitude, location.longitude]}
              radius={location.accuracy}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          </>
        )}

        {visibleCheckpoints.map((checkpoint) => (
          <Fragment key={checkpoint.id}>
            <Circle
              center={[checkpoint.latitude, checkpoint.longitude]}
              radius={checkpoint.radius}
              pathOptions={{
                color:
                  checkpoint.status === "COMPLETED"
                    ? "#22c55e"
                    : checkpoint.status === "CHALLENGE"
                      ? "#a855f7"
                      : "#f5c542",
                fillColor:
                  checkpoint.status === "COMPLETED"
                    ? "#22c55e"
                    : checkpoint.status === "CHALLENGE"
                      ? "#a855f7"
                      : "#f5c542",
                fillOpacity: 0.18,
                weight: 2,
              }}
            />

            <Marker
              position={[checkpoint.latitude, checkpoint.longitude]}
              icon={playerIcon}
              eventHandlers={{
                click: () => {
                  onCheckpointSelect(checkpoint.id);
                },
              }}
            />
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

export default GameMap;
