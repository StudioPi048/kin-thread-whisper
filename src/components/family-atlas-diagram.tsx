/** Illustrative geometry only. Never used as a client's real genogram. */
export function FamilyAtlasDiagram() {
  const people = [
    { x: 90, y: 395, name: "Antônio", year: "1932", square: true },
    { x: 220, y: 395, name: "Cecília", year: "1936", square: false },
    { x: 410, y: 395, name: "Raimundo", year: "1930", square: true },
    { x: 540, y: 395, name: "Lúcia", year: "1934", square: false },
    { x: 155, y: 220, name: "Carlos", year: "1960", square: true },
    { x: 475, y: 220, name: "Mariana", year: "1965", square: false },
    { x: 245, y: 55, name: "Helena", year: "1990", square: false },
    { x: 385, y: 55, name: "Pedro", year: "1992", square: true },
  ];
  return (
    <figure className="atlas-diagram">
      <svg
        viewBox="0 0 630 490"
        role="img"
        aria-label="Exemplo fictício de uma família com oito pessoas em três gerações"
      >
        <g fill="none" stroke="#A2B5CA" strokeWidth="1.3">
          <path d="M116 395H194M436 395H514M155 395V302M475 395V302M181 220H449M315 220V145H245V137M315 145H385V137" />
        </g>
        {people.map((p) => (
          <g key={p.name}>
            {p.name === "Helena" && (
              <circle cx={p.x} cy={p.y} r="33" fill="none" stroke="#DBAC67" strokeWidth="2" />
            )}
            {p.square ? (
              <rect
                x={p.x - 26}
                y={p.y - 26}
                width="52"
                height="52"
                fill="#90A6BF"
                stroke="#CFDBE8"
                strokeWidth="1.5"
              />
            ) : (
              <circle cx={p.x} cy={p.y} r="26" fill="#C9969F" stroke="#EDD7DC" strokeWidth="1.5" />
            )}
            <text
              x={p.x}
              y={p.y + 50}
              textAnchor="middle"
              fill={p.name === "Helena" ? "#E7BF86" : "#F5F7FA"}
              fontSize="15"
              fontFamily="Inter,sans-serif"
              fontWeight="500"
            >
              {p.name}
            </text>
            <text
              x={p.x}
              y={p.y + 70}
              textAnchor="middle"
              fill="#B8C8D9"
              fontSize="12"
              fontFamily="Inter,sans-serif"
            >
              {p.year}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Família ilustrativa · dados fictícios</figcaption>
    </figure>
  );
}
