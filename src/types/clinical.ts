/**
 * Vocabulário Oficial GeneaLiz - Tipagens Clínicas
 *
 * Este arquivo contém o modelo de domínio (Fase 3.5A) focado na infraestrutura
 * estrutural da Gramática Visual, sem implementações visuais diretas.
 */

/**
 * Níveis de Intensidade Clínica.
 * 0: Inativo
 * 1: Discreto (sutil, quase imperceptível)
 * 2: Evidente (marcação perceptível)
 * 3: Intenso (destaque forte/anomalia)
 */
export type IntensityLevel = 0 | 1 | 2 | 3;

/**
 * Ciclo de Maturação Clínica (Fase 4).
 * O ciclo de vida da informação clínica desde a percepção até o encerramento.
 */
export type MaturationStage =
  | "observada" // A IA ou terapeuta nota um padrão
  | "investigada" // Exploração ativa
  | "corroborada" // Ganha força e liga-se a membros da família
  | "contestada" // Descartada temporariamente, mantida no histórico
  | "arquivada"; // Ciclo fechado

/**
 * Estado Clínico Base
 * Define o comportamento e a semântica de qualquer entidade do sistema.
 */
export interface ClinicalState {
  /** O estágio atual de investigação do dado */
  stage: MaturationStage;

  /** Níveis de intensidade de cada conceito aplicável a este estado */
  intensities: {
    trauma: IntensityLevel;
    repetition: IntensityLevel;
    exclusion: IntensityLevel;
    loyalty: IntensityLevel;
    secret: IntensityLevel;
  };

  /** IDs de nós conectados caso haja ligações (ex: lealdades invisíveis) */
  connectedNodes?: string[];

  /** Marcação de tempo/idade relevante (ex: Síndrome de Aniversário) */
  temporalAnchor?: string | null;
}

/**
 * Função utilitária para inicializar um estado clínico "zerado"
 */
export function createEmptyClinicalState(stage: MaturationStage = "observada"): ClinicalState {
  return {
    stage,
    intensities: {
      trauma: 0,
      repetition: 0,
      exclusion: 0,
      loyalty: 0,
      secret: 0,
    },
  };
}
