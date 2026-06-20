/**
 * ============================================================
 * BALANCEO DE CARGAS ELÉCTRICAS - Panel ECA
 * Configuración global de la aplicación
 * Desarrollado por ECA
 * © 2026 ECA - Todos los derechos reservados
 * ============================================================
 */
const APP = {
  NUM_FILAS: 42,
  VERSION: 'beta',
  MAX_CIRCUITOS: 500,
  MAX_CARGA: 10000,
  MAX_POTENCIA: 9999999, // W
  ITM_VALUES: [15, 20, 30, 40, 50, 60, 80, 100, 125, 160, 200, 225, 250, 300, 400, 500, 600, 800, 1000, 1250, 1600, 2000, 2500, 3000, 4000, 5000, 6000],
  FASES_VALIDAS: ['ABC', 'AB', 'BC', 'AC', 'A', 'B', 'C']
};

// 'corriente' | 'potencia'
var modoEntrada = 'corriente';

const FASE_COLORS = {
  A: { line: '#1a1a18', fill: '#2c2c2a', light: '#e6f1fb', badge: '#185fa5', badgeBg: '#e6f1fb' },
  B: { line: '#c0392b', fill: '#d44332', light: '#fdecea', badge: '#c0392b', badgeBg: '#fdecea' },
  C: { line: '#1a5fa5', fill: '#2471c8', light: '#e6f1fb', badge: '#185fa5', badgeBg: '#e6f1fb' }
};

const FASE_MULTI_COLORS = {
  AB: '#6c3483', BC: '#6e2c00', AC: '#784212', ABC: '#2c3e50'
};

const FASE_BADGE_COLORS = {
  A:   { bg: '#e6f1fb', text: '#185fa5', border: '#185fa5' },
  B:   { bg: '#fdecea', text: '#c0392b', border: '#c0392b' },
  C:   { bg: '#ddeeff', text: '#1a5fa5', border: '#1a5fa5' },
  AB:  { bg: '#eeedfe', text: '#3c3489', border: '#3c3489' },
  BC:  { bg: '#fbeaf0', text: '#72243e', border: '#72243e' },
  AC:  { bg: '#fcebeb', text: '#791f1f', border: '#791f1f' },
  ABC: { bg: '#f1efe8', text: '#444441', border: '#888884' }
};