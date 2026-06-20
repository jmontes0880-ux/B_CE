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
  // LLAMADA A LA API REST (Reemplazo de google.script.run)
  // ============================================
  
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
    if (!response.ok) {
      throw new Error('Error en la respuesta del servidor: ' + response.status);
    }
    return response.json();
  })
  .then(function(resultado) {
    estaBalanceando = false;
    
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
    showAlert('error', '❌ Error al balancear: ' + msg);
    setStatus('Error en balanceo');
    console.error(error);
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
  el.className = 'result-alert show ' + type;
  document.getElementById('result-msg').textContent = msg;
  var icon = el.querySelector('i');
  if (type === 'success') icon.className = 'fas fa-check-circle';
  else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
  else icon.className = 'fas fa-info-circle';
}

function hideAlert() {
  document.getElementById('result-alert').className = 'result-alert';
}

function setStatus(msg, loading) {
  document.getElementById('status-msg').textContent = msg;
  var dot = document.getElementById('status-dot');
  if (loading) {
    dot.classList.add('loading');
  } else {
    dot.classList.remove('loading');
  }
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

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
