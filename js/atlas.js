/** Local reference geography from Natural Earth 1:10m, v5.1.2 (public domain). */
export async function addAtlas(map, { labels = true } = {}) {
  const pane = map.createPane("atlas");
  pane.style.zIndex = "190";
  pane.style.pointerEvents = "none";

  try {
    const response = await fetch("./data/philippines-atlas.geojson");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const geography = await response.json();
    const cities = L.layerGroup();
    L.geoJSON(geography, {
      pane: "atlas",
      interactive: false,
      attribution: "Natural Earth",
      style: { color: "#626269", weight: 1, opacity: 0.7, fillColor: "#242428", fillOpacity: 1 },
      filter: feature => feature.geometry.type !== "Point",
    }).addTo(map);

    if (!labels) return;
    function updateLabels() {
      const zoom = map.getZoom();
      cities.clearLayers();
      for (const feature of geography.features) {
        if (feature.geometry.type !== "Point" || feature.properties.zoom > zoom) continue;
        const [lng, lat] = feature.geometry.coordinates;
        const name = document.createElement("span");
        name.textContent = feature.properties.name;
        L.marker([lat, lng], {
          pane: "atlas",
          interactive: false,
          keyboard: false,
          icon: L.divIcon({ className: "atlas-city", html: name, iconSize: [1, 1] }),
        }).addTo(cities);
      }
    }
    cities.addTo(map);
    map.on("zoomend", updateLabels);
    updateLabels();
  } catch (error) {
    console.warn("Atlas geography unavailable", error);
  }
}
