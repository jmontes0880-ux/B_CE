/**
 * ============================================================
 * BALANCEO DE CARGAS ELÉCTRICAS - Panel ECA
 * Lógica de la tabla de circuitos
 * Desarrollado por ECA
 * © 2026 ECA - Todos los derechos reservados
 * ============================================================
 */

function initTabla() {
  var tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  
  for (var i = 0; i < APP.NUM_FILAS; i++) {
    var tr = document.createElement('tr');
    tr.id = 'row-' + i;
    tr.innerHTML = 
      '<td class="col-no">' + (i + 1) + '</td>' +
      '<td class="col-desc">' +
        '<input type="text" id="desc-' + i + '" placeholder="Descripción..." maxlength="60" oninput="guardarEstado()">' +
      '</td>' +
      '<td>' +
        '<select onchange="onTipoChange(' + i + ')" id="tipo-' + i + '">' +
          '<option value="">—</option>' +
          '<option value="1">1 fase</option>' +
          '<option value="2">2 fases</option>' +
          '<option value="3">3 fases</option>' +
        '</select>' +
      '</td>' +
      '<td class="col-potencia">' +
        '<input type="number" id="potencia-' + i + '" placeholder="0" min="0" step="10" oninput="onPotenciaChange(' + i + ')" onblur="onPotenciaBlur(' + i + ')">' +
      '</td>' +
      '<td class="col-carga">' +
        '<input type="number" id="carga-' + i + '" placeholder="0" min="0" step="0.1" oninput="onCargaChange(' + i + ')" onblur="onCargaBlur(' + i + ')">' +
      '</td>' +
      '<td id="itm-' + i + '"><span class="itm-empty">—</span></td>' +
      '<td id="fase-' + i + '"><span class="fase-empty">—</span></td>' +
      '<td id="posicion-' + i + '"><span class="posicion-empty">—</span></td>' +
      '<td class="col-accion">' +
        '<button class="btn-row" onclick="borrarFila(' + i + ')" title="Borrar fila">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</td>';
    tbody.appendChild(tr);
    
    var cargaEl = document.getElementById('carga-' + i);
    if (cargaEl) {
      cargaEl.addEventListener('input', function(e) {
        var val = this.value.replace(/[^0-9.]/g, '');
        var parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        this.value = val;
      });
    }
    var potEl = document.getElementById('potencia-' + i);
    if (potEl) {
      potEl.addEventListener('input', function(e) {
        var val = this.value.replace(/[^0-9.]/g, '');
        var parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        this.value = val;
      });
    }
  }
  aplicarModoUI();
}

// ============================================
// MODO ENTRADA
// ============================================

function setModoEntrada(modo) {
  modoEntrada = modo;
  document.getElementById('btn-modo-corriente').classList.toggle('active', modo === 'corriente');
  document.getElementById('btn-modo-potencia').classList.toggle('active', modo === 'potencia');
  aplicarModoUI();
  actualizarMetrics();
  guardarEstado();
}

function aplicarModoUI() {
  var esPotencia = modoEntrada === 'potencia';
  var v = getVoltajeOperacion();
  var fp = getFP();

  document.querySelectorAll('.col-potencia').forEach(function(el) {
    el.style.display = esPotencia ? '' : 'none';
  });
  document.querySelectorAll('.col-carga').forEach(function(el) {
    el.style.display = esPotencia ? 'none' : '';
  });
  var thPotencia = document.getElementById('th-potencia');
  var thCarga = document.getElementById('th-carga');
  if (thPotencia) thPotencia.style.display = esPotencia ? '' : 'none';
  if (thCarga) thCarga.style.display = esPotencia ? 'none' : '';

  for (var i = 0; i < APP.NUM_FILAS; i++) {
    var tipo = document.getElementById('tipo-' + i) ? document.getElementById('tipo-' + i).value : '';
    var cargaEl = document.getElementById('carga-' + i);
    var potEl = document.getElementById('potencia-' + i);
    if (!cargaEl || !potEl) continue;
    var cargaVal = parseFloat(cargaEl.value) || 0;
    var potVal = parseFloat(potEl.value) || 0;
    if (esPotencia) {
      if (cargaVal > 0 && potVal === 0 && tipo) {
        potEl.value = corrienteAPotencia(cargaVal, tipo, v, fp).toFixed(0);
      }
    } else {
      if (potVal > 0 && cargaVal === 0 && tipo) {
        cargaEl.value = potenciaACorriente(potVal, tipo, v, fp).toFixed(2);
      }
    }
    actualizarITM(i);
  }
}

// ============================================
// HANDLERS
// ============================================

function onTipoChange(i) {
  asignaciones[i] = null;
  renderFaseBadge(i, null);
  resultadosBackend = null;
  sincronizarFila(i);
  actualizarITM(i);
  actualizarMetrics();
}

function onCargaChange(i) {
  var v = getVoltajeOperacion();
  var fp = getFP();
  var tipo = document.getElementById('tipo-' + i) ? document.getElementById('tipo-' + i).value : '1';
  var cargaEl = document.getElementById('carga-' + i);
  var potEl = document.getElementById('potencia-' + i);
  var carga = parseFloat(cargaEl.value) || 0;
  if (potEl && tipo) {
    potEl.value = carga > 0 ? corrienteAPotencia(carga, tipo, v, fp).toFixed(0) : '';
  }
  actualizarITM(i);
  actualizarMetrics();
}

function onCargaBlur(i) {
  var el = document.getElementById('carga-' + i);
  if (!el) return;
  var val = parseFloat(el.value);
  if (isNaN(val) || val < 0) {
    el.value = '';
  } else if (val > APP.MAX_CARGA) {
    el.value = APP.MAX_CARGA;
    showAlert('info', 'La corriente maxima permitida es ' + APP.MAX_CARGA + ' A');
  }
}

function onPotenciaChange(i) {
  var v = getVoltajeOperacion();
  var fp = getFP();
  var tipo = document.getElementById('tipo-' + i) ? document.getElementById('tipo-' + i).value : '1';
  var cargaEl = document.getElementById('carga-' + i);
  var potEl = document.getElementById('potencia-' + i);
  var pot = parseFloat(potEl.value) || 0;
  if (cargaEl && tipo) {
    cargaEl.value = pot > 0 ? potenciaACorriente(pot, tipo, v, fp).toFixed(2) : '';
  }
  actualizarITM(i);
  actualizarMetrics();
}

function onPotenciaBlur(i) {
  var el = document.getElementById('potencia-' + i);
  if (!el) return;
  var val = parseFloat(el.value);
  if (isNaN(val) || val < 0) {
    el.value = '';
  }
}

function sincronizarFila(i) {
  var v = getVoltajeOperacion();
  var fp = getFP();
  var tipo = document.getElementById('tipo-' + i) ? document.getElementById('tipo-' + i).value : '';
  var cargaEl = document.getElementById('carga-' + i);
  var potEl = document.getElementById('potencia-' + i);
  if (!tipo || !cargaEl || !potEl) return;
  if (modoEntrada === 'potencia') {
    var pot = parseFloat(potEl.value) || 0;
    if (pot > 0) cargaEl.value = potenciaACorriente(pot, tipo, v, fp).toFixed(2);
  } else {
    var carga = parseFloat(cargaEl.value) || 0;
    if (carga > 0) potEl.value = corrienteAPotencia(carga, tipo, v, fp).toFixed(0);
  }
}

// ============================================
// ITM
// ============================================

function actualizarITM(i) {
  var corriente = getCorrienteEfectiva(i);
  var el = document.getElementById('itm-' + i);
  var itm = getITM(corriente);
  if (itm) {
    el.innerHTML = '<span class="itm-display">' + itm + '</span>';
  } else {
    el.innerHTML = '<span class="itm-empty">—</span>';
  }
}

// ============================================
// BADGES
// ============================================

function renderFaseBadge(i, fase) {
  var el = document.getElementById('fase-' + i);
  if (!el) return;
  if (!fase) { el.innerHTML = '<span class="fase-empty">—</span>'; return; }
  var faseSegura = escapeHtml(fase);
  el.innerHTML = '<span class="fase-badge fase-' + faseSegura + '">' + faseSegura + '</span>';
}

function renderPosicionCell(i) {
  var el = document.getElementById('posicion-' + i);
  if (!el) return;
  var pos = posiciones[i];
  if (!pos) { el.innerHTML = '<span class="posicion-empty">—</span>'; return; }
  el.innerHTML = '<span class="posicion-badge"> ' + pos.join(', ') + '</span>';
}

// ============================================
// BORRAR / LIMPIAR
// ============================================

function borrarFila(i) {
  document.getElementById('tipo-' + i).value = '';
  document.getElementById('carga-' + i).value = '';
  document.getElementById('potencia-' + i).value = '';
  var descEl = document.getElementById('desc-' + i);
  if (descEl) descEl.value = '';
  asignaciones[i] = null;
  posiciones[i] = null;
  renderFaseBadge(i, null);
  renderPosicionCell(i);
  resultadosBackend = null;
  actualizarITM(i);
  actualizarMetrics();
  guardarEstado();
}

function limpiarTodo() {
  asignaciones = new Array(APP.NUM_FILAS).fill(null);
  posiciones = new Array(APP.NUM_FILAS).fill(null);
  resultadosBackend = null;
  for (var i = 0; i < APP.NUM_FILAS; i++) borrarFila(i);
  hideAlert();
  actualizarMetrics();
  Panel.renderDebounced();
  guardarEstado();
}

function renderFasesDesdeAsignaciones() {
  for (var i = 0; i < APP.NUM_FILAS; i++) renderFaseBadge(i, asignaciones[i] || null);
}

function renderPosiciones() {
  for (var i = 0; i < APP.NUM_FILAS; i++) renderPosicionCell(i);
}

// ============================================
// EJEMPLO
// ============================================

function cargarEjemplo() {
  limpiarTodo();
  var ejemplo = [
    { tipo: '1', carga: 15, desc: 'Iluminacion oficina' },
    { tipo: '1', carga: 20, desc: 'Tomacorrientes recepcion' },
    { tipo: '1', carga: 10, desc: 'Iluminacion bodega' },
    { tipo: '2', carga: 30, desc: 'Compresor 1' },
    { tipo: '2', carga: 25, desc: 'Compresor 2' },
    { tipo: '1', carga: 12, desc: 'Tomacorrientes laboratorio' },
    { tipo: '1', carga: 18, desc: 'Iluminacion exterior' },
    { tipo: '3', carga: 45, desc: 'Motor bomba principal' },
    { tipo: '1', carga: 8,  desc: 'Iluminacion emergencia' },
    { tipo: '2', carga: 22, desc: 'Aire acondicionado' }
  ];
  ejemplo.forEach(function(item, idx) {
    if (idx >= APP.NUM_FILAS) return;
    document.getElementById('tipo-' + idx).value = item.tipo;
    document.getElementById('carga-' + idx).value = item.carga;
    var descEl = document.getElementById('desc-' + idx);
    if (descEl) descEl.value = item.desc || '';
    sincronizarFila(idx);
    actualizarITM(idx);
  });
  actualizarMetrics();
  showAlert('info', 'Datos de ejemplo cargados. Presiona Balancear cargas para optimizar.');
  guardarEstado();
}

// ============================================
// EXPORTAR
// ============================================

function exportarDatos() {
  var datos = [];
  for (var i = 0; i < APP.NUM_FILAS; i++) {
    var tipo = document.getElementById('tipo-' + i).value;
    var corriente = getCorrienteEfectiva(i);
    var potEl = document.getElementById('potencia-' + i);
    var pot = potEl ? parseFloat(potEl.value) || 0 : 0;
    var descEl = document.getElementById('desc-' + i);
    var desc = descEl ? descEl.value : '';
    if (corriente > 0 || pot > 0) {
      var itm = getITM(corriente);
      datos.push({
        circuito: i + 1,
        descripcion: desc,
        tipo: tipo,
        corriente: corriente.toFixed(2),
        potencia: pot.toFixed(0),
        itm: itm || 'max',
        asignada: asignaciones[i] || 'sin asignar',
        posicion: posiciones[i] ? posiciones[i].join('⋅') : 'sin posicion'
      });
    }
  }
  var csv = 'Circuito,Descripcion,Tipo,Corriente (A),Potencia (W),ITM (A),Asignada,Posicion\n' +
    datos.map(function(d) {
      return [d.circuito, '"' + d.descripcion + '"', d.tipo, d.corriente, d.potencia, d.itm, d.asignada, d.posicion].join(',');
    }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'balanceo_cargas_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showAlert('success', 'Datos exportados como CSV');
}