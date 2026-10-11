import "./InventoryView.css";

function InventoryView({ inventory = [], onSwitchToMap }) {
  return (
    <div className="inventory-view">
      <div className="inventory-container">
        {/* Header Banner */}
        <section className="inventory-header-card">
          <div>
            <span className="inventory-kicker">ADVENTURER POUCH</span>
            <h2 className="inventory-title">CAMPUS INVENTORY</h2>
          </div>

          <div className="inventory-count-badge">
            {inventory.length} ITEMS
          </div>
        </section>

        {/* Empty State or Item Grid */}
        {inventory.length === 0 ? (
          <section className="inventory-empty-card">
            <div className="inventory-empty-icon">🎒</div>
            <h3 className="inventory-empty-title">INVENTORY IS EMPTY</h3>
            <p className="inventory-empty-desc">
              Solve campus checkpoint challenges across DAVV to collect unique artifacts, scrolls, keys, and trophies!
            </p>
            <button
              type="button"
              className="inventory-start-btn"
              onClick={onSwitchToMap}
            >
              FIND CHECKPOINTS ON MAP ▶
            </button>
          </section>
        ) : (
          <div className="inventory-grid">
            {inventory.map((item, index) => (
              <div key={item.id || index} className="inventory-item-card">
                <div className="inventory-item-header">
                  <div className="inventory-item-icon-box">
                    {item.icon || "📦"}
                  </div>
                  <div className="inventory-item-meta">
                    <h3 className="inventory-item-name">{item.name}</h3>
                    <span
                      className={`inventory-item-rarity ${item.rarity || "COMMON"}`}
                    >
                      {item.rarity || "COMMON"} • {item.type || "ITEM"}
                    </span>
                  </div>
                </div>

                <p className="inventory-item-desc">{item.description}</p>

                <div className="inventory-item-footer">
                  <span>DAVV QUEST ARTIFACT</span>
                  <span>QTY: 1</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryView;
