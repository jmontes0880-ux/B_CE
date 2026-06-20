/**
 * ============================================================
 * BALANCEO DE CARGAS ELÉCTRICAS - Panel ECA
 * Utilidades: sanitización, tooltips, formateo, DOM helpers
 * Desarrollado por ECA
 * © 2026 ECA - Todos los derechos reservados
 * ============================================================
 */
// ============================================
// SANITIZACIÓN
// ============================================

function sanitizarNumero(valor, defaultValue, min, max) {
  defaultValue = defaultValue || 0;
  min = min || 0;
  max = max || Infinity;
  
  var num = parseFloat(valor);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function sanitizarString(valor, defaultValue, allowPattern) {
  defaultValue = defaultValue || '';
  allowPattern = allowPattern || /^[a-zA-Z0-9\-_,. ]+$/;
  
  if (typeof valor !== 'string') return defaultValue;
  var sanitized = valor.replace(/[\x00-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/[<>"'`]/g, '');
  if (allowPattern && !allowPattern.test(sanitized)) return defaultValue;
  return sanitized.trim();
}

function sanitizarFaseGlobal(fase) {
  var sanitized = sanitizarString(fase, 'ABC', /^[ABC]+$/);
  return APP.FASES_VALIDAS.indexOf(sanitized) !== -1 ? sanitized : 'ABC';
}

function sanitizarCircuitos(circuitos, maxCircuitos) {
  maxCircuitos = maxCircuitos || APP.MAX_CIRCUITOS;
  
  if (!Array.isArray(circuitos)) return [];
  var limitados = circuitos.slice(0, maxCircuitos);
  var tiposValidos = ['', '1', '2', '3'];
  
  return limitados.map(function(c) {
    var tipo = sanitizarString(String(c.tipo || ''), '', /^[123]?$/);
    var carga = sanitizarNumero(c.carga, 0, 0, APP.MAX_CARGA);
    var tipoValido = tiposValidos.indexOf(tipo) !== -1 ? tipo : '';
    
    if (carga > 0 && !tipoValido) return { tipo: '', carga: 0 };
    if (tipoValido && carga <= 0) return { tipo: '', carga: 0 };
    
    return { tipo: tipoValido, carga: carga };
  });
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ============================================
// CONVERSIÓN POTENCIA ↔ CORRIENTE
// ============================================

/**
 * Convierte potencia (W) a corriente (A) según tipo de circuito, voltaje y fp.
 * tipo: '1' monofásico, '2' bifásico, '3' trifásico
 */
function potenciaACorriente(potenciaW, tipo, voltaje, fp) {
  if (!potenciaW || potenciaW <= 0) return 0;
  tipo = parseInt(tipo) || 1;
  voltaje = voltaje || 127;
  fp = fp || 0.9;
  var faseGlobal = getFaseGlobal ? getFaseGlobal() : 'ABC';

  var corriente = 0;
  if (tipo === 3) {
    // Trifásico: P = √3 × V × I × fp
    corriente = potenciaW / (Math.sqrt(3) * voltaje * fp);
  } else if (tipo === 2) {
    // Bifásico: P = 2 × V × I × fp  (sistema con neutro central)
    corriente = potenciaW / (2 * voltaje * fp);
  } else {
    // Monofásico: P = V × I × fp
    corriente = potenciaW / (voltaje * fp);
  }
  return corriente;
}

/**
 * Convierte corriente (A) a potencia (W) según tipo de circuito.
 */
function corrienteAPotencia(corrienteA, tipo, voltaje, fp) {
  if (!corrienteA || corrienteA <= 0) return 0;
  tipo = parseInt(tipo) || 1;
  voltaje = voltaje || 127;
  fp = fp || 0.9;

  var potencia = 0;
  if (tipo === 3) {
    potencia = Math.sqrt(3) * voltaje * corrienteA * fp;
  } else if (tipo === 2) {
    potencia = 2 * voltaje * corrienteA * fp;
  } else {
    potencia = voltaje * corrienteA * fp;
  }
  return potencia;
}

/**
 * Devuelve la corriente efectiva para la fila i,
 * independientemente del modo activo.
 */
function getCorrienteEfectiva(i) {
  var v = getVoltajeOperacion ? getVoltajeOperacion() : 127;
  var fp = getFP ? getFP() : 0.9;
  var tipo = document.getElementById('tipo-' + i) ? document.getElementById('tipo-' + i).value : '1';

  if (modoEntrada === 'potencia') {
    var potEl = document.getElementById('potencia-' + i);
    var pot = potEl ? parseFloat(potEl.value) || 0 : 0;
    return potenciaACorriente(pot, tipo, v, fp);
  } else {
    var cargaEl = document.getElementById('carga-' + i);
    return cargaEl ? parseFloat(cargaEl.value) || 0 : 0;
  }
}

// ============================================
// FORMATO
// ============================================

function fmt(v, decimals) {
  decimals = decimals || 1;
  return v.toFixed(decimals);
}

function fmt2(v) {
  return v.toFixed(2);
}

function getITM(corriente) {
  if (!corriente || corriente <= 0) return null;
  for (var i = 0; i < APP.ITM_VALUES.length; i++) {
    if (APP.ITM_VALUES[i] >= corriente) return APP.ITM_VALUES[i];
  }
  return APP.ITM_VALUES[APP.ITM_VALUES.length - 1];
}

// ============================================
// DOM HELPERS
// ============================================

function $(selector, context) {
  context = context || document;
  return context.querySelector(selector);
}

function $$(selector, context) {
  context = context || document;
  return context.querySelectorAll(selector);
}

function getValue(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ============================================
// TOOLTIPS - Versión corregida
// ============================================

// Inicializar tooltips cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initTooltips);
// Si el DOM ya está cargado, inicializar inmediatamente
if (document.readyState !== 'loading') {
  initTooltips();
}

function initTooltips() {
  // Obtener todos los triggers
  var triggers = document.querySelectorAll('.tooltip-trigger');
  triggers.forEach(function(trigger) {
    // Verificar si ya tiene el tooltip creado
    if (trigger.dataset.tooltipInitialized) return;
    trigger.dataset.tooltipInitialized = 'true';
    
    // Obtener el contenido del tooltip desde .tooltip-box
    var box = trigger.querySelector('.tooltip-box');
    if (!box) return;
    var content = box.textContent.trim();
    if (!content) return;
    
    // Crear el elemento flotante
    var tooltip = document.createElement('div');
    tooltip.className = 'tt-floating';
    tooltip.textContent = content;
    document.body.appendChild(tooltip);
    
    // Eventos
    trigger.addEventListener('mouseenter', function(e) {
      showTooltip(tooltip, trigger, content);
    });
    
    trigger.addEventListener('mousemove', function(e) {
      positionTooltip(tooltip, trigger);
    });
    
    trigger.addEventListener('mouseleave', function() {
      hideTooltip(tooltip);
    });
    
    // También manejar focus/blur para accesibilidad
    trigger.addEventListener('focus', function(e) {
      showTooltip(tooltip, trigger, content);
    });
    trigger.addEventListener('blur', function() {
      hideTooltip(tooltip);
    });
  });
}

function showTooltip(tooltip, trigger, content) {
  tooltip.textContent = content;
  tooltip.classList.add('visible');
  positionTooltip(tooltip, trigger);
}

function hideTooltip(tooltip) {
  tooltip.classList.remove('visible');
}

function positionTooltip(tooltip, trigger) {
  var rect = trigger.getBoundingClientRect();
  var tooltipW = tooltip.offsetWidth || 200;
  var tooltipH = tooltip.offsetHeight || 40;
  var gap = 8;
  
  // Posición por defecto: arriba-centrado
  var left = rect.left + rect.width / 2 - tooltipW / 2;
  var top = rect.top - tooltipH - gap;
  
  // Ajustes si no cabe arriba
  if (top < 10) {
    top = rect.bottom + gap;
    tooltip.classList.add('tt-below');
  } else {
    tooltip.classList.remove('tt-below');
  }
  
  // No salir de la pantalla horizontalmente
  if (left < 10) left = 10;
  if (left + tooltipW > window.innerWidth - 10) {
    left = window.innerWidth - tooltipW - 10;
  }
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  
  // Posición de la flecha
  var arrowX = rect.left + rect.width / 2 - left;
  arrowX = Math.max(12, Math.min(tooltipW - 12, arrowX));
  tooltip.style.setProperty('--tt-arrow-x', arrowX + 'px');
}

// Estilos dinámicos para tooltips
(function addTooltipStyles() {
  var style = document.createElement('style');
  style.textContent = `
    .tt-floating {
      position: fixed;
      z-index: 99999;
      background: #1a1a18;
      color: #f0f0ee;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.5;
      max-width: 280px;
      width: max-content;
      text-align: left;
      box-shadow: 0 6px 20px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.18);
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      opacity: 0;
      transition: opacity 0.15s ease;
      white-space: normal;
      word-break: break-word;
    }
    .tt-floating.visible {
      opacity: 1;
    }
    .tt-floating::after {
      content: '';
      position: absolute;
      border: 6px solid transparent;
      left: var(--tt-arrow-x, 50%);
      transform: translateX(-50%);
    }
    .tt-floating:not(.tt-below)::after {
      top: 100%;
      border-top-color: #1a1a18;
    }
    .tt-floating.tt-below::after {
      bottom: 100%;
      border-bottom-color: #1a1a18;
    }
    /* Ocultar el tooltip-box interno, pero sin display:none para que JS pueda leerlo */
    .tooltip-trigger .tooltip-box {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
    .tooltip-trigger {
      cursor: help;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      position: relative;
    }
    .tooltip-trigger .tooltip-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: var(--text-hint);
      color: white;
      font-size: 9px;
      font-weight: 900;
      font-style: italic;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      flex-shrink: 0;
      transition: background 0.2s;
      user-select: none;
      padding-bottom: 1px;
      letter-spacing: 0;
    }
    .tooltip-trigger:hover .tooltip-icon {
      background: var(--accent);
    }
  `;
  document.head.appendChild(style);
})();

// ============================================
// CREATE TOOLTIP HTML (helper para crear triggers)
// ============================================

function createTooltipHTML(label, tip, icon) {
  var iconHtml = icon 
    ? '<i class="' + icon + '" style="font-size:12px;color:var(--text-hint);"></i>' 
    : '<span class="tooltip-icon">¡</span>';
  
  return '<span class="tooltip-trigger">' +
         label +
         iconHtml +
         '<span class="tooltip-box">' + tip + '</span>' +
         '</span>';
}