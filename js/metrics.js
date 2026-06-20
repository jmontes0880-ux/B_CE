/**
 * ============================================================
 * BALANCEO DE CARGAS ELÉCTRICAS - Panel ECA
 * Lógica de métricas y actualización de la UI
 * Desarrollado por ECA
 * © 2026 ECA - Todos los derechos reservados
 * ============================================================
 */

function setVoltaje(v, el) {
  voltaje = v;
  document.querySelectorAll('[data-v]').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('voltaje-custom').value = '';
  // Recalcular conversiones si estamos en modo potencia
  if (modoEntrada === 'potencia') aplicarModoUI();
  actualizarMetrics();
}

function getVoltajeOperacion() {
  var vc = parseFloat(document.getElementById('voltaje-custom').value);
  return vc > 0 ? vc : voltaje;
}

function getFaseGlobal() {
  return document.getElementById('fase-global').value;
}

function getFP() {
  return parseFloat(document.getElementById('fp').value) || 0.9;
}

function calcularPotencia(sumA, sumB, sumC) {
  var v = getVoltajeOperacion();
  var fp = getFP();
  var faseGlobal = getFaseGlobal();

  var iTotal = sumA + sumB + sumC;
  var sTotal = 0;
  var pTotal = 0;
  var detalle = '';

  if (faseGlobal === 'ABC') {
    var iPromedio = (sumA + sumB + sumC) / 3;
    var vLinea = v * Math.sqrt(3);
    sTotal = (Math.sqrt(3) * v * iPromedio) / 1000;
    pTotal = sTotal * fp;
    detalle = '√3 x ' + v + 'V x ' + iPromedio.toFixed(1) + 'A · VL=' + vLinea.toFixed(0) + 'V';
  } else if (faseGlobal === 'AB' || faseGlobal === 'BC' || faseGlobal === 'AC') {
    var iPromedio = (sumA + sumB + sumC) / 2;
    var vLinea = v * 2;
    sTotal = (vLinea * iPromedio) / 1000;
    pTotal = sTotal * fp;
    detalle = vLinea.toFixed(0) + 'V x ' + iPromedio.toFixed(1) + 'A';
  } else {
    sTotal = (v * iTotal) / 1000;
    pTotal = sTotal * fp;
    detalle = v + 'V x ' + iTotal.toFixed(1) + 'A';
  }

  return {
    corrienteTotal: iTotal,
    potenciaActiva: pTotal,
    potenciaAparente: sTotal,
    detalle: detalle
  };
}

function actualizarMetrics() {
  var sumA = 0, sumB = 0, sumC = 0;
  var desbalance = null;

  if (resultadosBackend) {
    sumA = resultadosBackend.sumA || 0;
    sumB = resultadosBackend.sumB || 0;
    sumC = resultadosBackend.sumC || 0;
    desbalance = (resultadosBackend.desbalance || 0) * 100;
  } else {
    for (var i = 0; i < APP.NUM_FILAS; i++) {
      var tipo = parseInt(document.getElementById('tipo-' + i) ? document.getElementById('tipo-' + i).value : '') || 0;
      // Usar corriente efectiva (ya convierte potencia si es necesario)
      var carga = getCorrienteEfectiva(i);
      var asignada = asignaciones[i];
      if (!tipo || carga === 0 || !asignada) continue;
      switch(asignada) {
        case 'A':   sumA += carga; break;
        case 'B':   sumB += carga; break;
        case 'C':   sumC += carga; break;
        case 'AB':  sumA += carga; sumB += carga; break;
        case 'BC':  sumB += carga; sumC += carga; break;
        case 'AC':  sumA += carga; sumC += carga; break;
        case 'ABC': sumA += carga; sumB += carga; sumC += carga; break;
      }
    }
    var vals = [sumA, sumB, sumC].filter(function(v) { return v > 0; });
    if (vals.length === 3) {
      var avg = (sumA + sumB + sumC) / 3;
      desbalance = avg > 0 ? Math.max(Math.abs(sumA - avg), Math.abs(sumB - avg), Math.abs(sumC - avg)) / avg * 100 : 0;
    } else if (vals.length === 2) {
      desbalance = (Math.max(vals[0], vals[1]) - Math.min(vals[0], vals[1])) / Math.max(vals[0], vals[1]) * 100;
    } else if (vals.length === 1) {
      desbalance = 0;
    }
  }

  var potencia = calcularPotencia(sumA, sumB, sumC);
  
  document.getElementById('stat-total-amp').innerHTML = fmt(potencia.corrienteTotal) + ' <span class="unit">A</span>';
  document.getElementById('stat-total-kw').innerHTML = fmt2(potencia.potenciaActiva) + ' <span class="unit">kW</span>';
  document.getElementById('stat-total-kva').innerHTML = fmt2(potencia.potenciaAparente) + ' <span class="unit">kVA</span>';

  document.getElementById('stat-detail-amp').textContent = 'A: ' + fmt(sumA) + ' · B: ' + fmt(sumB) + ' · C: ' + fmt(sumC);
  document.getElementById('stat-detail-kw').textContent = 'fp: ' + getFP().toFixed(2) + ' · ' + potencia.detalle;
  document.getElementById('stat-detail-kva').textContent = getFaseGlobal();

  var maxVal = Math.max(sumA, sumB, sumC, 1);
  ['A','B','C'].forEach(function(f) {
    var v = f === 'A' ? sumA : f === 'B' ? sumB : sumC;
    document.getElementById('bar-' + f).style.width = (v / maxVal * 100).toFixed(1) + '%';
    document.getElementById('bar-lbl-' + f).textContent = v.toFixed(1) + ' A';
  });

  var card = document.getElementById('card-desbalance');
  var el = document.getElementById('stat-desbalance');
  var detailEl = document.getElementById('stat-detail-desbalance');
  card.classList.remove('danger', 'success');
  if (desbalance !== null && isFinite(desbalance) && desbalance >= 0) {
    var pct = desbalance.toFixed(1);
    el.innerHTML = pct + '%';
    if (desbalance > 10) {
      card.classList.add('danger');
      detailEl.textContent = 'Desbalance critico';
    } else if (desbalance > 5) {
      detailEl.textContent = 'Desbalance moderado';
    } else {
      card.classList.add('success');
      detailEl.textContent = 'Balance optimo';
    }
  } else {
    el.textContent = '—';
    detailEl.textContent = 'Sin datos';
  }

  var activos = 0;
  for (var i = 0; i < APP.NUM_FILAS; i++) {
    if (getCorrienteEfectiva(i) > 0) activos++;
  }
  var modoLabel = modoEntrada === 'potencia' ? ' · modo potencia' : ' · modo corriente';
  setStatus(activos + ' circuito' + (activos !== 1 ? 's' : '') + ' activo' + (activos !== 1 ? 's' : '') + ' · fp: ' + getFP().toFixed(2) + modoLabel);
}

function onFaseGlobalChange() {
  Panel.faseGlobal = getFaseGlobal();
  // Si estamos en modo potencia, recalcular corrientes (dependen del tipo sistema para trifasico)
  if (modoEntrada === 'potencia') {
    for (var i = 0; i < APP.NUM_FILAS; i++) sincronizarFila(i);
  }
  actualizarMetrics();
  Panel.renderDebounced();
}