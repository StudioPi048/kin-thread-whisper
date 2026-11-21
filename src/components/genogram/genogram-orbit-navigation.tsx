import {
  ArrowLeft,
  Hand,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  ScanLine,
  Square,
} from "lucide-react";
import { mapBranchNames, type MapBranch } from "./map-view-context";

type Generation = { generation: number; label: string; count: number };

interface OrbitNavigationProps {
  generations: readonly Generation[];
  activeGeneration: number | null;
  branch: MapBranch | null;
  branches: readonly MapBranch[];
  onGeneration: (generation: number | null) => void;
  onBranch: (branch: MapBranch | null) => void;
  onReturnToBoard?: () => void;
}

export function OrbitNavigation({
  generations,
  activeGeneration,
  branch,
  branches,
  onGeneration,
  onBranch,
  onReturnToBoard,
}: OrbitNavigationProps) {
  return (
    <nav className="geno-orbit-navigation" aria-label="Navegação da cena 3D">
      <div className="geno-orbit-navigation-head">
        <div className="geno-orbit-branches" role="group" aria-label="Ramos na cena orbital">
          <button
            type="button"
            aria-pressed={!branch && activeGeneration === null}
            onClick={() => onBranch(null)}
          >
            Árvore inteira
          </button>
          {branches.map((side) => (
            <button
              key={side}
              type="button"
              data-branch={side}
              aria-pressed={branch === side}
              onClick={() => onBranch(side)}
            >
              {mapBranchNames[side]}
            </button>
          ))}
        </div>
        {onReturnToBoard && (
          <button
            type="button"
            className="geno-orbit-return"
            aria-label="Voltar ao board"
            onClick={onReturnToBoard}
          >
            <ArrowLeft aria-hidden /> <span>Voltar ao board</span>
          </button>
        )}
      </div>
      {generations.length > 0 && (
        <div className="geno-orbit-generations">
          <div className="geno-orbit-generation-tabs" role="group" aria-label="Gerações da árvore">
            <button
              type="button"
              className="geno-orbit-generation-tab"
              aria-pressed={activeGeneration === null}
              onClick={() => onGeneration(null)}
            >
              <Layers className="geno-orbit-generation-icon" aria-hidden />
              <span>Todas as gerações</span>
            </button>
            {generations.map(({ generation, label, count }) => (
              <button
                key={generation}
                type="button"
                className="geno-orbit-generation-tab"
                aria-pressed={activeGeneration === generation}
                onClick={() => onGeneration(generation)}
              >
                <span className="geno-orbit-generation-dot" aria-hidden />
                <span>{label}</span>
                <span className="geno-orbit-generation-count" aria-hidden>
                  {count}
                </span>
              </button>
            ))}
          </div>
          <label className="geno-orbit-generation-select">
            <Layers aria-hidden />
            <span>Geração</span>
            <select
              aria-label="Geração em foco"
              value={activeGeneration ?? ""}
              onChange={(event) =>
                onGeneration(
                  event.currentTarget.value === "" ? null : Number(event.currentTarget.value),
                )
              }
            >
              <option value="">Todas as gerações</option>
              {generations.map(({ generation, label }) => (
                <option key={generation} value={generation}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </nav>
  );
}

interface OrbitCameraControlsProps {
  panMode: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onReset: () => void;
  onFront: () => void;
  onRotate: (direction: -1 | 1) => void;
  onTogglePan: () => void;
  onZoom: (direction: -1 | 1) => void;
}

export function OrbitCameraControls({
  panMode,
  canZoomIn,
  canZoomOut,
  onReset,
  onFront,
  onRotate,
  onTogglePan,
  onZoom,
}: OrbitCameraControlsProps) {
  return (
    <div className="geno-orbit-camera-nav" role="group" aria-label="Câmera da cena orbital">
      <div className="geno-orbit-camera-cluster">
        <button
          type="button"
          aria-label="Girar à esquerda"
          title="Girar à esquerda"
          onClick={() => onRotate(-1)}
        >
          <RotateCcw aria-hidden />
        </button>
        <span className="geno-orbit-camera-caption" aria-hidden>
          Girar
        </span>
        <button
          type="button"
          aria-label="Girar à direita"
          title="Girar à direita"
          onClick={() => onRotate(1)}
        >
          <RotateCw aria-hidden />
        </button>
        <button
          type="button"
          aria-pressed={panMode}
          aria-label="Mover câmera"
          title="Arrastar para mover o mapa"
          onClick={onTogglePan}
        >
          <Hand aria-hidden /> <span className="geno-orbit-camera-label">Mover</span>
        </button>
      </div>
      <div className="geno-orbit-camera-cluster">
        <button
          type="button"
          aria-label="Afastar"
          title="Afastar"
          disabled={!canZoomOut}
          onClick={() => onZoom(-1)}
        >
          <Minus aria-hidden />
        </button>
        <span className="geno-orbit-camera-caption" aria-hidden>
          Zoom
        </span>
        <button
          type="button"
          aria-label="Aproximar"
          title="Aproximar"
          disabled={!canZoomIn}
          onClick={() => onZoom(1)}
        >
          <Plus aria-hidden />
        </button>
      </div>
      <div className="geno-orbit-camera-cluster">
        <button type="button" aria-label="Vista frontal" title="Vista frontal" onClick={onFront}>
          <Square aria-hidden /> <span className="geno-orbit-camera-label">Vista frontal</span>
        </button>
        <button type="button" aria-label="Reenquadrar" title="Reenquadrar a cena" onClick={onReset}>
          <ScanLine aria-hidden /> <span className="geno-orbit-camera-label">Reenquadrar</span>
        </button>
      </div>
    </div>
  );
}
