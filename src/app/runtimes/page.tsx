"use client";
import React, { useEffect, useState } from "react";

interface Runtime {
  id: string;
  name: string;
  provider: string;
  status: string;
  last_seen_at: string;
  metadata?: Record<string, any>;
}

export default function RuntimesPage() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [selected, setSelected] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runtimes")
      .then((res) => res.json())
      .then((data) => {
        setRuntimes(data);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ display: "flex", gap: 32 }}>
      <div style={{ minWidth: 320 }}>
        <h2>Runtimes</h2>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <ul>
            {runtimes.map((rt) => (
              <li
                key={rt.id}
                style={{
                  cursor: "pointer",
                  fontWeight: selected?.id === rt.id ? "bold" : "normal",
                  marginBottom: 8,
                }}
                onClick={() => setSelected(rt)}
              >
                {rt.name} <span style={{ color: rt.status === "online" ? "green" : "gray" }}>●</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>{rt.last_seen_at}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <h2>Details</h2>
        {selected ? (
          <pre style={{ background: "#f5f5f5", padding: 16 }}>{JSON.stringify(selected, null, 2)}</pre>
        ) : (
          <div>Select a runtime to view details.</div>
        )}
      </div>
    </div>
  );
}
