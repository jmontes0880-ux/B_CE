/**
 * ============================================================
 * BALANCEO DE CARGAS ELÉCTRICAS - Panel ECA
 * Lógica principal de la aplicación
 * Desarrollado por ECA
 * © 2026 ECA - Todos los derechos reservados
 * ============================================================
 */

// ============================================
// ESTADO GLOBAL
// ============================================

var voltaje = 127;
var asignaciones = new Array(APP.NUM_FILAS).fill(null);
var posiciones = new Array(APP.NUM_FILAS).fill(null);
var estaBalanceando = false;
var resultadosBackend = null;

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function getFP() {
  var fpInput = document.getElementById('fp');
  return fpInput ? parseFloat(fpInput.value) || 0.9 : 0.9;
}

function getFaseGlobal() {
  var select = document.getElementById('fase-global');
  return select ? select.value : 'ABC';
}

// ============================================
// BALANCEAR - LLAMADA A LA API
// ============================================

function balancear() {
  if (estaBalanceando) return;
  estaBalanceando = true;

  var faseGlobalRaw = document.getElementById('fase-global').value;
  var faseGlobal = sanitizarFaseGlobal(faseGlobalRaw);

  var fasesValidas = ['ABC', 'AB', 'BC', 'AC', 'A', 'B', 'C'];
  if (fasesValidas.indexOf(faseGlobal) === -1) {
    showAlert('error', '❌ Fase global inválida');
    estaBalanceando = false;
    return;
  }

  var circuitos = [];
  var circuitosValidosCount = 0;
  
  for (var i = 0; i < APP.NUM_FILAS; i++) {
    var tipoEl = document.getElementById('tipo-' + i);
    var cargaEl = document.getElementById('carga-' + i);
    
    if (!tipoEl || !cargaEl) continue;
    
    var tipo = sanitizarString(tipoEl.value, '', /^[123]?$/);
    var carga = sanitizarNumero(cargaEl.value, 0, 0, APP.MAX_CARGA);
    
    if (tipo && carga <= 0) {
      tipo = '';
      carga = 0;
    }
    if (!tipo && carga > 0) {
      carga = 0;
    }
    
    circuitos.push({ tipo: tipo, carga: carga });
    if (tipo && carga > 0) circuitosValidosCount++;
  }

  if (circuitosValidosCount === 0) {
    showAlert('error', '⚠️ No hay circuitos válidos para balancear. Asegúrate de tener al menos un circuito con tipo y corriente > 0.');
    estaBalanceando = false;
    return;
  }

  if (circuitosValidosCount > APP.MAX_CIRCUITOS) {
    showAlert('error', '⚠️ Demasiados circuitos (' + circuitosValidosCount + '). Máximo permitido: ' + APP.MAX_CIRCUITOS + '.');
    estaBalanceando = false;
    return;
  }

  setStatus('Balanceando ' + circuitosValidosCount + ' circuitos...', true);
  showAlert('info', '🔄 Calculando balanceo óptimo...');

  var circuitosSanitizados = sanitizarCircuitos(circuitos, APP.MAX_CIRCUITOS);

  // ============================================
  // LLAMADA A LA API REST
  // ============================================
  
  console.log('📤 Enviando a:', API_URL + '/api/balancear');
  console.log('📦 Payload:', {
    circuitos: circuitosSanitizados,
    faseGlobal: faseGlobal,
    voltaje: voltaje,
    fp: getFP()
  });
  
  fetch(API_URL + '/api/balancear', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      circuitos: circuitosSanitizados,
      faseGlobal: faseGlobal,
      voltaje: voltaje,
      fp: getFP()
    })
  })
  .then(function(response) {
    console.log('📥 Response status:', response.status);
    if (!response.ok) {
      return response.json().then(function(errData) {
        throw new Error(errData.error || 'Error en la respuesta del servidor: ' + response.status);
      });
    }
    return response.json();
  })
  .then(function(resultado) {
    estaBalanceando = false;
    console.log('✅ Resultado:', resultado);
    
    if (!resultado || typeof resultado !== 'object') {
      showAlert('error', '❌ Respuesta inválida del servidor');
      setStatus('Error en balanceo');
      return;
    }
    
    if (resultado.error) {
      showAlert('error', '❌ ' + sanitizarString(resultado.error, 'Error desconocido'));
      setStatus('Error en balanceo');
      return;
    }
    
    var asignacionesRaw = resultado.asignaciones || [];
    var asignacionesValidas = asignacionesRaw.map(function(fase) {
      var f = sanitizarString(fase, null, /^[ABC]{1,3}$/);
      return f || null;
    });
    
    while (asignacionesValidas.length < circuitos.length) {
      asignacionesValidas.push(null);
    }
    
    asignaciones = asignacionesValidas.slice(0, APP.NUM_FILAS);
    
    resultadosBackend = {
      sumA: sanitizarNumero(resultado.sumA, 0, 0),
      sumB: sanitizarNumero(resultado.sumB, 0, 0),
      sumC: sanitizarNumero(resultado.sumC, 0, 0),
      desbalance: sanitizarNumero(resultado.desbalance, 0, 0, 1)
    };

    for (var i = 0; i < APP.NUM_FILAS; i++) {
      renderFaseBadge(i, asignaciones[i] || null);
    }

    asignarPosiciones();

    var pct = (resultadosBackend.desbalance * 100).toFixed(2);
    showAlert('success', '✅ Balanceo completado · Desbalance NEMA: ' + pct + '%');
    setStatus('Balanceo completado · ' + circuitosValidosCount + ' circuitos · Desbalance: ' + pct + '%');
    actualizarMetrics();
    guardarEstado();
    Panel.renderDebounced();
  })
  .catch(function(error) {
    estaBalanceando = false;
    var msg = error && error.message ? sanitizarString(error.message, 'Error desconocido') : 'Error desconocido';
    console.error('❌ Error en balanceo:', error);
    showAlert('error', '❌ Error al balancear: ' + msg);
    setStatus('Error en balanceo');
  });
}

// ============================================
// POSICIONES
// ============================================

function asignarPosiciones() {
  var faseGlobal = getFaseGlobal();
  var NUM_POS = APP.NUM_FILAS * 2;
  var ocupadas = new Set();
  posiciones = new Array(APP.NUM_FILAS).fill(null);

  var circuitosActivos = [];
  for (var i = 0; i < APP.NUM_FILAS; i++) {
    var fase = asignaciones[i];
    var carga = parseFloat(document.getElementById('carga-' + i)?.value) || 0;
    var tipo = document.getElementById('tipo-' + i)?.value;
    if (!fase || carga <= 0 || !tipo) continue;
    circuitosActivos.push({ idx: i, fase: fase, carga: carga, tipo: tipo });
  }

  circuitosActivos.sort(function(a, b) { return b.carga - a.carga; });

  for (var c = 0; c < circuitosActivos.length; c++) {
    var circuito = circuitosActivos[c];
    var pos = Panel.encontrarPosicion(circuito.tipo, circuito.fase, faseGlobal, ocupadas, NUM_POS);
    if (pos) {
      posiciones[circuito.idx] = pos;
      pos.forEach(function(p) { ocupadas.add(p); });
    }
  }

  for (var i = 0; i < APP.NUM_FILAS; i++) {
    renderPosicionCell(i);
  }

  Panel.render(faseGlobal, NUM_POS);
}

// ============================================
// ALERTAS Y ESTADO
// ============================================

function showAlert(type, msg) {
  var el = document.getElementById('result-alert');
  if (!el) return;
  el.className = 'result-alert show ' + type;
  var msgEl = document.getElementById('result-msg');
  if (msgEl) msgEl.textContent = msg;
  var icon = el.querySelector('i');
  if (icon) {
    if (type === 'success') icon.className = 'fas fa-check-circle';
    else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
    else icon.className = 'fas fa-info-circle';
  }
}

function hideAlert() {
  var el = document.getElementById('result-alert');
  if (el) el.className = 'result-alert';
}

function setStatus(msg, loading) {
  var statusMsg = document.getElementById('status-msg');
  if (statusMsg) statusMsg.textContent = msg;
  var dot = document.getElementById('status-dot');
  if (dot) {
    if (loading) {
      dot.classList.add('loading');
    } else {
      dot.classList.remove('loading');
    }
  }
}

// ============================================
// FUNCIÓN CARGAR EJEMPLO
// ============================================

function cargarEjemplo() {
  console.log('📂 Cargando datos de ejemplo...');
  
  // Limpiar tabla
  if (typeof limpiarTodo === 'function') {
    limpiarTodo();
  } else {
    // Si limpiarTodo no existe, limpiar manualmente
    for (var i = 0; i < APP.NUM_FILAS; i++) {
      var descEl = document.getElementById('desc-' + i);
      var tipoEl = document.getElementById('tipo-' + i);
      var cargaEl = document.getElementById('carga-' + i);
      if (descEl) descEl.value = '';
      if (tipoEl) tipoEl.value = '1';
      if (cargaEl) cargaEl.value = '';
    }
  }
  
  // Datos de ejemplo
  var datosEjemplo = [
    { desc: 'Alumbrado Pasillo', tipo: '1', carga: 8 },
    { desc: 'Contactos Oficina', tipo: '1', carga: 12 },
    { desc: 'Aire Acondicionado', tipo: '2', carga: 15 },
    { desc: 'Motores Compresor', tipo: '3', carga: 20 },
    { desc: 'Iluminación Exterior', tipo: '1', carga: 5 },
    { desc: 'Contactos Cocina', tipo: '1', carga: 10 },
    { desc: 'Bomba Agua', tipo: '2', carga: 18 },
    { desc: 'Ventilación', tipo: '1', carga: 6 },
    { desc: 'Sistema Seguridad', tipo: '1', carga: 3 },
    { desc: 'Calefacción', tipo: '2', carga: 25 },
    { desc: 'Equipos Oficina', tipo: '1', carga: 7 },
    { desc: 'Refrigeración', tipo: '3', carga: 30 }
  ];
  
  var cargados = 0;
  datosEjemplo.forEach(function(item, index) {
    if (index >= APP.NUM_FILAS) return;
    
    var descEl = document.getElementById('desc-' + index);
    var tipoEl = document.getElementById('tipo-' + index);
    var cargaEl = document.getElementById('carga-' + index);
    
    if (descEl) descEl.value = item.desc;
    if (tipoEl) tipoEl.value = item.tipo;
    if (cargaEl) cargaEl.value = item.carga;
    
    if (typeof actualizarITM === 'function') actualizarITM(index);
    if (typeof sincronizarFila === 'function') sincronizarFila(index);
    cargados++;
  });
  
  if (typeof actualizarMetrics === 'function') actualizarMetrics();
  if (typeof guardarEstado === 'function') guardarEstado();
  if (typeof showAlert === 'function') showAlert('success', '✅ ' + cargados + ' circuitos de ejemplo cargados');
  
  asignaciones = new Array(APP.NUM_FILAS).fill(null);
  posiciones = new Array(APP.NUM_FILAS).fill(null);
  resultadosBackend = null;
  
  if (typeof Panel !== 'undefined' && Panel.renderDebounced) Panel.renderDebounced();
  
  console.log('✅ Datos de ejemplo cargados:', cargados, 'circuitos');
}

// ============================================
// PERSISTENCIA (localStorage)
// ============================================

function guardarEstado() {
  try {
    var estado = {
      asignaciones: asignaciones,
      posiciones: posiciones,
      voltaje: voltaje,
      faseGlobal: getFaseGlobal(),
      fp: getFP(),
      datos: []
    };
    
    for (var i = 0; i < APP.NUM_FILAS; i++) {
      var tipo = document.getElementById('tipo-' + i)?.value;
      var carga = document.getElementById('carga-' + i)?.value;
      var desc = document.getElementById('desc-' + i)?.value;
      var potencia = document.getElementById('potencia-' + i)?.value;
      if (tipo && carga && parseFloat(carga) > 0) {
        estado.datos.push({ 
          idx: i, 
          tipo: tipo, 
          carga: carga,
          desc: desc || '',
          potencia: potencia || ''
        });
      }
    }
    
    localStorage.setItem('balanceoEstado', JSON.stringify(estado));
  } catch (e) { /* ignorar */ }
}

function restaurarEstado() {
  try {
    var raw = localStorage.getItem('balanceoEstado');
    if (!raw) return false;
    var estado = JSON.parse(raw);
    
    if (estado.datos) {
      estado.datos.forEach(function(item) {
        var tipoEl = document.getElementById('tipo-' + item.idx);
        var cargaEl = document.getElementById('carga-' + item.idx);
        var descEl = document.getElementById('desc-' + item.idx);
        var potEl = document.getElementById('potencia-' + item.idx);
        if (tipoEl) tipoEl.value = item.tipo;
        if (cargaEl) cargaEl.value = item.carga;
        if (descEl) descEl.value = item.desc || '';
        if (potEl) potEl.value = item.potencia || '';
        actualizarITM(item.idx);
        sincronizarFila(item.idx);
      });
    }
    
    if (estado.asignaciones) {
      asignaciones = estado.asignaciones.slice(0, APP.NUM_FILAS);
      while (asignaciones.length < APP.NUM_FILAS) asignaciones.push(null);
    }
    
    if (estado.posiciones) {
      posiciones = estado.posiciones.slice(0, APP.NUM_FILAS);
      while (posiciones.length < APP.NUM_FILAS) posiciones.push(null);
    }
    
    if (estado.faseGlobal) {
      document.getElementById('fase-global').value = estado.faseGlobal;
    }
    
    if (estado.voltaje) {
      voltaje = estado.voltaje;
      document.querySelectorAll('[data-v]').forEach(function(b) {
        b.classList.remove('active');
        if (parseInt(b.dataset.v) === voltaje) b.classList.add('active');
      });
      document.getElementById('voltaje-custom').value = '';
    }
    
    if (estado.fp) {
      document.getElementById('fp').value = estado.fp;
    }
    
    renderFasesDesdeAsignaciones();
    renderPosiciones();
    actualizarMetrics();
    asignarPosiciones();
    
    return true;
  } catch (e) {
    console.error('Error restaurando estado:', e);
    return false;
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================

function initApp() {
  initTabla();
  
  var restored = restaurarEstado();
  
  if (!restored) {
    actualizarMetrics();
    setTimeout(function() {
      showAlert('info', '💡 Bienvenido. Ingresa los datos de los circuitos y presiona "Balancear cargas".');
    }, 300);
  } else {
    showAlert('info', '💾 Estado restaurado automáticamente.');
  }
  
  // Teclado: Ctrl+Enter = Balancear
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      balancear();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      exportarDatos();
    }
  });
  
  // Guardar estado en eventos
  document.addEventListener('change', function() {
    setTimeout(guardarEstado, 100);
  });
  
  // Resize del canvas
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      Panel.renderDebounced();
    }, 120);
  });
  
  Panel.faseGlobal = getFaseGlobal();
  requestAnimationFrame(function() {
    Panel.render(Panel.faseGlobal, APP.NUM_FILAS * 2);
  });
}

// ============================================
// EXPONER TODAS LAS FUNCIONES GLOBALMENTE
// ============================================

// Función para exponer funciones de forma segura
function exponerFuncion(nombre, fn) {
  if (typeof fn === 'function') {
    window[nombre] = fn;
    console.log('✅ Función expuesta:', nombre);
  } else {
    console.warn('⚠️ Función no encontrada:', nombre);
    window[nombre] = function() {
      console.warn('⚠️ Función ' + nombre + ' no está definida (llamada desde HTML/panel.js)');
    };
  }
}

// Exponer funciones principales
exponerFuncion('balancear', balancear);
exponerFuncion('cargarEjemplo', cargarEjemplo);
exponerFuncion('exportarDatos', exportarDatos);
exponerFuncion('limpiarTodo', limpiarTodo);
exponerFuncion('setModoEntrada', setModoEntrada);
exponerFuncion('setVoltaje', setVoltaje);
exponerFuncion('actualizarMetrics', actualizarMetrics);
exponerFuncion('onFaseGlobalChange', onFaseGlobalChange);
exponerFuncion('initApp', initApp);

// Exponer funciones de alertas y estado
exponerFuncion('showAlert', showAlert);
exponerFuncion('hideAlert', hideAlert);
exponerFuncion('setStatus', setStatus);
exponerFuncion('guardarEstado', guardarEstado);
exponerFuncion('restaurarEstado', restaurarEstado);

// Exponer funciones de utilidad
exponerFuncion('getFP', getFP);
exponerFuncion('getFaseGlobal', getFaseGlobal);
exponerFuncion('asignarPosiciones', asignarPosiciones);

console.log('✅ Todas las funciones globales expuestas correctamente');
console.log('📋 Funciones disponibles:');
var funcionesEsperadas = [
  'balancear', 'cargarEjemplo', 'exportarDatos', 'limpiarTodo',
  'setModoEntrada', 'setVoltaje', 'actualizarMetrics', 'onFaseGlobalChange',
  'showAlert', 'setStatus', 'getFP', 'getFaseGlobal'
];
funcionesEsperadas.forEach(function(fn) {
  console.log('  - ' + fn + ': ' + (typeof window[fn] === 'function' ? '✅' : '❌'));
});

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
