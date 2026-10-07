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
  return (
    <div className="game-map-wrapper">
      {/* --------------------------------------------- */}
      {/* GPS / GAME DEBUG INFORMATION                  */}
      {/* --------------------------------------------- */}

      <div className="gps-debug">
        {/* GPS loading */}

        {loading && <div className="gps-loading">Getting your location...</div>}

        {/* GPS error */}

        {error && <div className="gps-error">GPS Error: {error}</div>}

        {/* GPS accuracy */}

        {location && (
          <div className="gps-success">
            GPS ±{location.accuracy.toFixed(1)}m
          </div>
        )}

        {/* ------------------------------------------- */}
        {/* Checkpoint engine debug information         */}
        {/* ------------------------------------------- */}

        <div className="checkpoint-debug">
          <strong>CHECKPOINTS</strong>

          {checkpointStates.map((checkpoint) => (
            <div key={checkpoint.id}>
              <strong>{checkpoint.name}</strong>

              {" — "}

              {checkpoint.distance !== null
                ? `${checkpoint.distance.toFixed(1)}m`
                : "Waiting for GPS"}

              {" — "}

              <span
                style={{
                  color:
                    checkpoint.status === "COMPLETED"
                      ? "#22c55e"
                      : checkpoint.status === "AVAILABLE"
                        ? "#f5c542"
                        : "#9ca3af",
                }}
              >
                {checkpoint.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------------------------- */}
      {/* LEAFLET MAP                                   */}
      {/* --------------------------------------------- */}

      <MapContainer
        center={[22.6819, 75.8796]}
        zoom={17}
        scrollWheelZoom={true}
        className="game-map"
      >
        {/* ------------------------------------------- */}
        {/* OpenStreetMap tiles                         */}
        {/* ------------------------------------------- */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ------------------------------------------- */}
        {/* Automatically follow the player             */}
        {/* ------------------------------------------- */}

        <RecenterMap location={location} />

        {/* ------------------------------------------- */}
        {/* PLAYER LOCATION                             */}
        {/* ------------------------------------------- */}

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

            {/* GPS accuracy circle */}

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

        {/* ------------------------------------------- */}
        {/* CHECKPOINTS                                 */}
        {/* ------------------------------------------- */}

        {checkpointStates.map((checkpoint) => (
          <Fragment key={checkpoint.id}>
            {/* --------------------------------------- */}
            {/* Checkpoint geofence circle              */}
            {/* --------------------------------------- */}

            <Circle
              center={[checkpoint.latitude, checkpoint.longitude]}
              radius={checkpoint.radius}
              pathOptions={{
                color:
                  checkpoint.status === "COMPLETED"
                    ? "#22c55e"
                    : checkpoint.status === "CLAIMED"
                      ? "#a855f7"
                      : checkpoint.status === "AVAILABLE"
                        ? "#f5c542"
                        : "#6b7280",

                fillColor:
                  checkpoint.status === "COMPLETED"
                    ? "#22c55e"
                    : checkpoint.status === "CLAIMED"
                      ? "#a855f7"
                      : checkpoint.status === "AVAILABLE"
                        ? "#f5c542"
                        : "#6b7280",

                fillOpacity: 0.15,
                weight: 2,
              }}
            />

            {/* --------------------------------------- */}
            {/* Checkpoint marker                       */}
            {/* --------------------------------------- */}

            <Marker
              position={[checkpoint.latitude, checkpoint.longitude]}
              icon={playerIcon}
              eventHandlers={{
                click: () => {
                  if (checkpoint.status === "AVAILABLE") {
                    onCheckpointSelect(checkpoint.id);
                  }
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
